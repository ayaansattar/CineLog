import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import prisma from '../db.js';
import { buildCandidatePool, buildWatchlistPool } from '../candidates.js';

const router = Router();

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const REC_COUNT = 18;
const SOURCES = new Set(['auto', 'discover', 'watchlist']);

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  return new GoogleGenAI({ apiKey });
}

function parseRecommendationsJson(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    const err = new Error('Model returned an empty response');
    err.status = 502;
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() || text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Model did not return valid JSON recommendations');
  }
}

/** Detect watchlist intent from natural language. */
export function detectRecSource(query) {
  const q = String(query || '').toLowerCase();

  // Negations should stay in discover mode ("not on my watchlist", etc.)
  if (
    /\b(not|n't|never)\b.{0,24}\b(on|in|from)\s+(my\s+)?watch[\s-]*list\b/.test(q) ||
    /\boutside\s+(of\s+)?(my\s+)?watch[\s-]*list\b/.test(q) ||
    /\bbeyond\s+(my\s+)?watch[\s-]*list\b/.test(q)
  ) {
    return 'discover';
  }

  if (
    /\b(from|on|in|of)\s+(my\s+)?watch[\s-]*list\b/.test(q) ||
    /\b(pick|choose|suggest|recommend|find).{0,48}\b(my\s+)?watch[\s-]*list\b/.test(q) ||
    /\b(my\s+)?watch[\s-]*list\b.{0,48}\b(pick|choice|tonight|suggest|recommend)\b/.test(q) ||
    /\bfrom\s+my\s+(list|queue)\b/.test(q) ||
    /\balready\s+on\s+my\s+(list|watch[\s-]*list)\b/.test(q) ||
    /\bpick\s+from\s+my\s+(list|library)\b/.test(q) ||
    /\bsomething\s+i\s+already\s+(added|saved|queued)\b/.test(q)
  ) {
    return 'watchlist';
  }
  return 'discover';
}

function resolveSource(requested, query) {
  const mode = SOURCES.has(requested) ? requested : 'auto';
  if (mode === 'auto') return detectRecSource(query);
  return mode;
}

/**
 * POST /api/recs
 * Body: { query: string, source?: 'auto' | 'discover' | 'watchlist' }
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

    const requestedSource = String(req.body?.source || 'auto').toLowerCase();
    const source = resolveSource(requestedSource, query);
    const fromWatchlist = source === 'watchlist';

    const ai = getClient();
    const pool = fromWatchlist
      ? await buildWatchlistPool(prisma)
      : await buildCandidatePool(prisma);
    const { tasteProfile, candidates, seeds } = pool;

    const targetCount = Math.min(REC_COUNT, candidates.length);

    if (candidates.length === 0) {
      return res.status(422).json({
        error: fromWatchlist
          ? 'Your watchlist is empty. Add titles first, or switch to Discover.'
          : 'Not enough candidates to recommend. Rate more watched titles or add TMDB-linked entries first.',
        candidateCount: 0,
        source,
      });
    }

    if (!fromWatchlist && candidates.length < Math.min(REC_COUNT, 6)) {
      return res.status(422).json({
        error:
          'Not enough candidates to recommend. Rate more watched titles or add TMDB-linked entries first.',
        candidateCount: candidates.length,
        source,
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
      mode: fromWatchlist ? 'watchlist' : 'discover',
      tasteProfile,
      seedTitlesUsedForPool: seeds,
      candidates: poolForModel,
    });

    const systemInstruction = fromWatchlist
      ? `You are CineLog's recommendation engine helping the user pick what to watch next from their existing watchlist.

Rules:
- You MUST pick ONLY from the candidate pool (their watchlist) provided in the user message.
- Never invent titles, years, or ids that are not in the pool.
- Return up to ${targetCount} recommendations, ranked best-first for the request (fewer is fine if the pool is smaller).
- Prefer diversity when the request is open-ended.
- Tag each pick as matches_taste (fits their ratings/taste) or popular_pick (safer / broader mood fit).
- Reasons should be specific to the user's request and brief (one sentence).`
      : `You are CineLog's recommendation engine for a single user's personal movie/TV library.

Rules:
- You MUST pick ONLY from the candidate pool provided in the user message.
- Never invent titles, years, or ids that are not in the pool.
- Return exactly ${targetCount} recommendations (or fewer only if the pool is smaller than ${targetCount}).
- Prefer diversity: mix media types when appropriate, avoid near-duplicates.
- Tag each pick as matches_taste (fits their ratings) or popular_pick (broader appeal).
- Reasons should be specific to the user's request and brief (one sentence).`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: fromWatchlist
        ? `Pick the best titles from my watchlist for this request (up to ${targetCount}). Candidate pool and taste profile follow as JSON:\n${userContent}`
        : `Recommend exactly ${targetCount} titles for this request (fewer only if the pool is smaller). Candidate pool and taste profile follow as JSON:\n${userContent}`,
      config: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  candidateId: {
                    type: Type.STRING,
                    description: 'The candidate id from the pool (e.g. c0, w3)',
                  },
                  reason: {
                    type: Type.STRING,
                    description: 'One short sentence explaining why this fits the request',
                  },
                  tag: {
                    type: Type.STRING,
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

    const finishReason = result.candidates?.[0]?.finishReason;
    const rawText = result.text;
    if (!rawText) {
      console.error('POST /api/recs empty model text', {
        finishReason,
        usage: result.usageMetadata,
        source,
      });
      return res.status(502).json({
        error:
          finishReason === 'MAX_TOKENS'
            ? 'Gemini ran out of output tokens before finishing recommendations. Try again.'
            : 'Model returned an empty response',
      });
    }

    let parsed;
    try {
      parsed = parseRecommendationsJson(rawText);
    } catch (parseErr) {
      console.error('POST /api/recs JSON parse failed', {
        finishReason,
        usage: result.usageMetadata,
        preview: String(rawText).slice(0, 400),
        source,
      });
      return res.status(502).json({
        error: parseErr.message || 'Model did not return valid JSON recommendations',
      });
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
        entryId: candidate.entryId ?? null,
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
      if (recommendations.length >= targetCount) break;
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
        source,
        requestedSource: SOURCES.has(requestedSource) ? requestedSource : 'auto',
        candidateCount: candidates.length,
        seedCount: seeds.length,
        model: MODEL,
      },
    });
  } catch (err) {
    console.error('POST /api/recs', err);
    const status = err.status || err.statusCode || 500;
    let message = err.message || 'Recommendation request failed';

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
