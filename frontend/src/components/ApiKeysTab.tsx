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
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    if (!justCreatedKey) return;
    navigator.clipboard.writeText(justCreatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name, e.g. 'Production integration'"
          className="w-72 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          Create key
        </button>
      </form>

      {justCreatedKey && (
        <div className="mb-6 rounded-xl border border-warm/30 bg-warm-soft p-4">
          <p className="mb-2 text-sm font-medium text-warm">Copy this key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="block flex-1 break-all rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-sm text-text-primary">
              {justCreatedKey}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setJustCreatedKey(null)} className="mt-2 text-xs text-warm/80 hover:text-warm">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-text-muted">No API keys yet. Create one to integrate programmatically.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last used</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((k) => (
                <tr key={k.id} className="bg-surface transition hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{k.key_prefix}...</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.is_active ? "bg-success-soft text-success" : "bg-surface-hover text-text-muted"
                      }`}
                    >
                      {k.is_active ? "active" : "revoked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-xs text-text-muted transition hover:text-danger"
                      >
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
