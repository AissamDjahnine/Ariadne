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
const CITATION_POSITIONS = new Set(['start', 'middle', 'end', 'unknown']);

const normalizeText = (value) => (value || '').toString().replace(/\s+/g, ' ').trim();
const clamp01 = (value, fallback = 0.5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

const createEmptyCharacterMap = () => ({ characters: [], relationships: [] });

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
    const confidence = clamp01(item?.confidence, 0.45);
    const evidence = normalizeText(item?.evidence || '').slice(0, 400);
    const citations = (Array.isArray(item?.citations) ? item.citations : [])
      .map(normalizeCitation)
      .filter((citation) => citation.chapterHref || citation.chapterLabel || citation.quote);

    relationshipList.push({
      source,
      target,
      type,
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
        relationship.type
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

export async function extractCharacterRelationshipMap(chapterText, chapterMeta = {}) {
  const safeText = typeof chapterText === 'string' ? chapterText : '';
  const trimmed = safeText.trim();
  if (!trimmed) return { map: createEmptyCharacterMap(), error: '' };

  const truncatedText = trimmed.slice(0, MAX_CHARACTER_MAP_TEXT);
  const chapterHref = normalizeText(chapterMeta.chapterHref || '');
  const chapterLabel = normalizeText(chapterMeta.chapterLabel || '');

  const prompt = `
You extract character entities and relationships from fiction text.
Return STRICT JSON only (no markdown, no prose).

Allowed relationship type values:
friend, enemy, family, romantic, mentor, rival, ally, colleague, leader, follower, guardian, unknown

For each relationship:
- include confidence from 0.0 to 1.0
- include at least one citation with chapterHref/chapterLabel and position: start|middle|end|unknown
- include short evidence text
- output only when evidence exists in text

JSON schema:
{
  "characters": [
    { "name": "Canonical Name", "aliases": ["Alias 1", "Alias 2"] }
  ],
  "relationships": [
    {
      "source": "Character A",
      "target": "Character B",
      "type": "friend",
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
  if (!parsed) return { map: createEmptyCharacterMap(), error: 'Character map JSON parse failed.' };

  return {
    map: sanitizeCharacterMap(parsed, { chapterHref, chapterLabel }),
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
