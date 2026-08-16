"use client";

import { useEffect, useState } from "react";
import { workspaces as workspacesApi, ApiError } from "@/lib/api";
import type { Member, WorkspaceRole } from "@/lib/types";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-warm-soft text-warm",
  admin: "bg-accent-soft text-accent-text",
  member: "bg-surface-hover text-text-secondary",
};

export function MembersTab({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = () => workspacesApi.members(workspaceId).then(setMembers);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [workspaceId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await workspacesApi.invite(workspaceId, email, role);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add member");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleInvite} className="mb-6 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Member's email (must already have an account)"
          className="w-72 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceRole)}
          className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={inviting}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.user_id} className="bg-surface transition hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">{m.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{m.full_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[m.role]}`}>
                      {m.role}
                    </span>
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
