"use client";

import { useEffect, useRef, useState } from "react";
import { documents as documentsApi, ApiError } from "@/lib/api";
import type { Document } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-surface-hover text-text-secondary",
  processing: "bg-warm-soft text-warm",
  completed: "bg-success-soft text-success",
  failed: "bg-danger-soft text-danger",
};

const FILE_ICON: Record<string, string> = {
  pdf: "▤",
  docx: "▥",
  txt: "▦",
  md: "▧",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ workspaceId }: { workspaceId: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => documentsApi.list(workspaceId).then(setDocs);

  useEffect(() => {
    load().finally(() => setLoading(false));

    const interval = setInterval(() => {
      setDocs((current) => {
        if (current.some((d) => d.status === "pending" || d.status === "processing")) {
          load();
        }
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const doc = await documentsApi.upload(workspaceId, file);
      setDocs((prev) => [doc, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await documentsApi.delete(workspaceId, id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
            id="doc-upload"
          />
          <label
            htmlFor="doc-upload"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            {uploading ? "Uploading..." : "Upload document"}
          </label>
          <span className="ml-3 text-xs text-text-muted">PDF, DOCX, TXT, or MD</span>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-text-muted">No documents yet. Upload one to make it searchable in chat.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3">Filename</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => (
                <tr key={doc.id} className="bg-surface transition hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    <span className="mr-2 text-text-muted">{FILE_ICON[doc.file_type] || "▤"}</span>
                    {doc.filename}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatBytes(doc.file_size_bytes)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.status]}`}>
                      {doc.status}
                    </span>
                    {doc.status === "failed" && doc.error_message && (
                      <p className="mt-1 text-xs text-danger">{doc.error_message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-xs text-text-muted transition hover:text-danger"
                    >
                      Delete
                    </button>
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
