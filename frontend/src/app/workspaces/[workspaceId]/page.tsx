"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { workspaces as workspacesApi } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { TopNav } from "@/components/TopNav";
import { DocumentsTab } from "@/components/DocumentsTab";
import { ChatTab } from "@/components/ChatTab";
import { MembersTab } from "@/components/MembersTab";
import { ApiKeysTab } from "@/components/ApiKeysTab";
import { AdminTab } from "@/components/AdminTab";

type Tab = "chat" | "documents" | "members" | "api-keys" | "admin";

export default function WorkspaceDetailPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>("chat");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    workspacesApi.get(workspaceId).then(setWorkspace);
  }, [user, workspaceId]);

  if (authLoading || !user || !workspace) return null;

  const isAdmin = workspace.my_role === "owner" || workspace.my_role === "admin";

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: "chat", label: "Chat" },
    { id: "documents", label: "Documents" },
    { id: "members", label: "Members" },
    { id: "api-keys", label: "API Keys", adminOnly: true },
    { id: "admin", label: "Usage", adminOnly: true },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-slate-900">{workspace.name}</h1>
          <p className="font-mono text-xs text-slate-400">{workspace.slug}</p>
        </div>

        <div className="mb-6 border-b border-slate-200">
          <nav className="flex gap-6">
            {tabs
              .filter((t) => !t.adminOnly || isAdmin)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`border-b-2 pb-2 text-sm font-medium ${
                    tab === t.id
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </nav>
        </div>

        {tab === "chat" && <ChatTab workspaceId={workspaceId} />}
        {tab === "documents" && <DocumentsTab workspaceId={workspaceId} />}
        {tab === "members" && <MembersTab workspaceId={workspaceId} />}
        {tab === "api-keys" && isAdmin && <ApiKeysTab workspaceId={workspaceId} />}
        {tab === "admin" && isAdmin && <AdminTab workspaceId={workspaceId} />}
      </main>
    </div>
  );
}
