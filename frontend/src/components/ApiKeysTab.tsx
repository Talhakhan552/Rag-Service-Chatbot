"use client";

import { useEffect, useState } from "react";
import { apiKeys as apiKeysApi } from "@/lib/api";
import type { ApiKey } from "@/lib/types";

export function ApiKeysTab({ workspaceId }: { workspaceId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);

  const load = () => apiKeysApi.list(workspaceId).then(setKeys);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [workspaceId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await apiKeysApi.create(workspaceId, name.trim());
      setJustCreatedKey(created.key);
      setName("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await apiKeysApi.revoke(workspaceId, id);
    await load();
  };

  return (
    <div>
      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name, e.g. 'Production integration'"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Create key
        </button>
      </form>

      {justCreatedKey && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-900">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <code className="block break-all rounded bg-white px-3 py-2 font-mono text-sm text-slate-900">
            {justCreatedKey}
          </code>
          <button
            onClick={() => setJustCreatedKey(null)}
            className="mt-2 text-xs text-amber-700 hover:text-amber-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-16 text-center">
          <p className="text-sm text-slate-500">No API keys yet. Create one to integrate programmatically.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Key</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last used</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{k.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{k.key_prefix}...</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {k.is_active ? "active" : "revoked"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {k.is_active && (
                      <button onClick={() => handleRevoke(k.id)} className="text-xs text-slate-400 hover:text-red-600">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
