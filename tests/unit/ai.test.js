import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  summarizeChapter,
  extractCharacterRelationshipMap,
  inferCharacterRelationshipsFromEvidence,
  mergeCharacterRelationshipMaps
} from '../../src/services/ai';

describe('summarizeChapter (Ollama)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns trimmed response text from Ollama', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ response: '  Summary: Hello world  ' })
    });

    const result = await summarizeChapter('Some text', 'Story memory', 'cumulative');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/generate$/);
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(false);
    expect(typeof body.prompt).toBe('string');
    expect(result).toEqual({ text: 'Summary: Hello world', error: '' });
  });

  it('returns API error message when Ollama responds with error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'ollama unavailable' })
    });

    const result = await summarizeChapter('Some text');

    expect(result).toEqual({ text: '', error: 'ollama unavailable', status: 503 });
  });

  it('returns no-content error when Ollama response is missing text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const result = await summarizeChapter('Some text');
    expect(result).toEqual({ text: '', error: 'AI returned no content' });
  });

  it('returns failure error when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await summarizeChapter('Some text');
    expect(result).toEqual({ text: '', error: 'network down' });
  });
});

describe('character relationship map extraction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses JSON and normalizes relationship fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          characters: [{ name: 'Elizabeth Bennet', aliases: ['Lizzy'] }],
          relationships: [
            {
              source: 'Lizzy',
              target: 'Mr. Darcy',
              type: 'romantic',
              confidence: 0.84,
              evidence: 'They express growing affection.',
              citations: [{ chapterLabel: 'Chapter 5', position: 'middle', quote: '...affection...' }]
            }
          ]
        })
      })
    });

    const result = await extractCharacterRelationshipMap('text', {
      chapterHref: 'chapter-5.xhtml',
      chapterLabel: 'Chapter 5'
    });

    expect(result.error).toBe('');
    expect(result.map.characters).toEqual([
      { name: 'Elizabeth Bennet', aliases: ['Lizzy'] },
      { name: 'Mr. Darcy', aliases: [] }
    ]);
    expect(result.map.relationships[0]).toMatchObject({
      source: 'Elizabeth Bennet',
      target: 'Mr. Darcy',
      type: 'romantic'
    });
    expect(result.map.relationships[0].citations[0]).toMatchObject({
      chapterHref: 'chapter-5.xhtml',
      chapterLabel: 'Chapter 5',
      position: 'middle'
    });
  });

  it('returns parse error on malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'not-json' })
    });

    const result = await extractCharacterRelationshipMap('text');
    expect(result.error).toBe('Character map JSON parse failed.');
    expect(result.map).toEqual({ characters: [], relationships: [] });
  });

  it('uses fallback character extraction when model returns empty map', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{"characters":[],"relationships":[]}' })
    });

    const result = await extractCharacterRelationshipMap(
      'Hamnet met Agnes. Agnes spoke to Hamnet again while Judith listened. Hamnet and Judith walked away.'
    );

    expect(result.error).toContain('fallback name extraction');
    expect(result.map.characters.length).toBeGreaterThan(0);
    const names = result.map.characters.map((item) => item.name);
    expect(names).toContain('Hamnet');
  });

  it('filters excluded metadata names from extraction', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{"characters":[],"relationships":[]}' })
    });

    const result = await extractCharacterRelationshipMap(
      "Maggie O'Farrell wrote Hamnet. Hamnet spoke to Agnes. Hamnet met Agnes again.",
      {},
      { excludeNames: ["Maggie O'Farrell"] }
    );

    const names = result.map.characters.map((item) => item.name);
    expect(names).not.toContain("Maggie O'Farrell");
    expect(names).toContain('Hamnet');
  });

  it('filters organization/publication entities in strict story mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          characters: [
            { name: 'British Library', aliases: [] },
            { name: 'Agnes', aliases: [] }
          ],
          relationships: []
        })
      })
    });

    const result = await extractCharacterRelationshipMap('text', {}, { strictStoryCharacters: true });
    const names = result.map.characters.map((item) => item.name);
    expect(names).not.toContain('British Library');
    expect(names).toContain('Agnes');
  });
});

describe('mergeCharacterRelationshipMaps', () => {
  it('deduplicates relationships and keeps highest confidence', () => {
    const merged = mergeCharacterRelationshipMaps(
      {
        characters: [{ name: 'Alice', aliases: ['Al'] }],
        relationships: [
          {
            source: 'Alice',
            target: 'Bob',
            type: 'friend',
            confidence: 0.51,
            citations: [{ chapterLabel: 'Chapter 1', position: 'start', quote: 'hello' }]
          }
        ]
      },
      {
        characters: [{ name: 'alice', aliases: ['A.'] }, { name: 'Bob', aliases: [] }],
        relationships: [
          {
            source: 'Alice',
            target: 'Bob',
            type: 'friend',
            confidence: 0.87,
            citations: [{ chapterLabel: 'Chapter 2', position: 'middle', quote: 'trust' }]
          }
        ]
      }
    );

    expect(merged.characters).toEqual([
      { name: 'Alice', aliases: ['Al', 'A.'] },
      { name: 'Bob', aliases: [] }
    ]);
    expect(merged.relationships).toHaveLength(1);
    expect(merged.relationships[0].confidence).toBe(0.87);
    expect(merged.relationships[0].citations).toHaveLength(2);
  });
});

describe('inferCharacterRelationshipsFromEvidence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses reconciliation relationships', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          relationships: [
            {
              source: 'Hamnet',
              target: 'Agnes',
              type: 'family',
              confidence: 0.82,
              citations: [{ chapterLabel: 'Chapter 2', position: 'middle', quote: 'their son' }]
            }
          ]
        })
      })
    });

    const result = await inferCharacterRelationshipsFromEvidence(
      [{ chapterLabel: 'Chapter 2', text: 'Agnes mourned with Hamnet nearby.' }],
      ['Hamnet', 'Agnes']
    );

    expect(result.error).toBe('');
    expect(result.map.relationships).toHaveLength(1);
    expect(result.map.relationships[0].type).toBe('family');
  });
});
