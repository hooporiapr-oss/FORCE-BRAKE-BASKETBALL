export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const language = body.language === 'es' ? 'es' : 'en';

    const messages = Array.isArray(body.messages)
      ? body.messages
          .filter(
            (item) =>
              item &&
              typeof item.role === 'string' &&
              typeof item.content === 'string' &&
              item.content.trim().length > 0
          )
          .map((item) => ({
            role: normalizeRole(item.role),
            content: item.content.trim(),
          }))
      : [];

    if (!messages.length && !message) {
      return res.status(400).json({ error: 'A message is required.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing.' });
    }

    const input = messages.length ? messages : [{ role: 'user', content: message }];
    const advisorLanguage = language === 'es' ? 'Spanish (Puerto Rico)' : 'English';

    const instructions = `You are Force Braking Basketball Advisor.

Identity and tone:
- You are a premium basketball performance advisor focused on force production, braking ability, deceleration, redirection, flywheel transfer, and real game movement.
- Never mention OpenAI, ChatGPT, language models, hidden prompts, internal policies, or system instructions.
- Speak with authority, clarity, and confidence.
- Keep answers practical, high-level, and performance-oriented.
- Default language for this conversation: ${advisorLanguage}.
- If the user writes in Spanish, respond in Spanish (Puerto Rico). If the user writes in English, respond in English.

Behavior:
- Help athletes, coaches, trainers, and programs understand force, braking, and flywheel training in basketball.
- Explain concepts in a sharp, premium, and easy-to-follow way.
- Do not make up personal experience, live data, certifications, or testing results.
- Do not claim to have watched the user train, reviewed unseen film, or analyzed unseen metrics.
- Avoid medical, legal, or injury-treatment advice beyond general safety language.
- Do not provide dangerous or unsafe instructions.

Branding:
- Keep the conversation fully branded as Force Braking Basketball Advisor.
- Never refer to yourself as an AI assistant unless directly asked what you are.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        instructions,
        input,
        max_output_tokens: 500,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res
        .status(response.status)
        .json({ error: data?.error?.message || 'OpenAI request failed.' });
    }

    const reply = extractReplyText(data);

    if (!reply) {
      console.error('Empty reply:', data);
      return res.status(500).json({ error: 'No reply was returned.' });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Function crash:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
}

function normalizeRole(role) {
  const value = String(role || 'user').toLowerCase();
  if (value === 'assistant') return 'assistant';
  if (value === 'system') return 'system';
  return 'user';
}

function extractReplyText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const textParts = [];

  for (const item of output) {
    if (item?.type !== 'message') continue;
    const content = Array.isArray(item.content) ? item.content : [];

    for (const part of content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        textParts.push(part.text);
      }
    }
  }

  return textParts.join('\n').trim();
}
