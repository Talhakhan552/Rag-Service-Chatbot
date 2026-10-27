"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { platformAdmin } from "@/lib/api";
import type { PlatformUser, PlatformWorkspace } from "@/lib/types";
import { TopNav } from "@/components/TopNav";
import { formatBytes } from "@/components/AdminTab";

const TH = "px-4 py-3";
const TD = "px-4 py-3 text-text-secondary";

export default function PlatformAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [workspaces, setWorkspaces] = useState<PlatformWorkspace[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user?.is_superuser) return;
    platformAdmin.users().then(setUsers);
    platformAdmin.workspaces().then(setWorkspaces);
  }, [user]);

  if (authLoading || !user) return null;

  if (!user.is_superuser) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-canvas">
        <TopNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <p className="text-sm text-text-muted">
            This page is for platform admins only.{" "}
            <Link href="/workspaces" className="text-accent-text hover:text-text-primary">
              Back to workspaces
            </Link>
          </p>
        </main>
      </div>
    );
  }

  const sum = (pick: (w: PlatformWorkspace) => number) => (workspaces ?? []).reduce((n, w) => n + pick(w), 0);
  const totals = [
    { label: "Users", value: users?.length },
    { label: "Workspaces", value: workspaces?.length },
    { label: "Documents", value: workspaces && sum((w) => w.document_count) },
    { label: "Storage used", value: workspaces && formatBytes(sum((w) => w.total_storage_bytes)) },
    { label: "Chat sessions", value: workspaces && sum((w) => w.chat_session_count) },
    { label: "Messages", value: workspaces && sum((w) => w.message_count) },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-text-primary">Platform admin</h1>
          <p className="mt-1 text-sm text-text-secondary">Every user and workspace on this Cortex instance.</p>
        </div>

        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {totals.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{c.label}</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-text-primary">{c.value ?? "…"}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-3 font-display text-lg font-medium text-text-primary">Workspaces</h2>
        <div className="mb-10 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Owner</th>
                <th className={TH}>Members</th>
                <th className={TH}>Docs</th>
                <th className={TH}>Storage</th>
                <th className={TH}>Chats</th>
                <th className={TH}>Messages</th>
                <th className={TH}>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workspaces?.map((w) => (
                <tr key={w.id} className="bg-surface">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{w.name}</p>
                    <p className="font-mono text-xs text-text-muted">{w.slug}</p>
                  </td>
                  <td className={TD}>{w.owner_email ?? "—"}</td>
                  <td className={TD}>{w.member_count}</td>
                  <td className={TD}>{w.document_count}</td>
                  <td className={TD}>{formatBytes(w.total_storage_bytes)}</td>
                  <td className={TD}>{w.chat_session_count}</td>
                  <td className={TD}>{w.message_count}</td>
                  <td className={TD}>{new Date(w.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mb-3 font-display text-lg font-medium text-text-primary">Users</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className={TH}>Email</th>
                <th className={TH}>Name</th>
                <th className={TH}>Workspaces</th>
                <th className={TH}>Status</th>
                <th className={TH}>Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((u) => (
                <tr key={u.id} className="bg-surface">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {u.email}
                    {u.is_superuser && (
                      <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
                        admin
                      </span>
                    )}
                  </td>
                  <td className={TD}>{u.full_name ?? "—"}</td>
                  <td className={TD}>{u.workspace_count}</td>
                  <td className={TD}>{u.is_active ? "active" : "disabled"}</td>
                  <td className={TD}>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
