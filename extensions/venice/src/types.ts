export interface ModelPricing {
  input: {
    usd: number;
    vcu: number;
    diem: number;
  };
  output: {
    usd: number;
    vcu: number;
    diem: number;
  };
}

export interface ModelCapabilities {
  optimizedForCode: boolean;
  quantization: string;
  supportsFunctionCalling: boolean;
  supportsReasoning: boolean;
  supportsResponseSchema: boolean;
  supportsVision: boolean;
  supportsWebSearch: boolean;
  supportsLogProbs: boolean;
}

export interface ModelConstraints {
  temperature: {
    default: number;
  };
  top_p: {
    default: number;
  };
}

export interface ModelSpec {
  pricing: ModelPricing;
  availableContextTokens: number;
  capabilities: ModelCapabilities;
  constraints: ModelConstraints;
  name: string;
  modelSource: string;
  offline: boolean;
  traits: string[];
}

export interface VeniceModel {
  created: number;
  id: string;
  model_spec: ModelSpec;
  object: string;
  owned_by: string;
  type: string;
}

export interface ModelsListResponse {
  data: VeniceModel[];
  object: string;
  type: string;
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
