# Force / Braking Basketball — site + Claude-powered chat

This is your existing static site with a working conversational chat advisor wired in.

## What's in this folder

```
/
├── index.html          ← your site (redirect-to-contact logic removed)
├── chat.js             ← frontend chat logic (UI, history, API calls)
├── api/
│   └── chat.js         ← Vercel serverless function (calls Claude)
├── package.json        ← declares @anthropic-ai/sdk dependency
└── README.md           ← this file
```

## What was broken and what I fixed

The old `chat.js` referenced at the bottom of `index.html` didn't exist — `<script src="/chat.js" defer></script>` was loading a 404. On top of that, the inline script inside `index.html` was hard-wired so the send button just redirected the user to `#contact` instead of sending a message anywhere.

The fix has four parts:

1. **`api/chat.js`** — a Vercel serverless function that receives the conversation history and language, calls Claude (`claude-sonnet-4-6`) with a tailored system prompt (voice, doctrine, guardrails), and returns the reply.
2. **`chat.js`** — a real chat frontend: message bubbles, typing indicator, conversation history kept in memory, bilingual (EN/ES), proper error handling. It uses capture-phase listeners on the existing send button so it cleanly overrides anything else.
3. **`index.html`** — the broken send-button redirect is removed from the inline script. Everything else (look, language toggle, open/close panel, rotating pitch messages before first send) is untouched.
4. **`package.json`** — declares `@anthropic-ai/sdk` so Vercel installs it.

## Deploy to Vercel (first-time setup)

### 1. Get a Claude API key

- Go to <https://console.anthropic.com/>
- Create an API key (Settings → API Keys → Create Key)
- Copy it. Treat it like a password.

### 2. Put these files in your repo

Drop everything from this folder into the root of your existing Git repo (replacing your current `index.html`). Commit and push.

### 3. Add the env var in Vercel

- Vercel dashboard → your project → **Settings** → **Environment Variables**
- Add:
  - Name: `ANTHROPIC_API_KEY`
  - Value: the key you copied from step 1
  - Environments: check **Production**, **Preview**, and **Development**
- Click Save.

### 4. Redeploy

- Vercel dashboard → **Deployments** → three-dot menu on the latest deployment → **Redeploy**
- Or just push another commit.

Vercel will auto-install `@anthropic-ai/sdk` and make `/api/chat` live. Open the site, click the basketball 🏀 button, send a message.

## Local testing (optional)

```bash
npm install -g vercel
vercel dev
```

`vercel dev` will prompt you to pull env vars from your project. Say yes. Then open <http://localhost:3000>.

## Cost / usage notes

- Model: `claude-sonnet-4-6`. Good balance of quality and cost for a public chat widget. If traffic grows and costs matter, swap to `claude-haiku-4-5-20251001` at the top of `api/chat.js` — it's significantly cheaper and still plenty sharp for this scope.
- History is trimmed to the last 20 turns per request, and each message is capped at 4,000 chars. Keeps cost predictable and prevents prompt-bloat abuse.
- `max_tokens` is set to 600, which keeps responses tight (matching the brand voice) and caps cost per reply.

## If you want to lock things down further

- **Rate limiting**: add a check in `api/chat.js` using the user's IP (`req.headers['x-forwarded-for']`) and Vercel KV or Upstash Redis. Easy add, happy to wire it if you get traffic.
- **Origin lock**: change the CORS line in `api/chat.js` from `"*"` to your exact domain, e.g. `"https://yourdomain.com"`.
- **Logging leads**: if someone has a real conversation, it's often worth logging the transcript + their follow-on form submission. Tell me where you want them logged (Airtable, Google Sheets, email, Slack) and I'll wire it.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Chat says "Something went wrong…" | `ANTHROPIC_API_KEY` not set or wrong | Check Vercel env vars, redeploy |
| 404 on `/api/chat` | File isn't in `/api/` folder at repo root | Make sure the path is exactly `api/chat.js` |
| 500 error in browser console | Look at Vercel logs | Dashboard → Deployments → your deployment → Functions → `api/chat` → Logs |
| Chat UI looks broken | `chat.js` didn't load | Open DevTools → Network tab, confirm `chat.js` returns 200 |
| Works locally, fails on Vercel | Usually env var scope | In Vercel env var settings, make sure Production is checked |

## Changing the assistant's voice

The system prompt lives in `api/chat.js` at the top (`SYSTEM_PROMPT`). It encodes the brand doctrine — force/braking/flywheel philosophy, voice rules, lead-qualification behavior, language handling. Edit it freely; redeploy to see changes.
