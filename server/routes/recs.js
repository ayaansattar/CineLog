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
function detectRecSource(query) {
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

/**
 * Detect movie vs TV intent.
 * @returns {'movie'|'tv'|null} null = no hard preference
 */
function detectMediaType(query) {
  const q = String(query || '').toLowerCase();

  if (
    /\b(movies?\s+or\s+(tv|shows?|series)|(?:tv|shows?|series)\s+or\s+movies?)\b/.test(q) ||
    /\b(either|both)\b.{0,20}\b(movies?|films?).{0,20}\b(tv|shows?|series)\b/.test(q) ||
    /\b(movies?\s+and\s+(tv|shows?)|(tv|shows?)\s+and\s+movies?)\b/.test(q)
  ) {
    return null;
  }

  const wantsMovie = /\b(movies?|films?|cinema)\b/.test(q);
  const wantsTv =
    /\b(tv\s*shows?|tv\s*series|television|miniseries|sitcoms?|anime)\b/.test(q) ||
    /\btv\b/.test(q) ||
    /\bseries\b/.test(q) ||
    // Avoid the verb in "show me"; match noun uses
    /\b(a|an|some|any|good|binge(?:able)?|serialized)\s+shows?\b/.test(q) ||
    /\bshows?\s+(from|on|like|for|about|with)\b/.test(q) ||
    /\b(watch|pick|recommend|suggest)\s+(me\s+)?(a\s+|an\s+|some\s+)?shows?\b/.test(q);

  if (wantsMovie && wantsTv) return null;
  if (wantsMovie) return 'movie';
  if (wantsTv) return 'tv';
  return null;
}

function resolveSource(requested, query) {
  const mode = SOURCES.has(requested) ? requested : 'auto';
  if (mode === 'auto') return detectRecSource(query);
  return mode;
}

function resolveMediaType(requested, query) {
  if (requested === 'movie' || requested === 'tv') return requested;
  if (requested === 'any' || requested === 'all') return null;
  return detectMediaType(query);
}

/** Detect genre hints from natural language (TMDB-style names). */
function detectGenres(query) {
  const q = String(query || '').toLowerCase();
  const catalog = [
    ['Science Fiction', [/\bsci[\s-]?fi\b/, /\bscience fiction\b/]],
    ['Action', [/\baction\b/]],
    ['Adventure', [/\badventure\b/]],
    ['Animation', [/\banimated\b/, /\banimation\b/, /\bcartoon\b/]],
    ['Comedy', [/\bcomed(y|ies)\b/, /\bfunny\b/, /\bhumerous\b/, /\bhilar/]],
    ['Crime', [/\bcrime\b/, /\bheist\b/]],
    ['Documentary', [/\bdocumentar(y|ies)\b/]],
    ['Drama', [/\bdrama\b/, /\bdramas\b/]],
    ['Family', [/\bfamily\b/]],
    ['Fantasy', [/\bfantasy\b/]],
    ['History', [/\bhistoric(al)?\b/]],
    ['Horror', [/\bhorror\b/, /\bscary\b/]],
    ['Music', [/\bmusical\b/, /\bmusic\b/]],
    ['Mystery', [/\bmystery\b/, /\bmysteries\b/]],
    ['Romance', [/\bromance\b/, /\bromantic\b/]],
    ['Thriller', [/\bthriller\b/]],
    ['War', [/\bwar\b/]],
    ['Western', [/\bwestern\b/]],
  ];

  const hits = [];
  for (const [name, patterns] of catalog) {
    if (patterns.some((re) => re.test(q))) hits.push(name);
  }
  return hits;
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function reindexCandidates(list) {
  return list.map((c, index) => ({ ...c, id: `c${index}` }));
}

function resolveCandidate(pick, byId, byTitle) {
  const rawId = String(pick.candidateId ?? pick.id ?? '').trim();
  if (rawId && byId.has(rawId)) return byId.get(rawId);
  if (rawId) {
    const lower = rawId.toLowerCase();
    if (byId.has(lower)) return byId.get(lower);
  }

  const titleKey = normalizeTitle(pick.title || rawId);
  if (titleKey && byTitle.has(titleKey)) return byTitle.get(titleKey);

  return null;
}

/**
 * POST /api/recs
 * Body: { query: string, source?: 'auto' | 'discover' | 'watchlist', mediaType?: 'auto' | 'movie' | 'tv' | 'any' }
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

    const requestedMedia = String(req.body?.mediaType || 'auto').toLowerCase();
    const mediaType = resolveMediaType(requestedMedia, query);
    const genreHints = detectGenres(query);

    const ai = getClient();
    const pool = fromWatchlist
      ? await buildWatchlistPool(prisma, { mediaType, genres: genreHints })
      : await buildCandidatePool(prisma);
    const { tasteProfile, seeds } = pool;
    let candidates = pool.candidates;

    // Discover pool still needs a post-filter; watchlist already filtered in builder.
    if (!fromWatchlist && mediaType) {
      candidates = candidates.filter((c) => c.mediaType === mediaType);
    }

    const matchedGenres =
      genreHints.length > 0
        ? candidates.filter((c) =>
            genreHints.some((hint) =>
              (c.genres || []).some((g) => String(g).toLowerCase() === hint.toLowerCase())
            )
          )
        : [];

    // Hard-filter to requested genres when we have enough matches;
    // otherwise keep the broader pool and tell the model to prefer those genres.
    const genreFiltered =
      matchedGenres.length > 0 &&
      (fromWatchlist ? matchedGenres.length >= 1 : matchedGenres.length >= Math.min(6, REC_COUNT));

    if (genreFiltered) {
      candidates = matchedGenres;
    }

    candidates = reindexCandidates(candidates);

    const targetCount = Math.min(REC_COUNT, candidates.length);
    const mediaLabel = mediaType === 'tv' ? 'TV shows' : mediaType === 'movie' ? 'movies' : null;
    const genreLabel = genreHints.length ? genreHints.join('/') : null;

    if (candidates.length === 0) {
      return res.status(422).json({
        error: fromWatchlist
          ? genreLabel && mediaLabel
            ? `No ${genreLabel.toLowerCase()} ${mediaLabel} on your watchlist.`
            : mediaLabel
              ? `No ${mediaLabel} on your watchlist match that request.`
              : 'Your watchlist is empty. Add titles first, or switch to Discover.'
          : genreLabel && mediaLabel
            ? `Not enough ${genreLabel.toLowerCase()} ${mediaLabel} in the candidate pool. Try a broader request.`
            : mediaLabel
              ? `Not enough ${mediaLabel} in the candidate pool. Try a broader request.`
              : 'Not enough candidates to recommend. Rate more watched titles or add TMDB-linked entries first.',
        candidateCount: 0,
        source,
        mediaType: mediaType || 'any',
        genres: genreHints,
      });
    }

    if (!fromWatchlist && candidates.length < Math.min(REC_COUNT, 6)) {
      return res.status(422).json({
        error: mediaLabel
          ? `Not enough ${mediaLabel} in the candidate pool. Try a broader request.`
          : 'Not enough candidates to recommend. Rate more watched titles or add TMDB-linked entries first.',
        candidateCount: candidates.length,
        source,
        mediaType: mediaType || 'any',
        genres: genreHints,
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
      mediaTypeFilter: mediaType || 'any',
      genreFilter: genreFiltered ? genreHints : [],
      preferGenres: !genreFiltered ? genreHints : [],
      tasteProfile,
      seedTitlesUsedForPool: seeds,
      candidates: poolForModel,
    });

    const mediaRule = mediaType
      ? `- The candidate pool is already filtered to ${mediaLabel} only. Do not suggest any other media type.`
      : '- Prefer diversity: mix media types when appropriate, avoid near-duplicates.';
    const genreRule = genreFiltered
      ? `- The candidate pool is already filtered to genres: ${genreHints.join(', ')}.`
      : genreHints.length
        ? `- Prefer titles matching these genres when possible: ${genreHints.join(', ')}.`
        : '';

    const systemInstruction = fromWatchlist
      ? `You are CineLog's recommendation engine helping the user pick what to watch next from their existing watchlist.

Rules:
- You MUST pick ONLY from the candidate pool (their watchlist) provided in the user message.
- candidateId MUST be copied exactly from a candidate's "id" field (like "c0", "c3"). Never invent ids.
- Never invent titles, years, or ids that are not in the pool.
- Return up to ${targetCount} recommendations, ranked best-first for the request (fewer is fine if the pool is smaller).
${mediaRule}
${genreRule}
- Prefer diversity when the request is open-ended.
- Tag each pick as matches_taste (fits their ratings/taste) or popular_pick (safer / broader mood fit).
- Reasons should be specific to the user's request and brief (one sentence).`
      : `You are CineLog's recommendation engine for a single user's personal movie/TV library.

Rules:
- You MUST pick ONLY from the candidate pool provided in the user message.
- candidateId MUST be copied exactly from a candidate's "id" field (like "c0", "c3"). Never invent ids.
- Never invent titles, years, or ids that are not in the pool.
- Return exactly ${targetCount} recommendations (or fewer only if the pool is smaller than ${targetCount}).
${mediaRule}
${genreRule}
- Tag each pick as matches_taste (fits their ratings) or popular_pick (broader appeal).
- Reasons should be specific to the user's request and brief (one sentence).`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: fromWatchlist
        ? `Pick the best titles from my watchlist for this request (up to ${targetCount}). Use only candidate ids from the JSON. Candidate pool and taste profile follow as JSON:\n${userContent}`
        : `Recommend exactly ${targetCount} titles for this request (fewer only if the pool is smaller). Use only candidate ids from the JSON. Candidate pool and taste profile follow as JSON:\n${userContent}`,
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
                    description: 'Exact candidate id from the pool (e.g. c0, c12)',
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
        mediaType,
        genreHints,
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
        mediaType,
        genreHints,
      });
      return res.status(502).json({
        error: parseErr.message || 'Model did not return valid JSON recommendations',
      });
    }

    if (!Array.isArray(parsed?.recommendations)) {
      return res.status(502).json({ error: 'Model did not return structured recommendations' });
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const byTitle = new Map(candidates.map((c) => [normalizeTitle(c.title), c]));
    const seen = new Set();
    const recommendations = [];

    for (const pick of parsed.recommendations) {
      const candidate = resolveCandidate(pick, byId, byTitle);
      if (!candidate || seen.has(candidate.id)) continue;
      if (mediaType && candidate.mediaType !== mediaType) continue;
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
      console.error('POST /api/recs unmatched picks', {
        source,
        mediaType,
        genreHints,
        poolSize: candidates.length,
        returnedIds: parsed.recommendations.map((p) => p.candidateId).slice(0, 20),
      });
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
        mediaType: mediaType || 'any',
        genres: genreHints,
        genreFiltered,
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
