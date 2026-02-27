import { afterEach, describe, expect, it, vi } from 'vitest';
import { summarizeChapter } from '../../src/services/ai';

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
