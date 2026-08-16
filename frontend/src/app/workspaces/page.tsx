"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { workspaces as workspacesApi } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { TopNav } from "@/components/TopNav";

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
    <div className="flex min-h-full flex-1 flex-col">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Workspaces</h1>
        </div>

        <form onSubmit={handleCreate} className="mb-8 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New workspace name"
            className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Create
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-16 text-center">
            <p className="text-sm text-slate-500">No workspaces yet. Create one above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-medium text-slate-900">{ws.name}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {ws.my_role}
                  </span>
                </div>
                <p className="font-mono text-xs text-slate-400">{ws.slug}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
