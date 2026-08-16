"use client";

import { useEffect, useRef, useState } from "react";
import { chat } from "@/lib/api";
import type { ChatSession, Message } from "@/lib/types";

export function ChatTab({ workspaceId }: { workspaceId: string }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState<Message["sources"]>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chat.listSessions(workspaceId).then((list) => {
      setSessions(list);
      if (list.length > 0) setActiveSessionId(list[0].id);
    });
  }, [workspaceId]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    chat.getMessages(workspaceId, activeSessionId).then(setMessages);
  }, [workspaceId, activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleNewSession = async () => {
    const session = await chat.createSession(workspaceId);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await chat.createSession(workspaceId);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      sessionId = session.id;
    }

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, role: "user", content, sources: null, created_at: new Date().toISOString() },
    ]);
    setStreaming(true);
    setStreamingText("");
    setStreamingSources(null);

    await chat.sendMessageStream(workspaceId, sessionId, content, {
      onSources: (sources) => setStreamingSources(sources),
      onDelta: (delta) => setStreamingText((prev) => prev + delta),
      onDone: () => setStreaming(false),
      onError: () => setStreaming(false),
    });

    const finalMessages = await chat.getMessages(workspaceId, sessionId);
    setMessages(finalMessages);
    setStreamingText("");
    setStreamingSources(null);
  };

  return (
    <div className="flex h-[640px] overflow-hidden rounded-xl border border-border bg-surface">
      {/* Session sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <button
            onClick={handleNewSession}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            <span className="text-base leading-none">+</span> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {sessions.length === 0 && (
            <p className="px-3 py-4 text-xs text-text-muted">No conversations yet.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`mx-2 mb-0.5 block w-[calc(100%-1rem)] truncate rounded-lg px-2.5 py-2 text-left text-sm transition ${
                activeSessionId === s.id
                  ? "bg-accent-soft font-medium text-accent-text"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`}
            >
              {s.title || "Untitled chat"}
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 && !streaming && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                ✦
              </div>
              <p className="text-sm text-text-secondary">Ask a question about your documents</p>
              <p className="mt-1 text-xs text-text-muted">Answers are grounded in what you&apos;ve uploaded, with sources cited.</p>
            </div>
          )}

          <div className="space-y-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {streaming && (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingText,
                  sources: streamingSources,
                  created_at: new Date().toISOString(),
                }}
                isStreaming={!streamingText}
              />
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={streaming}
            className="flex-1 rounded-lg border border-border bg-canvas px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-up`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-md bg-accent text-white"
            : "rounded-bl-md border border-border bg-surface-raised text-text-primary"
        }`}
      >
        {isStreaming ? (
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-text-muted" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-text-muted" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-text-muted" style={{ animationDelay: "300ms" }} />
          </span>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-white/10 pt-2.5">
            {Array.from(new Map(message.sources.map((s) => [s.filename, s])).values()).map((s) => (
              <span
                key={s.chunk_id}
                className="inline-flex items-center gap-1 rounded-full bg-warm-soft px-2 py-0.5 font-mono text-[11px] text-warm"
              >
                <span className="text-[10px]">◆</span> {s.filename}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
