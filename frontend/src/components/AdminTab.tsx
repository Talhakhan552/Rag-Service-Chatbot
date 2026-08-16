"use client";

import { useEffect, useState } from "react";
import { admin as adminApi } from "@/lib/api";
import type { WorkspaceStats } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminTab({ workspaceId }: { workspaceId: string }) {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);

  useEffect(() => {
    adminApi.stats(workspaceId).then(setStats);
  }, [workspaceId]);

  if (!stats) return <p className="text-sm text-slate-500">Loading...</p>;

  const cards = [
    { label: "Documents", value: stats.document_count },
    { label: "Chunks", value: stats.chunk_count },
    { label: "Storage used", value: formatBytes(stats.total_storage_bytes) },
    { label: "Chat sessions", value: stats.chat_session_count },
    { label: "Messages", value: stats.message_count },
    { label: "Members", value: stats.member_count },
    { label: "Active API keys", value: stats.active_api_key_count },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      {Object.keys(stats.documents_by_status).length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-slate-700">Documents by status</h3>
          <div className="flex gap-2">
            {Object.entries(stats.documents_by_status).map(([status, count]) => (
              <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
