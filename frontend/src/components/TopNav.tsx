"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function TopNav() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/workspaces" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-display text-xs font-bold text-white">
            C
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-text-primary">Cortex</span>
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">{user.email}</span>
            <button
              onClick={logout}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition hover:border-border-strong hover:text-text-primary"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
