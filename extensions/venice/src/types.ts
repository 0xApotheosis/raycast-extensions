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

export type VeniceCapability = "chat" | "image";

export interface VeniceModel {
  id: string;
  name: string;
  description: string;
  capabilities: VeniceCapability[];
  contextWindow?: number;
  created?: number;
  model_spec?: ModelSpec;
  object?: string;
  owned_by?: string;
  type?: string;
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

export interface StoredConversation {
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

// Venice AI API Types
export interface VeniceParameters {
  character_slug?: string;
  strip_thinking_response?: boolean;
  disable_thinking?: boolean;
  enable_web_search?: "off" | "on" | "auto";
  enable_web_citations?: boolean;
  include_search_results_in_stream?: boolean;
  return_search_results_as_documents?: boolean;
  include_venice_system_prompt?: boolean;
}

export interface LogProbs {
  content?: Array<{
    token: string;
    logprob: number;
    bytes?: number[];
    top_logprobs?: Array<{
      token: string;
      logprob: number;
      bytes?: number[];
    }>;
  }>;
}

export interface StreamOptions {
  include_usage?: boolean;
}

export interface JsonSchema {
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
}

export interface ResponseFormat {
  type: "text" | "json_object" | "json_schema";
  json_schema?: {
    name?: string;
    description?: string;
    schema?: JsonSchema;
    strict?: boolean;
  };
}

export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
}

export interface Tool {
  id?: string;
  type: "function";
  function: ToolFunction;
}

export interface ToolChoice {
  type: "none" | "auto" | "required" | "function";
  function?: {
    name: string;
  };
}

export interface CompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatCompletionRequest {
  model: string;
  messages: CompletionMessage[];
  frequency_penalty?: number;
  logprobs?: boolean;
  top_logprobs?: number;
  max_completion_tokens?: number;
  max_temp?: number;
  max_tokens?: number;
  min_p?: number;
  min_temp?: number;
  n?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  seed?: number;
  stop?: string | string[];
  stop_token_ids?: number[];
  stream?: boolean;
  stream_options?: StreamOptions;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  user?: string;
  venice_parameters?: VeniceParameters;
  parallel_tool_calls?: boolean;
  response_format?: ResponseFormat;
  tool_choice?: ToolChoice;
  tools?: Tool[];
}

export interface Usage {
  completion_tokens?: number;
  prompt_tokens?: number;
  total_tokens?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: CompletionMessage;
  logprobs?: LogProbs | null;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: Usage;
  system_fingerprint?: string;
}

export interface ChatCompletionStreamChoice {
  index: number;
  delta: Partial<CompletionMessage>;
  logprobs?: LogProbs | null;
  finish_reason?: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null;
}

export interface ChatCompletionStreamResponse {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionStreamChoice[];
  usage?: Usage;
  system_fingerprint?: string;
}
