const OLLAMA_BASE_URL = (import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434')
  .trim()
  .replace(/\/+$/, '');
const OLLAMA_MODEL = (import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1').trim();

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
  if (!OLLAMA_MODEL) {
    return { text: '', error: 'Missing Ollama model. Set VITE_OLLAMA_MODEL in your environment.' };
  }

  // Limit the amount of text sent to the API to avoid extremely long prompts.
  const safeText = typeof text === 'string' ? text : '';
  const truncatedText = safeText.substring(0, 12000);

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
}
