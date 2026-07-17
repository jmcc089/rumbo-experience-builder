// Rumbo · SBI-06: DeepSeek chat-completion client (OpenAI-compatible endpoint).
// Narrow use only: free-text constraint extraction + provider instruction phrasing.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

/**
 * Calls DeepSeek asking for raw JSON content (no prose, no markdown fences).
 * Returns the raw string content, or null on any failure (network, non-200, missing key).
 * Callers are responsible for JSON.parse + Zod validation and safe-default fallback.
 */
export async function callDeepSeekJson(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}
