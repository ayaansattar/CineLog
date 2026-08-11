import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../db.js';
import { buildCandidatePool } from '../candidates.js';

const router = Router();

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  return new Anthropic({ apiKey });
}

const recommendTool = {
  name: 'submit_recommendations',
  description:
    'Submit exactly 6 movie/TV recommendations chosen only from the provided candidate pool.',
  input_schema: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            candidateId: {
              type: 'string',
              description: 'The candidate id from the pool (e.g. c0, c12)',
            },
            reason: {
              type: 'string',
              description: 'One short sentence explaining why this fits the request',
            },
            tag: {
              type: 'string',
              enum: ['matches_taste', 'popular_pick'],
              description:
                'matches_taste if aligned with the user\'s high ratings; popular_pick if a broader crowd-pleaser',
            },
          },
          required: ['candidateId', 'reason', 'tag'],
          additionalProperties: false,
        },
      },
    },
    required: ['recommendations'],
    additionalProperties: false,
  },
};

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

    const client = getAnthropicClient();
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

    const system = `You are CineLog's recommendation engine for a single user's personal movie/TV library.

Rules:
- You MUST pick ONLY from the candidate pool provided in the user message.
- Never invent titles, years, or ids that are not in the pool.
- Return exactly 6 recommendations via the submit_recommendations tool (or fewer only if the pool is smaller than 6).
- Prefer diversity: mix media types when appropriate, avoid near-duplicates.
- Tag each pick as matches_taste (fits their ratings) or popular_pick (broader appeal).
- Reasons should be specific to the user's request and brief (one sentence).`;

    const userContent = JSON.stringify({
      request: query,
      tasteProfile,
      seedTitlesUsedForPool: seeds,
      candidates: poolForModel,
    });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      tools: [recommendTool],
      tool_choice: { type: 'tool', name: 'submit_recommendations' },
      messages: [
        {
          role: 'user',
          content: `Recommend titles for this request. Candidate pool and taste profile follow as JSON:\n${userContent}`,
        },
      ],
    });

    const toolBlock = message.content.find(
      (block) => block.type === 'tool_use' && block.name === 'submit_recommendations'
    );
    if (!toolBlock || !toolBlock.input?.recommendations) {
      return res.status(502).json({ error: 'Model did not return structured recommendations' });
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const seen = new Set();
    const recommendations = [];

    for (const pick of toolBlock.input.recommendations) {
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
    const message =
      status === 503
        ? err.message
        : err.message || 'Recommendation request failed';
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
});

export default router;
