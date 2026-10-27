"use client";

import { useEffect, useState } from "react";
import { apiKeys as apiKeysApi } from "@/lib/api";
import type { ApiKey } from "@/lib/types";

export function ApiKeysTab({ workspaceId }: { workspaceId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = () => apiKeysApi.list(workspaceId).then(setKeys);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [workspaceId]);

  // window isn't available during SSR, so read the origin after mount --
  // this is where widget.js is served from (frontend/public/widget.js).
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // NEXT_PUBLIC_API_URL already includes the /api/v1 suffix the widget expects.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://your-backend.onrender.com/api/v1";

  const embedSnippet = (key: string) =>
    `<script\n  src="${origin}/widget.js"\n  data-api-url="${apiUrl}"\n  data-workspace-id="${workspaceId}"\n  data-api-key="${key}"\n></script>`;

  const copySnippet = (key: string) => {
    navigator.clipboard.writeText(embedSnippet(key));
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 1500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const domains = allowedDomains.split(",").map((d) => d.trim()).filter(Boolean);
      const created = await apiKeysApi.create(workspaceId, name.trim(), domains);
      setJustCreatedKey(created.key);
      setName("");
      setAllowedDomains("");
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
      <form onSubmit={handleCreate} className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name, e.g. 'Website widget'"
            className="w-72 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            placeholder="Allowed domains, e.g. your-site.com, www.your-site.com"
            aria-label="Allowed domains, comma-separated"
            className="min-w-72 flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            Create key
          </button>
        </div>
        <p className="text-xs text-text-muted">
          For a widget key, list the site(s) it will run on (comma-separated) so a copied key can&apos;t be used
          elsewhere. Leave blank only for server-side keys that stay secret.
        </p>
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

          <div className="mt-4 border-t border-warm/20 pt-4">
            <p className="mb-2 text-sm font-medium text-text-primary">
              Paste this into any website to add the chat widget:
            </p>
            <div className="flex items-start gap-2">
              <pre className="block flex-1 overflow-x-auto rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-xs leading-relaxed text-text-primary">
                {embedSnippet(justCreatedKey)}
              </pre>
              <button
                onClick={() => copySnippet(justCreatedKey)}
                className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary"
              >
                {copiedSnippet ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              This is the only time the key is shown — copy the snippet now.
            </p>
          </div>
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
                <th className="px-4 py-3">Domains</th>
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
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {k.allowed_domains.length ? (
                      <span className="break-all">{k.allowed_domains.join(", ")}</span>
                    ) : (
                      <span className="text-warm">Any (unrestricted)</span>
                    )}
                  </td>
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

      <div className="mt-8 rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">Embed the chat widget</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Add this snippet to any website. Replace{" "}
          <code className="font-mono text-xs text-text-primary">YOUR_API_KEY</code> with a key from above (create a
          new one if you didn&apos;t copy it).
        </p>
        <div className="mt-3 flex items-start gap-2">
          <pre className="block flex-1 overflow-x-auto rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-xs leading-relaxed text-text-primary">
            {embedSnippet("YOUR_API_KEY")}
          </pre>
          <button
            onClick={() => copySnippet("YOUR_API_KEY")}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary"
          >
            {copiedSnippet ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
