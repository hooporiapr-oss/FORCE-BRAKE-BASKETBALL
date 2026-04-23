// chat.js
// Force / Braking Basketball — conversational chat frontend
// Works with the chat panel markup in the current index.html:
//   #chatPanel, #chatMessages, #chatInput, #chatSend
// Talks to /api/chat (Vercel serverless function).

(function () {
  'use strict';

  const ENDPOINT = '/api/chat';

  const panel    = document.getElementById('chatPanel');
  const messages = document.getElementById('chatMessages');
  const input    = document.getElementById('chatInput');
  const sendBtn  = document.getElementById('chatSend');

  if (!panel || !messages || !input || !sendBtn) {
    console.warn('[chat.js] chat panel markup not found — aborting.');
    return;
  }

  // ------------------------------------------------------------------
  // Bilingual copy — English + Puerto Rican Spanish
  // ------------------------------------------------------------------
  const I18N = {
    en: {
      welcomeKicker: 'Force / Braking Advisor',
      welcomeTitle: 'Talk basketball, force, and braking.',
      welcomeSub:
        "I'm your Force / Braking advisor. Ask me anything about flywheel training, deceleration, first steps, landings, or how force and braking shape the game.",
      placeholder: 'Ask about force, braking, or flywheel training…',
      thinking: 'Thinking…',
      error:
        'Something went wrong reaching the advisor. Try again in a moment, or use the contact form below.',
      networkError:
        "I couldn't reach the advisor. Check your connection and try again."
    },
    es: {
      welcomeKicker: 'Asesor de Fuerza / Frenado',
      welcomeTitle: 'Dale, hablemos de baloncesto, fuerza y frenado.',
      welcomeSub:
        'Soy tu asesor de Fuerza y Frenado. Pregúntame lo que quieras — entrenamiento flywheel, desaceleración, primer paso, aterrizajes, o cómo la fuerza y el frenado definen el juego en la cancha.',
      placeholder: 'Pregunta sobre fuerza, frenado o entrenamiento flywheel…',
      thinking: 'Pensando…',
      error:
        'Algo falló al conectar con el asesor. Intenta otra vez en un momento, o usa el formulario de contacto abajo.',
      networkError:
        'No pude conectar con el asesor. Revisa tu conexión y vuelve a intentarlo.'
    }
  };

  function currentLang() {
    try {
      const stored = localStorage.getItem('siteLanguage');
      return stored === 'es' ? 'es' : 'en';
    } catch {
      return 'en';
    }
  }

  function t(key) {
    const lang = currentLang();
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key];
  }

  // ------------------------------------------------------------------
  // Styles (injected once)
  // ------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('chatjs-styles')) return;
    const style = document.createElement('style');
    style.id = 'chatjs-styles';
    style.textContent = `
      .chat-welcome {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        padding: 0.75rem 0.25rem 0.25rem;
        animation: chatFadeIn 320ms ease;
      }
      .chat-welcome-kicker {
        font-size: 0.7rem;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent, #b8f516);
        font-weight: 800;
      }
      .chat-welcome-title {
        font-size: 1.35rem;
        line-height: 1.2;
        letter-spacing: -0.03em;
        font-weight: 800;
        color: var(--text, #f5f3ee);
        margin: 0;
      }
      .chat-welcome-sub {
        font-size: 0.92rem;
        line-height: 1.6;
        color: var(--muted, #b8bcc7);
        margin: 0;
      }

      .chat-thread {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0.25rem 0.1rem;
      }
      .chat-msg {
        max-width: 88%;
        padding: 0.65rem 0.9rem;
        border-radius: 16px;
        line-height: 1.55;
        font-size: 0.93rem;
        word-wrap: break-word;
        white-space: pre-wrap;
        border: 1px solid rgba(255,255,255,0.08);
        animation: chatFadeIn 220ms ease;
      }
      .chat-msg.user {
        align-self: flex-end;
        background: linear-gradient(135deg, rgba(184,245,22,0.22), rgba(184,245,22,0.1));
        border-color: rgba(184,245,22,0.38);
        color: #f5f3ee;
        border-bottom-right-radius: 6px;
      }
      .chat-msg.assistant {
        align-self: flex-start;
        background: rgba(255,255,255,0.05);
        color: #e6e8ee;
        border-bottom-left-radius: 6px;
      }
      .chat-msg.error {
        align-self: flex-start;
        background: rgba(255, 90, 90, 0.1);
        border-color: rgba(255, 90, 90, 0.32);
        color: #ffd5d5;
      }
      .chat-typing {
        align-self: flex-start;
        display: inline-flex;
        gap: 4px;
        padding: 0.75rem 0.9rem;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        border-bottom-left-radius: 6px;
      }
      .chat-typing span {
        width: 6px; height: 6px; border-radius: 999px;
        background: rgba(255,255,255,0.6);
        animation: chatBounce 1.2s infinite ease-in-out;
      }
      .chat-typing span:nth-child(2) { animation-delay: 0.15s; }
      .chat-typing span:nth-child(3) { animation-delay: 0.3s; }

      @keyframes chatBounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
        40% { transform: translateY(-4px); opacity: 1; }
      }
      @keyframes chatFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .chat-send[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const history = [];
  let threadEl = null;
  let conversationStarted = false;
  let isSending = false;

  // ------------------------------------------------------------------
  // Welcome screen — no starter prompts, just a welcome message
  // ------------------------------------------------------------------
  function renderWelcome() {
    messages.innerHTML = '';

    const welcome = document.createElement('div');
    welcome.className = 'chat-welcome';

    const kicker = document.createElement('div');
    kicker.className = 'chat-welcome-kicker';
    kicker.textContent = t('welcomeKicker');

    const title = document.createElement('h3');
    title.className = 'chat-welcome-title';
    title.textContent = t('welcomeTitle');

    const sub = document.createElement('p');
    sub.className = 'chat-welcome-sub';
    sub.textContent = t('welcomeSub');

    welcome.appendChild(kicker);
    welcome.appendChild(title);
    welcome.appendChild(sub);
    messages.appendChild(welcome);
  }

  function applyPlaceholder() {
    input.placeholder = t('placeholder');
  }

  // ------------------------------------------------------------------
  // Conversation DOM
  // ------------------------------------------------------------------
  function startConversation() {
    if (conversationStarted) return;
    conversationStarted = true;
    messages.innerHTML = '';
    threadEl = document.createElement('div');
    threadEl.className = 'chat-thread';
    messages.appendChild(threadEl);
  }

  function addMessage(role, content, opts = {}) {
    const { store = true, isError = false } = opts;
    if (!threadEl) return;

    const el = document.createElement('div');
    el.className = 'chat-msg ' + (isError ? 'error' : role);
    el.textContent = content;
    threadEl.appendChild(el);
    messages.scrollTop = messages.scrollHeight;

    if (store && (role === 'user' || role === 'assistant')) {
      history.push({ role, content });
    }
  }

  function showTyping() {
    if (!threadEl) return null;
    const el = document.createElement('div');
    el.className = 'chat-typing';
    el.setAttribute('aria-label', t('thinking'));
    el.innerHTML = '<span></span><span></span><span></span>';
    threadEl.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function setSending(state) {
    isSending = state;
    sendBtn.disabled = state;
    input.disabled = state;
  }

  // ------------------------------------------------------------------
  // Networking
  // ------------------------------------------------------------------
  async function fetchReply() {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, language: currentLang() })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }

    const data = await res.json();
    if (!data || typeof data.reply !== 'string') {
      throw new Error('Malformed response from server.');
    }
    return data.reply;
  }

  async function handleSend() {
    if (isSending) return;
    const text = (input.value || '').trim();
    if (!text) return;

    startConversation();
    addMessage('user', text);
    input.value = '';

    setSending(true);
    const typing = showTyping();

    try {
      const reply = await fetchReply();
      if (typing) typing.remove();
      addMessage('assistant', reply);
    } catch (err) {
      console.error('[chat.js] send failed:', err);
      if (typing) typing.remove();
      const msg =
        err && err.message && /fetch|network|failed to fetch/i.test(err.message)
          ? t('networkError')
          : t('error');
      addMessage('assistant', msg, { store: false, isError: true });
    } finally {
      setSending(false);
      input.focus();
    }
  }

  // ------------------------------------------------------------------
  // Listeners — capture phase, overrides any inline handlers
  // ------------------------------------------------------------------
  function attachListeners() {
    const sendCapture = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleSend();
    };

    const keyCapture = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleSend();
      }
    };

    sendBtn.addEventListener('click', sendCapture, true);
    sendBtn.addEventListener('pointerup', sendCapture, true);
    input.addEventListener('keydown', keyCapture, true);
  }

  // Re-render welcome + placeholder when language toggle changes,
  // only if conversation hasn't started yet.
  function watchLanguage() {
    const update = () => {
      applyPlaceholder();
      if (!conversationStarted) renderWelcome();
    };

    const langEn = document.getElementById('lang-en');
    const langEs = document.getElementById('lang-es');
    if (langEn) langEn.addEventListener('click', () => setTimeout(update, 0));
    if (langEs) langEs.addEventListener('click', () => setTimeout(update, 0));

    window.addEventListener('storage', (e) => {
      if (e.key === 'siteLanguage') update();
    });
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  function init() {
    injectStyles();
    applyPlaceholder();
    renderWelcome();
    attachListeners();
    watchLanguage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
