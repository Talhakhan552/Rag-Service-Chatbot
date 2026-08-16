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
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-text-primary">{workspace.name}</h1>
          <p className="font-mono text-xs text-text-muted">{workspace.slug}</p>
        </div>

        <div className="mb-8 border-b border-border">
          <nav className="flex gap-1">
            {tabs
              .filter((t) => !t.adminOnly || isAdmin)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative px-3.5 py-2.5 text-sm font-medium transition ${
                    tab === t.id ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {t.label}
                  {tab === t.id && (
                    <span className="absolute inset-x-3.5 -bottom-px h-0.5 rounded-full bg-accent" />
                  )}
                </button>
              ))}
          </nav>
        </div>

        <div className="animate-fade-up">
          {tab === "chat" && <ChatTab workspaceId={workspaceId} />}
          {tab === "documents" && <DocumentsTab workspaceId={workspaceId} />}
          {tab === "members" && <MembersTab workspaceId={workspaceId} />}
          {tab === "api-keys" && isAdmin && <ApiKeysTab workspaceId={workspaceId} />}
          {tab === "admin" && isAdmin && <AdminTab workspaceId={workspaceId} />}
        </div>
      </main>
    </div>
  );
}
