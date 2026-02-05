const GEMINI_API_KEY = 'AIzaSyA2M--9WlwcgAYlmouZuYcvEUhfCCycnhs';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
 * The returned string always contains the labels "Summary:" and
 * "Characters so far:".  If the AI fails to return a valid result the
 * function resolves to an empty string.
 *
 * @param {string} text             The raw text to summarise.
 * @param {string} previousMemory   The running summary built so far (ignored in snapshot mode).
 * @param {string} mode             One of "cumulative", "snapshot", "contextual", "recap".
 */
export async function summarizeChapter(text, previousMemory = "", mode = "cumulative") {
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
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    // The API returns an array of candidate responses.  We pick the first
    // candidate and extract its text content.  If no candidate is available
    // we fall back to the empty string.
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    return '';
  } catch (error) {
    console.error('AI Failure:', error);
    return '';
  }
}
