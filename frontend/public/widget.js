(function () {
    "use strict";
  
    var scriptTag = document.currentScript;
    var API_URL = scriptTag.getAttribute("data-api-url") || "https://your-domain.com/api/v1";
    var WORKSPACE_ID = scriptTag.getAttribute("data-workspace-id");
    var API_KEY = scriptTag.getAttribute("data-api-key");
    var TITLE = scriptTag.getAttribute("data-title") || "Chat with us";
    var ACCENT = scriptTag.getAttribute("data-accent") || "#8171F2";
  
    if (!WORKSPACE_ID || !API_KEY) {
      console.error("[Cortex Widget] data-workspace-id and data-api-key are required.");
      return;
    }
  
    var SESSION_STORAGE_KEY = "cortex_widget_session_" + WORKSPACE_ID;
  
    var style = document.createElement("style");
    style.textContent =
      "#cortex-widget-bubble{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:" +
      ACCENT +
      ";box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;z-index:999998;display:flex;align-items:center;justify-content:center;border:none;transition:transform .15s ease}" +
      "#cortex-widget-bubble:hover{transform:scale(1.06)}" +
      "#cortex-widget-bubble svg{width:26px;height:26px;fill:#fff}" +
      "#cortex-widget-panel{position:fixed;bottom:88px;right:20px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);z-index:999999;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
      "#cortex-widget-panel.open{display:flex}" +
      "#cortex-widget-header{background:" +
      ACCENT +
      ";color:#fff;padding:14px 16px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center}" +
      "#cortex-widget-close{cursor:pointer;background:none;border:none;color:#fff;font-size:18px;line-height:1;opacity:.85}" +
      "#cortex-widget-close:hover{opacity:1}" +
      "#cortex-widget-messages{flex:1;overflow-y:auto;padding:14px;background:#f8f8fa;display:flex;flex-direction:column;gap:10px}" +
      ".cortex-msg{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}" +
      ".cortex-msg.user{align-self:flex-end;background:" +
      ACCENT +
      ";color:#fff;border-bottom-right-radius:4px}" +
      ".cortex-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #e5e5ea;color:#1a1a1a;border-bottom-left-radius:4px}" +
      ".cortex-msg .cortex-sources{margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,.08);font-size:11px;opacity:.65}" +
      "#cortex-widget-form{display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff}" +
      "#cortex-widget-input{flex:1;border:1px solid #ddd;border-radius:20px;padding:9px 14px;font-size:13.5px;outline:none}" +
      "#cortex-widget-input:focus{border-color:" +
      ACCENT +
      "}" +
      "#cortex-widget-send{background:" +
      ACCENT +
      ";color:#fff;border:none;border-radius:20px;padding:0 16px;font-size:13px;font-weight:600;cursor:pointer}" +
      "#cortex-widget-send:disabled{opacity:.5;cursor:default}" +
      ".cortex-typing{display:inline-flex;gap:3px;padding:4px 0}" +
      ".cortex-typing span{width:6px;height:6px;border-radius:50%;background:#999;animation:cortex-bounce 1.2s infinite}" +
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
      '<div id="cortex-widget-header"><span>' +
      TITLE +
      '</span><button id="cortex-widget-close" aria-label="Close chat">\u2715</button></div>' +
      '<div id="cortex-widget-messages"></div>' +
      '<form id="cortex-widget-form">' +
      '<input id="cortex-widget-input" type="text" placeholder="Ask a question..." autocomplete="off" />' +
      '<button id="cortex-widget-send" type="submit">Send</button>' +
      "</form>";
  
    document.body.appendChild(bubble);
    document.body.appendChild(panel);
  
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
        renderMessage("assistant", "Hi! Ask me anything and I'll answer from what's been uploaded here.");
        inputEl.focus();
      }
    }
  
    bubble.addEventListener("click", toggle);
    closeEl.addEventListener("click", toggle);
  
    function renderMessage(role, content, sources) {
      var el = document.createElement("div");
      el.className = "cortex-msg " + role;
      var textNode = document.createElement("div");
      textNode.textContent = content;
      el.appendChild(textNode);
  
      if (sources && sources.length > 0) {
        var uniqueFiles = [];
        var seen = {};
        sources.forEach(function (s) {
          if (!seen[s.filename]) {
            seen[s.filename] = true;
            uniqueFiles.push(s.filename);
          }
        });
        var srcEl = document.createElement("div");
        srcEl.className = "cortex-sources";
        srcEl.textContent = "Source: " + uniqueFiles.join(", ");
        el.appendChild(srcEl);
      }
  
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
      var sources = null;
  
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
  
              lines.forEach(function (line) {
                if (line.indexOf("data: ") !== 0) return;
                var event = JSON.parse(line.slice(6));
  
                if (event.type === "sources") {
                  sources = event.sources;
                } else if (event.type === "content") {
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
        .then(function () {
          if (sources && sources.length > 0) {
            typingEl.remove();
            renderMessage("assistant", fullText, sources);
          }
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