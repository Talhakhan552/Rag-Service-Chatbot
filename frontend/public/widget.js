(function () {
    "use strict";

    var scriptTag = document.currentScript;
    var API_URL = scriptTag.getAttribute("data-api-url") || "https://your-domain.com/api/v1";
    var WORKSPACE_ID = scriptTag.getAttribute("data-workspace-id");
    var API_KEY = scriptTag.getAttribute("data-api-key");
    var TITLE = scriptTag.getAttribute("data-title") || "Chat with us";
    var WELCOME = scriptTag.getAttribute("data-welcome") || "Hi! Ask me anything and I'll answer from what's been uploaded here.";
    var ACCENT = /^#[0-9a-f]{6}$/i.test(scriptTag.getAttribute("data-accent") || "") ? scriptTag.getAttribute("data-accent") : "#8171F2";
    var DARK = scriptTag.getAttribute("data-theme") === "dark";
    var SIDE = scriptTag.getAttribute("data-position") === "left" ? "left" : "right";

    if (!WORKSPACE_ID || !API_KEY) {
      console.error("[Cortex Widget] data-workspace-id and data-api-key are required.");
      return;
    }

    var SESSION_STORAGE_KEY = "cortex_widget_session_" + WORKSPACE_ID;

    // Black or white text on the accent color, whichever is readable.
    function onAccent(hex) {
      var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
    }

    var C = DARK
      ? { panel: "#15171c", msgs: "#0e1014", bot: "#1e2128", botBorder: "#2b2f38", text: "#e9e9ec", line: "#262a32", input: "#0e1014", inputBorder: "#343944", muted: "#8a8f99" }
      : { panel: "#ffffff", msgs: "#f8f8fa", bot: "#ffffff", botBorder: "#e5e5ea", text: "#1a1a1a", line: "#eeeeee", input: "#ffffff", inputBorder: "#dddddd", muted: "#999999" };
    var ON_ACCENT = onAccent(ACCENT);

    var style = document.createElement("style");
    style.textContent =
      "#cortex-widget-bubble{position:fixed;bottom:20px;" + SIDE + ":20px;width:56px;height:56px;border-radius:50%;background:" + ACCENT +
      ";box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;z-index:999998;display:flex;align-items:center;justify-content:center;border:none;transition:transform .15s ease}" +
      "#cortex-widget-bubble:hover{transform:scale(1.06)}" +
      "#cortex-widget-bubble svg{width:26px;height:26px;fill:" + ON_ACCENT + "}" +
      "#cortex-widget-panel{position:fixed;bottom:88px;" + SIDE + ":20px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:" + C.panel +
      ";border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:999999;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
      "#cortex-widget-panel.open{display:flex}" +
      "#cortex-widget-header{background:" + ACCENT + ";color:" + ON_ACCENT + ";padding:14px 16px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center}" +
      "#cortex-widget-close{cursor:pointer;background:none;border:none;color:" + ON_ACCENT + ";font-size:18px;line-height:1;opacity:.85}" +
      "#cortex-widget-close:hover{opacity:1}" +
      "#cortex-widget-messages{flex:1;overflow-y:auto;padding:14px;background:" + C.msgs + ";display:flex;flex-direction:column;gap:10px}" +
      ".cortex-msg{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}" +
      ".cortex-msg.user{align-self:flex-end;background:" + ACCENT + ";color:" + ON_ACCENT + ";border-bottom-right-radius:4px}" +
      ".cortex-msg.assistant{align-self:flex-start;background:" + C.bot + ";border:1px solid " + C.botBorder + ";color:" + C.text + ";border-bottom-left-radius:4px}" +
      "#cortex-widget-form{display:flex;gap:8px;padding:12px;border-top:1px solid " + C.line + ";background:" + C.panel + "}" +
      "#cortex-widget-input{flex:1;border:1px solid " + C.inputBorder + ";background:" + C.input + ";color:" + C.text + ";border-radius:20px;padding:9px 14px;font-size:13.5px;outline:none}" +
      "#cortex-widget-input::placeholder{color:" + C.muted + "}" +
      "#cortex-widget-input:focus{border-color:" + ACCENT + "}" +
      "#cortex-widget-send{background:" + ACCENT + ";color:" + ON_ACCENT + ";border:none;border-radius:20px;padding:0 16px;font-size:13px;font-weight:600;cursor:pointer}" +
      "#cortex-widget-send:disabled{opacity:.5;cursor:default}" +
      ".cortex-typing{display:inline-flex;gap:3px;padding:4px 0}" +
      ".cortex-typing span{width:6px;height:6px;border-radius:50%;background:" + C.muted + ";animation:cortex-bounce 1.2s infinite}" +
      ".cortex-typing span:nth-child(2){animation-delay:.15s}" +
      ".cortex-typing span:nth-child(3){animation-delay:.3s}" +
      "@keyframes cortex-bounce{0%,60%,100%{opacity:.3}30%{opacity:1}}";
    document.head.appendChild(style);

    var bubble = document.createElement("button");
    bubble.id = "cortex-widget-bubble";
    bubble.setAttribute("aria-label", "Open chat");
    bubble.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

    var panel = document.createElement("div");
    panel.id = "cortex-widget-panel";
    panel.innerHTML =
      '<div id="cortex-widget-header"><span id="cortex-widget-title"></span><button id="cortex-widget-close" aria-label="Close chat">✕</button></div>' +
      '<div id="cortex-widget-messages"></div>' +
      '<form id="cortex-widget-form">' +
      '<input id="cortex-widget-input" type="text" placeholder="Ask a question..." autocomplete="off" aria-label="Your message" />' +
      '<button id="cortex-widget-send" type="submit">Send</button>' +
      "</form>";
    panel.querySelector("#cortex-widget-title").textContent = TITLE;

    function mount() {
      document.body.appendChild(bubble);
      document.body.appendChild(panel);
    }
    // The snippet may be pasted in <head>, where document.body doesn't exist yet.
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);

    var messagesEl = panel.querySelector("#cortex-widget-messages");
    var formEl = panel.querySelector("#cortex-widget-form");
    var inputEl = panel.querySelector("#cortex-widget-input");
    var sendEl = panel.querySelector("#cortex-widget-send");
    var closeEl = panel.querySelector("#cortex-widget-close");

    var sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    var isOpen = false;
    var isSending = false;

    function toggle() {
      isOpen = !isOpen;
      panel.classList.toggle("open", isOpen);
      if (isOpen && messagesEl.children.length === 0) {
        renderMessage("assistant", WELCOME);
        inputEl.focus();
      }
    }

    bubble.addEventListener("click", toggle);
    closeEl.addEventListener("click", toggle);

    function renderMessage(role, content) {
      var el = document.createElement("div");
      el.className = "cortex-msg " + role;
      var textNode = document.createElement("div");
      textNode.textContent = content;
      el.appendChild(textNode);
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    function renderTyping() {
      var el = document.createElement("div");
      el.className = "cortex-msg assistant";
      el.innerHTML = '<span class="cortex-typing"><span></span><span></span><span></span></span>';
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    function apiHeaders() {
      return { "Content-Type": "application/json", "X-API-Key": API_KEY };
    }

    function ensureSession() {
      if (sessionId) return Promise.resolve(sessionId);

      return fetch(API_URL + "/workspaces/" + WORKSPACE_ID + "/chat/sessions", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ title: "Widget chat" }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Could not start chat session");
          return res.json();
        })
        .then(function (data) {
          sessionId = data.id;
          localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
          return sessionId;
        });
    }

    function sendMessage(content) {
      return ensureSession().then(function (sid) {
        return fetch(API_URL + "/workspaces/" + WORKSPACE_ID + "/chat/sessions/" + sid + "/messages", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ content: content }),
        });
      });
    }

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var content = inputEl.value.trim();
      if (!content || isSending) return;

      renderMessage("user", content);
      inputEl.value = "";
      isSending = true;
      sendEl.disabled = true;

      var typingEl = renderTyping();
      var fullText = "";

      sendMessage(content)
        .then(function (res) {
          if (!res.ok || !res.body) throw new Error("Request failed");

          var reader = res.body.getReader();
          var decoder = new TextDecoder();
          var buffer = "";

          function pump() {
            return reader.read().then(function (result) {
              if (result.done) return;
              buffer += decoder.decode(result.value, { stream: true });
              var lines = buffer.split("\n\n");
              buffer = lines.pop() || "";

              // "sources" events are ignored: the public widget doesn't show citations.
              lines.forEach(function (line) {
                if (line.indexOf("data: ") !== 0) return;
                var event = JSON.parse(line.slice(6));

                if (event.type === "content") {
                  fullText += event.delta;
                  var textNode = typingEl.querySelector("div") || document.createElement("div");
                  typingEl.innerHTML = "";
                  textNode.textContent = fullText;
                  typingEl.appendChild(textNode);
                  messagesEl.scrollTop = messagesEl.scrollHeight;
                } else if (event.type === "error") {
                  typingEl.remove();
                  renderMessage("assistant", "Sorry, something went wrong. Please try again.");
                }
              });

              return pump();
            });
          }

          return pump();
        })
        .catch(function () {
          typingEl.remove();
          renderMessage("assistant", "Sorry, something went wrong. Please try again.");
        })
        .finally(function () {
          isSending = false;
          sendEl.disabled = false;
        });
    });
  })();
