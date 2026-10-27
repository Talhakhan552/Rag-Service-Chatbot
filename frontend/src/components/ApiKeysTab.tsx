"use client";

import { useEffect, useState } from "react";
import { apiKeys as apiKeysApi } from "@/lib/api";
import type { ApiKey } from "@/lib/types";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never expires" },
  { value: "7", label: "Expires in 7 days" },
  { value: "30", label: "Expires in 30 days" },
  { value: "90", label: "Expires in 90 days" },
  { value: "365", label: "Expires in 1 year" },
  { value: "custom", label: "Custom date..." },
];

// End of the chosen day in the admin's local time, sent as an ISO timestamp.
function expiryToIso(choice: string, customDate: string): string | null {
  if (choice === "never") return null;
  if (choice === "custom") return customDate ? new Date(`${customDate}T23:59:59`).toISOString() : null;
  const d = new Date();
  d.setDate(d.getDate() + Number(choice));
  return d.toISOString();
}

const DEFAULT_DESIGN = {
  title: "Chat with us",
  welcome: "Hi! Ask me anything and I'll answer from what's been uploaded here.",
  accent: "#8171F2",
  theme: "light",
  position: "right",
};

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const isExpired = (k: ApiKey) => k.expires_at !== null && new Date(k.expires_at) <= new Date();

export function ApiKeysTab({ workspaceId }: { workspaceId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [customExpiry, setCustomExpiry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [origin, setOrigin] = useState("");
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const setField = (field: keyof typeof DEFAULT_DESIGN, value: string) => setDesign((d) => ({ ...d, [field]: value }));

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
    `<script\n  src="${origin}/widget.js"\n  data-api-url="${apiUrl}"\n  data-workspace-id="${workspaceId}"\n  data-api-key="${key}"` +
    `\n  data-title="${escapeAttr(design.title)}"\n  data-welcome="${escapeAttr(design.welcome)}"` +
    `\n  data-accent="${design.accent}"\n  data-theme="${design.theme}"\n  data-position="${design.position}"\n></script>`;

  // The real widget.js inside a frame, opened automatically. The fake key means messages won't send.
  const previewDoc =
    `<!doctype html><html><body style="margin:0;height:100vh;background:${design.theme === "dark" ? "#2a2d34" : "#eef0f3"}">` +
    embedSnippet("preview") +
    `<script>document.getElementById("cortex-widget-bubble").click()</scr` + `ipt></body></html>`;

  const copySnippet = (key: string) => {
    navigator.clipboard.writeText(embedSnippet(key));
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 1500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (expiry === "custom" && !customExpiry) {
      setError("Pick an expiry date.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const domains = allowedDomains.split(",").map((d) => d.trim()).filter(Boolean);
      const created = await apiKeysApi.create(workspaceId, name.trim(), domains, expiryToIso(expiry, customExpiry));
      setJustCreatedKey(created.key);
      setName("");
      setAllowedDomains("");
      setExpiry("never");
      setCustomExpiry("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key");
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
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            aria-label="Key expiry"
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {expiry === "custom" && (
            <input
              type="date"
              value={customExpiry}
              onChange={(e) => setCustomExpiry(e.target.value)}
              aria-label="Custom expiry date"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          )}
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
          elsewhere. Leave blank only for server-side keys that stay secret. An expiry date makes a leaked key stop
          working on its own.
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
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
                <th className="px-4 py-3">Expires</th>
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
                  <td className="px-4 py-3 text-text-secondary">
                    {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.is_active && !isExpired(k)
                          ? "bg-success-soft text-success"
                          : isExpired(k) && k.is_active
                            ? "bg-warm-soft text-warm"
                            : "bg-surface-hover text-text-muted"
                      }`}
                    >
                      {!k.is_active ? "revoked" : isExpired(k) ? "expired" : "active"}
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

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-text-muted">
              Title
              <input value={design.title} onChange={(e) => setField("title", e.target.value)} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block text-xs font-medium text-text-muted">
              Welcome message
              <textarea
                value={design.welcome}
                onChange={(e) => setField("welcome", e.target.value)}
                rows={2}
                className={`mt-1 ${FIELD}`}
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs font-medium text-text-muted">
                Color
                <input
                  type="color"
                  value={design.accent}
                  onChange={(e) => setField("accent", e.target.value)}
                  className="mt-1 h-[38px] w-full cursor-pointer rounded-lg border border-border bg-surface p-1"
                />
              </label>
              <label className="block text-xs font-medium text-text-muted">
                Theme
                <select value={design.theme} onChange={(e) => setField("theme", e.target.value)} className={`mt-1 ${FIELD}`}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-text-muted">
                Position
                <select
                  value={design.position}
                  onChange={(e) => setField("position", e.target.value)}
                  className={`mt-1 ${FIELD}`}
                >
                  <option value="right">Bottom right</option>
                  <option value="left">Bottom left</option>
                </select>
              </label>
            </div>
            <button
              onClick={() => setDesign(DEFAULT_DESIGN)}
              className="text-xs text-text-muted transition hover:text-text-primary"
            >
              Reset to default
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-text-muted">Live preview (messages won&apos;t send here)</p>
            {origin && (
              <iframe
                title="Chat widget preview"
                srcDoc={previewDoc}
                className="h-[640px] w-full rounded-lg border border-border"
              />
            )}
          </div>
        </div>

        <p className="mt-6 text-sm text-text-secondary">
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
