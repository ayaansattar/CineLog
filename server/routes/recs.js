import { Router } from 'express';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import prisma from '../db.js';
import { buildCandidatePool } from '../candidates.js';

const router = Router();

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: `You are CineLog's recommendation engine for a single user's personal movie/TV library.

Rules:
- You MUST pick ONLY from the candidate pool provided in the user message.
- Never invent titles, years, or ids that are not in the pool.
- Return exactly 6 recommendations (or fewer only if the pool is smaller than 6).
- Prefer diversity: mix media types when appropriate, avoid near-duplicates.
- Tag each pick as matches_taste (fits their ratings) or popular_pick (broader appeal).
- Reasons should be specific to the user's request and brief (one sentence).`,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          recommendations: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                candidateId: {
                  type: SchemaType.STRING,
                  description: 'The candidate id from the pool (e.g. c0, c12)',
                },
                reason: {
                  type: SchemaType.STRING,
                  description: 'One short sentence explaining why this fits the request',
                },
                tag: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['matches_taste', 'popular_pick'],
                  description:
                    "matches_taste if aligned with the user's high ratings; popular_pick if a broader crowd-pleaser",
                },
              },
              required: ['candidateId', 'reason', 'tag'],
            },
          },
        },
        required: ['recommendations'],
      },
    },
  });
}

/**
 * POST /api/recs
 * Body: { query: string }
 */
router.post('/', async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    if (query.length > 500) {
      return res.status(400).json({ error: 'query must be 500 characters or less' });
    }

    const model = getGeminiModel();
    const { tasteProfile, candidates, seeds } = await buildCandidatePool(prisma);

    if (candidates.length < 6) {
      return res.status(422).json({
        error:
          'Not enough candidates to recommend. Rate more watched titles or add TMDB-linked entries first.',
        candidateCount: candidates.length,
      });
    }

    const poolForModel = candidates.map((c) => ({
      id: c.id,
      title: c.title,
      year: c.year,
      mediaType: c.mediaType,
      genres: c.genres,
      overview: c.overview,
    }));

    const userContent = JSON.stringify({
      request: query,
      tasteProfile,
      seedTitlesUsedForPool: seeds,
      candidates: poolForModel,
    });

    const result = await model.generateContent(
      `Recommend titles for this request. Candidate pool and taste profile follow as JSON:\n${userContent}`
    );

    let parsed;
    try {
      parsed = JSON.parse(result.response.text());
    } catch {
      return res.status(502).json({ error: 'Model did not return valid JSON recommendations' });
    }

    if (!Array.isArray(parsed?.recommendations)) {
      return res.status(502).json({ error: 'Model did not return structured recommendations' });
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const seen = new Set();
    const recommendations = [];

    for (const pick of parsed.recommendations) {
      const candidate = byId.get(pick.candidateId);
      if (!candidate || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      recommendations.push({
        tmdbId: candidate.tmdbId,
        title: candidate.title,
        year: candidate.year,
        mediaType: candidate.mediaType,
        posterPath: candidate.posterPath,
        genres: candidate.genres,
        overview: candidate.overview,
        reason: String(pick.reason || '').slice(0, 280),
        tag: pick.tag === 'popular_pick' ? 'popular_pick' : 'matches_taste',
      });
      if (recommendations.length >= 6) break;
    }

    if (recommendations.length === 0) {
      return res.status(502).json({
        error: 'Model returned picks that were not in the candidate pool',
      });
    }

    res.json({
      query,
      recommendations,
      meta: {
        candidateCount: candidates.length,
        seedCount: seeds.length,
        model: MODEL,
      },
    });
  } catch (err) {
    console.error('POST /api/recs', err);
    const status = err.status || err.statusCode || 500;
    let message = err.message || 'Recommendation request failed';

    // Surface common Gemini / Google Generative AI errors more clearly
    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('API key not valid')) {
      message = 'GEMINI_API_KEY is invalid';
    } else if (err.status === 429 || err.message?.includes('429')) {
      message = 'Gemini rate limit hit — try again in a moment';
    }

    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: status === 503 ? err.message : message,
    });
  }
});

export default router;
