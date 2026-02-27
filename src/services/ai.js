const OLLAMA_BASE_URL = (import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434')
  .trim()
  .replace(/\/+$/, '');
const OLLAMA_MODEL = (import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1').trim();
const MAX_SUMMARY_TEXT = 12000;
const MAX_CHARACTER_MAP_TEXT = 9000;
const RELATIONSHIP_TYPES = new Set([
  'friend',
  'enemy',
  'family',
  'romantic',
  'mentor',
  'rival',
  'ally',
  'colleague',
  'leader',
  'follower',
  'guardian',
  'unknown'
]);
const FAMILY_SUBTYPES = new Set([
  'parent_of',
  'child_of',
  'spouse_of',
  'sibling_of',
  'grandparent_of',
  'grandchild_of',
  'other_family',
  'none'
]);
const CITATION_POSITIONS = new Set(['start', 'middle', 'end', 'unknown']);

const normalizeText = (value) => (value || '').toString().replace(/\s+/g, ' ').trim();
const clamp01 = (value, fallback = 0.5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

const createEmptyCharacterMap = () => ({ characters: [], relationships: [] });
const NAME_STOPWORDS = new Set([
  'Chapter',
  'CHAPTER',
  'The',
  'A',
  'An',
  'And',
  'But',
  'Or',
  'In',
  'On',
  'At',
  'To',
  'From',
  'He',
  'She',
  'They',
  'His',
  'Her',
  'Their',
  'I',
  'We',
  'You',
  'It',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]);
const NON_CHARACTER_KEYWORDS = [
  'copyright',
  'licensing',
  'agency',
  'press',
  'publishing',
  'publication',
  'newspaper',
  'magazine',
  'times',
  'telegraph',
  'library',
  'patents',
  'act',
  'isbn',
  'headline',
  'design',
  'group',
  'company',
  'house',
  'data',
  'embankment',
  'london',
  'rights reserved'
];

const callOllama = async (prompt) => {
  if (!OLLAMA_MODEL) {
    return { text: '', error: 'Missing Ollama model. Set VITE_OLLAMA_MODEL in your environment.' };
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || `AI request failed (${response.status})`;
      return { text: '', error: message, status: response.status };
    }

    if (typeof data?.response === 'string' && data.response.trim()) {
      return { text: data.response.trim(), error: '' };
    }
    return { text: '', error: 'AI returned no content' };
  } catch (error) {
    console.error('AI Failure:', error);
    return { text: '', error: error?.message || 'AI request failed' };
  }
};

const parseJsonObject = (rawText) => {
  const text = (rawText || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {}

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch (_) {}
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (_) {}
  }
  return null;
};

const buildExcludeSet = (excludeNames = []) => {
  const excludeSet = new Set();
  (Array.isArray(excludeNames) ? excludeNames : []).forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (!normalized) return;
    excludeSet.add(normalized);
    normalized.split(' ').forEach((token) => {
      if (token.length >= 3) excludeSet.add(token);
    });
  });
  return excludeSet;
};

const looksLikeNonCharacterEntity = (value, strictStoryCharacters = false) => {
  const clean = normalizeText(value).toLowerCase();
  if (!clean) return false;
  if (NON_CHARACTER_KEYWORDS.some((term) => clean.includes(term))) return true;
  if (!strictStoryCharacters) return false;
  const tokenCount = clean.split(/\s+/).length;
  if (tokenCount >= 4) return true;
  if (/\b(inc|ltd|llc|corp|co)\b/.test(clean)) return true;
  return false;
};

const filterCharacterMap = (map, excludeNames = [], options = {}) => {
  const excludeSet = buildExcludeSet(excludeNames);
  const strictStoryCharacters = Boolean(options?.strictStoryCharacters);

  const allowedCharacters = (map.characters || []).filter((character) => {
    const name = normalizeText(character?.name).toLowerCase();
    if (!name) return false;
    if (looksLikeNonCharacterEntity(name, strictStoryCharacters)) return false;
    if (excludeSet.has(name)) return false;
    const tokens = name.split(' ');
    return !tokens.every((token) => excludeSet.has(token));
  });
  const allowedNames = new Set(allowedCharacters.map((character) => character.name.toLowerCase()));

  const allowedRelationships = (map.relationships || []).filter((relationship) => {
    const source = normalizeText(relationship?.source).toLowerCase();
    const target = normalizeText(relationship?.target).toLowerCase();
    if (!source || !target) return false;
    return allowedNames.has(source) && allowedNames.has(target);
  });

  return {
    characters: allowedCharacters,
    relationships: allowedRelationships
  };
};

