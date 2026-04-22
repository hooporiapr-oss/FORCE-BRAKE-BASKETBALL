// chat.js
// Force/Braking Basketball — conversational chat frontend
// Works with the chat panel markup already in index.html.
// Talks to /api/chat (Vercel serverless function).

(function () {
  const ENDPOINT = "/api/chat";

  const chatDynamic = document.getElementById("chatDynamic");
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");
  const chatPanel = document.getElementById("chatPanel");

  if (!chatDynamic || !chatInput || !chatSend || !chatPanel) {
    console.warn("[chat.js] chat panel markup not found — aborting.");
    return;
  }

  // --- State -----------------------------------------------------------------
  const history = []; // [{role: "user"|"assistant", content: string}]
  let conversationStarted = false;
  let isSending = false;
  let messagesEl = null;

  // --- Language helpers ------------------------------------------------------
  function currentLang() {
    try {
      return localStorage.getItem("siteLanguage") || "en";
    } catch {
      return "en";
    }
  }

  const i18n = {
    en: {
      greeting:
        "Ask about force production, braking, the flywheel method, or how this transfers to your game. What's on your mind?",
      error:
        "Something went wrong reaching the advisor. Try again in a moment, or use the contact form below.",
      thinking: "Thinking…",
    },
    es: {
      greeting:
        "Pregunta sobre producción de fuerza, frenado, el método flywheel, o cómo esto se transfiere a tu juego. ¿Qué tienes en mente?",
      error:
        "Algo salió mal al contactar al asesor. Intenta otra vez en un momento, o usa el formulario de contacto abajo.",
      thinking: "Pensando…",
    },
  };

  function t(key) {
    return i18n[currentLang()]?.[key] ?? i18n.en[key];
  }

  // --- One-time style injection ---------------------------------------------
  function injectStyles() {
    if (document.getElementById("chatjs-styles")) return;
    const style = document.createElement("style");
    style.id = "chatjs-styles";
    style.textContent = `
      .chat-messages {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        max-height: 48vh;
        min-height: 180px;
        overflow-y: auto;
        padding: 0.25rem 0.1rem 0.25rem 0.1rem;
        scroll-behavior: smooth;
      }
      .chat-messages::-webkit-scrollbar { width: 6px; }
      .chat-messages::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.12);
        border-radius: 999px;
      }
      .chat-msg {
        max-width: 88%;
        padding: 0.65rem 0.9rem;
        border-radius: 16px;
        line-height: 1.5;
        font-size: 0.93rem;
        word-wrap: break-word;
        white-space: pre-wrap;
        border: 1px solid rgba(255,255,255,0.08);
        animation: chatFadeIn 260ms ease;
      }
      .chat-msg.user {
        align-self: flex-end;
        background: linear-gradient(135deg, rgba(184,245,22,0.22), rgba(184,245,22,0.12));
        border-color: rgba(184,245,22,0.35);
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
        border-color: rgba(255, 90, 90, 0.3);
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

  // --- DOM helpers -----------------------------------------------------------
  function startConversation() {
    if (conversationStarted) return;
    conversationStarted = true;

    // Stop the rotating marketing messages that the inline script owns.
    // (They run on an interval named messageTimer in the inline script.)
    // We can't reference it directly, so we just hide chatDynamic and build
    // our own messages container next to it.
    chatDynamic.style.display = "none";

    messagesEl = document.createElement("div");
    messagesEl.className = "chat-messages";
    messagesEl.setAttribute("role", "log");
    messagesEl.setAttribute("aria-live", "polite");
    chatDynamic.parentNode.insertBefore(messagesEl, chatDynamic.nextSibling);

    addMessage("assistant", t("greeting"), { store: false });
  }

  function addMessage(role, content, opts = {}) {
    const { store = true, isError = false } = opts;
    if (!messagesEl) return;

    const el = document.createElement("div");
    el.className = "chat-msg " + (isError ? "error" : role);
    el.textContent = content;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (store && (role === "user" || role === "assistant")) {
      history.push({ role, content });
    }
  }

  function showTyping() {
    if (!messagesEl) return null;
    const el = document.createElement("div");
    el.className = "chat-typing";
    el.setAttribute("aria-label", t("thinking"));
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function setSending(state) {
    isSending = state;
    chatSend.disabled = state;
    chatInput.disabled = state;
  }

  // --- Networking ------------------------------------------------------------
  // history must already contain the latest user turn before calling this.
  async function fetchReply() {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, language: currentLang() }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }
    const data = await res.json();
    if (!data || typeof data.reply !== "string") {
      throw new Error("Malformed response from server.");
    }
    return data.reply;
  }

  async function handleSend() {
    if (isSending) return;
    const text = (chatInput.value || "").trim();
    if (!text) return;

    startConversation();
    addMessage("user", text); // also pushes to history
    chatInput.value = "";

    setSending(true);
    const typing = showTyping();

    try {
      const reply = await fetchReply();
      if (typing) typing.remove();
      addMessage("assistant", reply);
    } catch (err) {
      console.error("[chat.js] send failed:", err);
      if (typing) typing.remove();
      addMessage("assistant", t("error"), { store: false, isError: true });
    } finally {
      setSending(false);
      chatInput.focus();
    }
  }

  // --- Override the inline script's broken handlers --------------------------
  // The inline script in index.html attaches listeners that redirect to
  // #contact. We use capture-phase listeners with stopImmediatePropagation
  // to take over cleanly without touching that script.
  function attachListeners() {
    const sendCapture = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleSend();
    };

    const keyCapture = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleSend();
      }
    };

    chatSend.addEventListener("click", sendCapture, true);
    chatSend.addEventListener("pointerup", sendCapture, true);
    chatInput.addEventListener("keydown", keyCapture, true);
  }

  // --- Init ------------------------------------------------------------------
  function init() {
    injectStyles();
    attachListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
