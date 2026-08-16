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
      onDone: () => {
        setStreaming(false);
      },
      onError: () => {
        setStreaming(false);
      },
    });

    // Refresh from the server so we get the real persisted message
    // (with a real id) instead of relying on the local streaming buffer.
    const finalMessages = await chat.getMessages(workspaceId, sessionId);
    setMessages(finalMessages);
    setStreamingText("");
    setStreamingSources(null);
  };

  return (
    <div className="flex h-[600px] overflow-hidden rounded-lg border border-slate-200">
      {/* Session sidebar */}
      <div className="w-56 shrink-0 border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 p-3">
          <button
            onClick={handleNewSession}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New chat
          </button>
        </div>
        <div className="overflow-y-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`block w-full truncate px-3 py-2 text-left text-sm ${
                activeSessionId === s.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.title || "Untitled chat"}
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !streaming && (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Ask a question about your uploaded documents.
            </div>
          )}

          <div className="space-y-4">
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
              />
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={streaming}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isUser ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900"}`}>
        <p className="whitespace-pre-wrap">{message.content || "..."}</p>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-slate-300/40 pt-2">
            {message.sources.map((s) => (
              <div key={s.chunk_id} className="text-xs opacity-75">
                📄 {s.filename}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
