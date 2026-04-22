(() => {
  const input =
    document.getElementById("chatInput") ||
    document.querySelector(".chat-input");

  const sendButton =
    document.getElementById("chatSend") ||
    document.querySelector(".chat-send");

  const panel =
    document.getElementById("chatPanel") ||
    document.querySelector(".chat-panel");

  const dynamic =
    document.getElementById("chatDynamic") ||
    document.querySelector(".chat-dynamic");

  const intro =
    panel?.querySelector(".chat-intro") || null;

  if (!input || !sendButton) return;

  let thread =
    document.getElementById("chatThread") ||
    document.querySelector(".chat-thread");

  if (!thread) {
    thread = document.createElement("div");
    thread.id = "chatThread";
    thread.className = "chat-thread";

    const inputWrap =
      panel?.querySelector(".chat-input-wrap") ||
      sendButton.closest(".chat-input-wrap");

    if (inputWrap && inputWrap.parentNode) {
      inputWrap.parentNode.insertBefore(thread, inputWrap);
    } else if (dynamic && dynamic.parentNode) {
      dynamic.parentNode.insertBefore(thread, dynamic.nextSibling);
    } else if (panel) {
      panel.appendChild(thread);
    } else {
      input.parentNode?.appendChild(thread);
    }
  }

  if (!document.getElementById("chat-wire-styles")) {
    const style = document.createElement("style");
    style.id = "chat-wire-styles";
    style.textContent = `
      .chat-thread {
        display: grid;
        gap: 0.7rem;
        max-height: 280px;
        overflow-y: auto;
        padding-right: 0.15rem;
        margin-top: 0.35rem;
      }

      .chat-msg {
        max-width: 92%;
        padding: 0.9rem 1rem;
        border-radius: 18px;
        line-height: 1.6;
        font-size: 0.95rem;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .chat-msg.user {
        justify-self: end;
        background: linear-gradient(135deg, var(--accent), #d9ff71);
        color: #081006;
        border-bottom-right-radius: 8px;
      }

      .chat-msg.assistant {
        justify-self: start;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        color: var(--text, #f5f3ee);
        border-bottom-left-radius: 8px;
      }

      .chat-msg.system {
        justify-self: start;
        background: rgba(255,255,255,0.03);
        border: 1px dashed rgba(255,255,255,0.12);
        color: var(--muted, #b8bcc7);
        font-style: italic;
      }

      .chat-send:disabled,
      .chat-input:disabled,
      #chatSend:disabled,
      #chatInput:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  const conversation = [];
  let busy = false;

  function getLang() {
    const langAttr = document.documentElement.lang || "";
    const saved = localStorage.getItem("siteLanguage") || "";
    return langAttr.startsWith("es") || saved === "es" ? "es" : "en";
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });
  }

  function appendMessage(role, text) {
    const el = document.createElement("div");
    el.className = `chat-msg ${role}`;
    el.textContent = text;
    thread.appendChild(el);
    scrollToBottom();
    return el;
  }

  function hideWelcomeVisuals() {
    if (dynamic) dynamic.style.display = "none";
    if (intro) intro.style.display = "none";
  }

  function setBusy(state) {
    busy = state;
    input.disabled = state;
    sendButton.disabled = state;
  }

  async function sendMessage(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }

    if (busy) return;

    const text = input.value.trim();
    if (!text) return;

    hideWelcomeVisuals();

    appendMessage("user", text);
    conversation.push({ role: "user", content: text });
    input.value = "";
    setBusy(true);

    const thinkingText = getLang() === "es" ? "Pensando…" : "Thinking…";
    const thinkingEl = appendMessage("system", thinkingText);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          messages: conversation,
          language: getLang()
        })
      });

      const data = await response.json().catch(() => ({}));
      thinkingEl.remove();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (getLang() === "es"
              ? "No pude responder ahora mismo."
              : "I could not respond right now.")
        );
      }

      const reply =
        typeof data?.reply === "string" ? data.reply.trim() : "";

      if (!reply) {
        throw new Error(
          getLang() === "es"
            ? "No se recibió respuesta."
            : "No reply was returned."
        );
      }

      appendMessage("assistant", reply);
      conversation.push({ role: "assistant", content: reply });
    } catch (error) {
      const fallback =
        getLang() === "es"
          ? "Ahora mismo no pude responder. Inténtalo otra vez en un momento."
          : "I could not respond right now. Please try again in a moment.";

      appendMessage(
        "assistant",
        error instanceof Error && error.message ? error.message : fallback
      );
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  sendButton.addEventListener("click", sendMessage, true);

  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        sendMessage(event);
      }
    },
    true
  );

  const form = input.closest("form");
  if (form) {
    form.addEventListener(
      "submit",
      (event) => {
        sendMessage(event);
      },
      true
    );
  }
})();