const extractFallbackCharacters = (rawText, limit = 12, excludeNames = []) => {
  const text = normalizeText(rawText).slice(0, 12000);
  if (!text) return [];
  const excludeSet = buildExcludeSet(excludeNames);

  const counts = new Map();
  const pattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g;
  let match;
  while ((match = pattern.exec(text))) {
    const candidate = normalizeText(match[1]);
    if (!candidate) continue;
    if (candidate.length < 3 || candidate.length > 40) continue;
    const candidateLower = candidate.toLowerCase();
    if (excludeSet.has(candidateLower)) continue;
    const tokens = candidate.split(' ');
    if (!tokens.length) continue;
    if (tokens.every((token) => NAME_STOPWORDS.has(token))) continue;
    if (NAME_STOPWORDS.has(tokens[0])) continue;
    if (tokens.every((token) => excludeSet.has(token.toLowerCase()))) continue;
    const key = candidate.toLowerCase();
    counts.set(key, { name: candidate, count: (counts.get(key)?.count || 0) + 1 });
  }

  return [...counts.values()]
    .filter((item) => item.count >= 2 || item.name.split(' ').length > 1)
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((item) => ({ name: item.name, aliases: [] }));
};

const sanitizeCharacterMap = (raw, chapterFallback = {}) => {
  if (!raw || typeof raw !== 'object') return createEmptyCharacterMap();

  const characters = Array.isArray(raw.characters) ? raw.characters : [];
  const relationships = Array.isArray(raw.relationships) ? raw.relationships : [];
  const characterByKey = new Map();

  const putCharacter = (item) => {
    const canonicalName = normalizeText(item?.name);
    if (!canonicalName) return null;
    const key = canonicalName.toLowerCase();
    const aliases = Array.isArray(item?.aliases)
      ? item.aliases.map((alias) => normalizeText(alias)).filter(Boolean)
      : [];

    if (!characterByKey.has(key)) {
      characterByKey.set(key, { name: canonicalName, aliases: [] });
    }
    const current = characterByKey.get(key);
    const mergedAliases = new Set(current.aliases);
    aliases.forEach((alias) => {
      if (alias.toLowerCase() !== key) mergedAliases.add(alias);
    });
    current.aliases = [...mergedAliases];
    return current.name;
  };

  characters.forEach((character) => {
    putCharacter(character);
  });

  const aliasToCanonical = new Map();
  characterByKey.forEach((character, key) => {
    aliasToCanonical.set(key, character.name);
    character.aliases.forEach((alias) => aliasToCanonical.set(alias.toLowerCase(), character.name));
  });

  const normalizeNameWithAlias = (value) => {
    const clean = normalizeText(value);
    if (!clean) return '';
    const aliasHit = aliasToCanonical.get(clean.toLowerCase());
    if (aliasHit) return aliasHit;
    const key = clean.toLowerCase();
    if (!characterByKey.has(key)) {
      characterByKey.set(key, { name: clean, aliases: [] });
      aliasToCanonical.set(key, clean);
    }
    return clean;
  };

  const normalizeCitation = (citation) => {
    const chapterHref = normalizeText(citation?.chapterHref || chapterFallback.chapterHref || '');
    const chapterLabel = normalizeText(citation?.chapterLabel || chapterFallback.chapterLabel || '');
    const rawPosition = normalizeText(citation?.position).toLowerCase();
    const position = CITATION_POSITIONS.has(rawPosition) ? rawPosition : 'unknown';
    const quote = normalizeText(citation?.quote || '').slice(0, 280);
    return { chapterHref, chapterLabel, position, quote };
  };

  const relationshipList = [];
  relationships.forEach((item) => {
    const source = normalizeNameWithAlias(item?.source);
    const target = normalizeNameWithAlias(item?.target);
    if (!source || !target || source.toLowerCase() === target.toLowerCase()) return;

    const rawType = normalizeText(item?.type).toLowerCase();
    const type = RELATIONSHIP_TYPES.has(rawType) ? rawType : 'unknown';
    const rawFamilySubtype = normalizeText(item?.familySubtype).toLowerCase();
    const familySubtype = type === 'family'
      ? (FAMILY_SUBTYPES.has(rawFamilySubtype) && rawFamilySubtype !== 'none' ? rawFamilySubtype : 'other_family')
      : 'none';
    const confidence = clamp01(item?.confidence, 0.45);
    const evidence = normalizeText(item?.evidence || '').slice(0, 400);
    const citations = (Array.isArray(item?.citations) ? item.citations : [])
      .map(normalizeCitation)
      .filter((citation) => citation.chapterHref || citation.chapterLabel || citation.quote);

    relationshipList.push({
      source,
      target,
      type,
      familySubtype,
      confidence,
      evidence,
      citations
    });
  });

  return {
    characters: [...characterByKey.values()].sort((left, right) => left.name.localeCompare(right.name)),
    relationships: relationshipList
  };
};

