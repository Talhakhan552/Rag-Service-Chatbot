export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  my_role: WorkspaceRole;
}

export interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  role: WorkspaceRole;
  joined_at: string;
}

export type DocumentStatus = "pending" | "processing" | "completed" | "failed";
export type DocumentType = "pdf" | "docx" | "txt" | "md";

export interface Document {
  id: string;
  filename: string;
  file_type: DocumentType;
  file_size_bytes: number;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Source {
  chunk_id: string;
  document_id: string;
  filename: string;
  snippet: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  sources: Source[] | null;
  created_at: string;
}

export interface ApiKeyCreated {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface WorkspaceStats {
  document_count: number;
  documents_by_status: Record<string, number>;
  chunk_count: number;
  total_storage_bytes: number;
  chat_session_count: number;
  message_count: number;
  member_count: number;
  active_api_key_count: number;
}
