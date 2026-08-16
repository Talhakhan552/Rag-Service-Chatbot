"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { workspaces as workspacesApi } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { TopNav } from "@/components/TopNav";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-warm-soft text-warm",
  admin: "bg-accent-soft text-accent-text",
  member: "bg-surface-hover text-text-secondary",
};

export default function WorkspacesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    workspacesApi
      .list()
      .then(setList)
      .finally(() => setLoading(false));
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await workspacesApi.create(newName.trim());
      setList((prev) => [...prev, ws]);
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-text-primary">Workspaces</h1>
          <p className="mt-1 text-sm text-text-secondary">Each workspace keeps its own documents, chats, and team.</p>
        </div>

        <form onSubmit={handleCreate} className="mb-10 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New workspace name"
            className="w-72 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            Create
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-text-muted">Loading...</p>
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <p className="text-sm text-text-muted">No workspaces yet. Create one above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className="group rounded-xl border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-hover"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h2 className="font-display font-medium text-text-primary group-hover:text-white">{ws.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[ws.my_role]}`}>
                    {ws.my_role}
                  </span>
                </div>
                <p className="font-mono text-xs text-text-muted">{ws.slug}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