export const mergeCharacterRelationshipMaps = (...maps) => {
  const characterMap = new Map();
  const relationshipMap = new Map();

  maps.forEach((rawMap) => {
    const map = sanitizeCharacterMap(rawMap);
    map.characters.forEach((character) => {
      const key = character.name.toLowerCase();
      if (!characterMap.has(key)) {
        characterMap.set(key, { name: character.name, aliases: [...character.aliases] });
        return;
      }
      const existing = characterMap.get(key);
      const aliasSet = new Set([...existing.aliases, ...character.aliases]);
      existing.aliases = [...aliasSet];
    });

    map.relationships.forEach((relationship) => {
      const key = [
        relationship.source.toLowerCase(),
        relationship.target.toLowerCase(),
        relationship.type,
        relationship.familySubtype || 'none'
      ].join('|');
      if (!relationshipMap.has(key)) {
        relationshipMap.set(key, {
          ...relationship,
          citations: [...relationship.citations]
        });
        return;
      }
      const existing = relationshipMap.get(key);
      existing.confidence = Math.max(existing.confidence, relationship.confidence);
      if (!existing.evidence && relationship.evidence) existing.evidence = relationship.evidence;

      const seenCitations = new Set(
        existing.citations.map((citation) =>
          [citation.chapterHref, citation.chapterLabel, citation.position, citation.quote].join('|')
        )
      );
      relationship.citations.forEach((citation) => {
        const citationKey = [citation.chapterHref, citation.chapterLabel, citation.position, citation.quote].join('|');
        if (seenCitations.has(citationKey)) return;
        seenCitations.add(citationKey);
        existing.citations.push(citation);
      });
    });
  });

  return {
    characters: [...characterMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
    relationships: [...relationshipMap.values()].sort((left, right) => right.confidence - left.confidence)
  };
};

export async function extractCharacterRelationshipMap(chapterText, chapterMeta = {}, options = {}) {
  const safeText = typeof chapterText === 'string' ? chapterText : '';
  const trimmed = safeText.trim();
  if (!trimmed) return { map: createEmptyCharacterMap(), error: '' };

  const truncatedText = trimmed.slice(0, MAX_CHARACTER_MAP_TEXT);
  const chapterHref = normalizeText(chapterMeta.chapterHref || '');
  const chapterLabel = normalizeText(chapterMeta.chapterLabel || '');
  const excludeNames = Array.isArray(options?.excludeNames) ? options.excludeNames : [];
  const strictStoryCharacters = options?.strictStoryCharacters !== false;

  const prompt = `
You extract character entities and relationships from fiction text.
Return STRICT JSON only (no markdown, no prose).
Only include in-story people/creatures/entities acting as characters.
Never include author names, publishers, organizations, publications, legal terms, locations, metadata, chapter labels, or template placeholders.
If evidence is weak, omit the relationship.
Precision over recall.

Allowed relationship type values:
friend, enemy, family, romantic, mentor, rival, ally, colleague, leader, follower, guardian, unknown

Allowed familySubtype values (only when type=family):
parent_of, child_of, spouse_of, sibling_of, grandparent_of, grandchild_of, other_family

Direction rules (mandatory):
- parent_of: source is parent, target is child
- child_of: source is child, target is parent
- spouse_of: symmetric (emit once)
- sibling_of: symmetric (emit once)
- if family is clear but direction unclear: familySubtype=other_family

For each relationship:
- include confidence from 0.0 to 1.0
- include at least one citation with chapterHref/chapterLabel and position: start|middle|end|unknown
- include short evidence text
- output only when evidence exists in text

JSON schema:
{
  "characters": [
    { "name": "Name", "aliases": ["Alias A", "Alias B"] }
  ],
  "relationships": [
    {
      "source": "Character A",
      "target": "Character B",
      "type": "friend",
      "familySubtype": "none",
      "confidence": 0.72,
      "evidence": "short reason",
      "citations": [
        {
          "chapterHref": "${chapterHref}",
          "chapterLabel": "${chapterLabel}",
          "position": "middle",
          "quote": "short quoted text"
        }
      ]
    }
  ]
}

CHAPTER HREF: ${chapterHref || 'unknown'}
CHAPTER LABEL: ${chapterLabel || 'unknown'}
TEXT:
${truncatedText}
  `;

  const result = await callOllama(prompt);
  if (result.error) return { map: createEmptyCharacterMap(), error: result.error };

  const parsed = parseJsonObject(result.text);
  if (!parsed) {
    const fallbackCharacters = extractFallbackCharacters(truncatedText, 12, excludeNames);
    if (fallbackCharacters.length) {
      return {
        map: filterCharacterMap(
          sanitizeCharacterMap(
            {
              characters: fallbackCharacters,
              relationships: []
            },
            { chapterHref, chapterLabel }
          ),
          excludeNames,
          { strictStoryCharacters }
        ),
        error: 'Character map JSON parse failed. Used fallback name extraction.'
      };
    }
    return { map: createEmptyCharacterMap(), error: 'Character map JSON parse failed.' };
  }

  const sanitized = filterCharacterMap(
    sanitizeCharacterMap(parsed, { chapterHref, chapterLabel }),
    excludeNames,
    { strictStoryCharacters }
  );
  if (!sanitized.characters.length && !sanitized.relationships.length) {
    const fallbackCharacters = extractFallbackCharacters(truncatedText, 12, excludeNames);
    if (fallbackCharacters.length) {
      return {
        map: filterCharacterMap(
          sanitizeCharacterMap(
            {
              characters: fallbackCharacters,
              relationships: []
            },
            { chapterHref, chapterLabel }
          ),
          excludeNames,
          { strictStoryCharacters }
        ),
        error: 'Model returned empty extraction. Used fallback name extraction.'
      };
    }
  }

  return { map: sanitized, error: '' };
}

export async function inferCharacterRelationshipsFromEvidence(chapters = [], knownCharacters = [], options = {}) {
  const normalizedCharacters = (Array.isArray(knownCharacters) ? knownCharacters : [])
    .map((item) => normalizeText(item?.name || item))
    .filter(Boolean)
    .slice(0, 80);
  if (normalizedCharacters.length < 2) {
    return { map: createEmptyCharacterMap(), error: '' };
  }

  const condensedChapters = (Array.isArray(chapters) ? chapters : [])
    .map((item) => ({
      chapterHref: normalizeText(item?.chapterHref || ''),
      chapterLabel: normalizeText(item?.chapterLabel || ''),
      text: normalizeText(item?.text || '').slice(0, 1200)
    }))
    .filter((item) => item.text);
  if (!condensedChapters.length) {
    return { map: createEmptyCharacterMap(), error: '' };
  }

  const evidenceBlock = condensedChapters
    .slice(0, 40)
    .map((item, index) => `CHAPTER ${index + 1} | href=${item.chapterHref} | label=${item.chapterLabel}\n${item.text}`)
    .join('\n\n');

  const prompt = `
Infer character relationships from chapter evidence.
Use only these known characters:
${normalizedCharacters.join(', ')}
Do NOT invent new names.
Only include in-story character relationships with direct textual evidence.
If unsure, omit.

Return STRICT JSON only:
{
  "relationships": [
    {
      "source": "Character A",
      "target": "Character B",
      "type": "family",
      "familySubtype": "parent_of",
      "confidence": 0.68,
      "evidence": "short reason",
      "citations": [
        {
          "chapterHref": "ch01.xhtml",
          "chapterLabel": "Chapter 1",
          "position": "middle",
          "quote": "short quote"
        }
      ]
    }
  ]
}

Only include relationships with direct evidence in provided chapters.
Allowed types: friend, enemy, family, romantic, mentor, rival, ally, colleague, leader, follower, guardian, unknown.
Allowed familySubtype values when type=family: parent_of, child_of, spouse_of, sibling_of, grandparent_of, grandchild_of, other_family.
Direction rules: parent_of (parent -> child), child_of (child -> parent), spouse_of/sibling_of symmetric (emit once).
If no reliable relationships, return an empty array.

EVIDENCE:
${evidenceBlock}
  `;

  const result = await callOllama(prompt);
  if (result.error) return { map: createEmptyCharacterMap(), error: result.error };
  const parsed = parseJsonObject(result.text);
  if (!parsed || !Array.isArray(parsed.relationships)) {
    return { map: createEmptyCharacterMap(), error: 'Relationship reconciliation parse failed.' };
  }

  const baseCharacters = normalizedCharacters.map((name) => ({ name, aliases: [] }));
  const map = sanitizeCharacterMap({
    characters: baseCharacters,
    relationships: parsed.relationships
  });
  return {
    map: filterCharacterMap(map, options?.excludeNames || [], { strictStoryCharacters: true }),
    error: ''
  };
}

/**
 * Generate a natural language summary for a portion of text.  The summarization
 * logic supports multiple modes:
 *
 *   • "cumulative" – Treat the provided text as a continuation of the
 *     existing story memory.  The AI will blend the new content with
 *     previously summarised material to build a running narrative.  This
 *     mode is used for the background chronicler feature.
 *
 *   • "snapshot" – Analyse the provided text as an isolated scene.  The AI
 *     must ignore any prior context and focus on the immediate atmosphere,
 *     characters present and their psychological state.  The resulting
 *     summary should not rely on or update the story memory.
 *
 *   • "contextual" – Explain the provided text in the context of the story
 *     memory.  This is used for the "Explain Page" action and does not
 *     update the story memory.
 *
 *   • "recap" – Produce a story-so-far recap using only the story memory.
 *
 * The returned object always contains a "text" field (possibly empty) and
 * an "error" field when the request fails.
 *
 * @param {string} text             The raw text to summarise.
 * @param {string} previousMemory   The running summary built so far (ignored in snapshot mode).
 * @param {string} mode             One of "cumulative", "snapshot", "contextual", "recap".
 */
export async function summarizeChapter(text, previousMemory = "", mode = "cumulative") {
  // Limit the amount of text sent to the API to avoid extremely long prompts.
  const safeText = typeof text === 'string' ? text : '';
  const truncatedText = safeText.substring(0, MAX_SUMMARY_TEXT);

  // Choose the appropriate instruction set based on the requested mode.
  let instructions;
  if (mode === 'snapshot') {
    instructions = `You are an observer. Analyze ONLY the provided text as an isolated snapshot. Ignore all previous context. Focus on the immediate atmosphere, present characters, and current psychological state. ALWAYS use the exact labels "Summary:" and "Characters so far:".`;
  } else if (mode === 'contextual') {
    instructions = `You are a literary explainer. Use the Story Memory to explain the Current Content in context. Focus on what is happening right now and how it connects to prior events. Do not rewrite the entire story. ALWAYS use the exact labels "Summary:" and "Characters so far:".`;
  } else if (mode === 'recap') {
    instructions = `You are a recapper. Use the Story Memory to write a clear, chronological recap of the story so far. If Current Content is provided, treat it as the most recent scene. Do not introduce new events. ALWAYS use the exact labels "Summary:" and "Characters so far:".`;
  } else {
    // Default to cumulative mode (the chronicler).
    instructions = `You are a chronicler. Use the 'New Content' to update the 'Story Memory'. Write a fluid, direct narrative. Focus on plot progression and character psychology. ALWAYS use the exact labels "Summary:" and "Characters so far:".`;
  }

  const hasMemory = typeof previousMemory === 'string' && previousMemory.trim().length > 0;
  const hasContent = typeof truncatedText === 'string' && truncatedText.trim().length > 0;

  // In snapshot mode we must not include any story memory.
  const memorySection = mode === 'snapshot' || !hasMemory ? '' : `STORY MEMORY: ${previousMemory}\n\n`;
  const contentSection = !hasContent ? '' : `CURRENT CONTENT: ${truncatedText}\n\n`;

  // Construct the prompt for the generative model.  We avoid technical
  // artefacts such as explicit header counts or apology phrases.  The model
  // receives simple instructions and the raw content to analyse.
  const prompt = `
${instructions}

${contentSection}${memorySection}
RESPONSE FORMAT:
Summary:
[Your elegant analysis here]

Characters so far:
[Bullet points of characters and their current states]
  `;

  return callOllama(prompt);
}
