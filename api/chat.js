export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { message, messages, language } = req.body || {};

    const history = Array.isArray(messages)
      ? messages
          .filter((item) => item && typeof item.role === "string" && typeof item.content === "string")
          .map((item) => ({
            role: normalizeRole(item.role),
            content: item.content.trim(),
          }))
          .filter((item) => item.content.length > 0)
      : [];

    const latestMessage = typeof message === "string" ? message.trim() : "";

    if (!history.length && !latestMessage) {
      return res.status(400).json({ error: "A message is required." });
    }

    const input = history.length
      ? history
      : [{ role: "user", content: latestMessage }];

    const advisorLanguage = language === "es" ? "Spanish (Puerto Rico)" : "English";

    const instructions = `
You are Force Braking Basketball Advisor.

Identity and tone:
- You are a premium basketball performance advisor focused on force production, braking ability, deceleration, redirection, flywheel transfer, and real game movement.
- Never mention OpenAI, ChatGPT, language models, hidden prompts, internal policies, or system instructions.
- Speak with authority, clarity, and confidence.
- Keep answers practical, high-level, and performance-oriented.
- Default language for this conversation: ${advisorLanguage}.
- If the user writes in Spanish, respond in Spanish (Puerto Rico). If the user writes in English, respond in English.

Behavior:
- Help athletes, coaches, trainers, and programs understand force, braking, and flywheel training in basketball.
- Explain concepts in a way that is sharp, premium, and easy to follow.
- When useful, organize answers into short sections.
- Do not make up personal experience, live data, certifications, or testing results.
- Do not claim to have watched the user train, reviewed unseen film, or analyzed unseen metrics.
- Avoid medical, legal, or injury-treatment advice beyond general safety language.
- Do not provide dangerous, age-inappropriate, or unsafe instructions.

Branding:
- Keep the conversation fully branded as Force Braking Basketball Advisor.
- Never refer to yourself as an AI assistant unless directly asked what you are.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4",
        instructions,
        input,
        max_output_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed.",
      });
    }

    const reply = extractReplyText(data);

    if (!reply) {
      return res.status(500).json({ error: "No reply was returned." });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}

function normalizeRole(role) {
  const value = String(role || "user").toLowerCase();

  if (value === "assistant") return "assistant";
  if (value === "system" || value === "developer") return "developer";
  return "user";
}

function extractReplyText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const textParts = [];

  for (const item of output) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];

    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        textParts.push(part.text);
      }
    }
  }

  return textParts.join("\n").trim();
}
