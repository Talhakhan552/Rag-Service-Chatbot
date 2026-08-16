"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function TopNav() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/workspaces" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 font-mono text-xs font-semibold text-white">
            {"{}"}
          </div>
          <span className="text-sm font-semibold text-slate-900">RAG Chatbot</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user.email}</span>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
