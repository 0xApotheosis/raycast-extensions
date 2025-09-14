export type VeniceCapability = "chat" | "image";

export interface VeniceModel {
  id: string;
  name: string;
  description?: string;
  capabilities: VeniceCapability[];
  contextWindow?: number;
}

export interface ModelSettings {
  temperature: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: number; // epoch ms
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ImageAsset {
  id: string;
  conversationId?: string;
  prompt: string;
  modelId: string;
  filePath: string; // absolute path under environment.supportPath
  size: { width: number; height: number };
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  type: "text" | "end" | "error";
  data?: string;
}
