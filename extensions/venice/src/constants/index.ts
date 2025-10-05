import type { ModelSettings } from "../types";

/**
 * Storage keys for LocalStorage and Cache
 */
export const STORAGE_KEYS = {
  CONVERSATIONS: "venice_conversations_v1",
  LAST_CONVERSATION: "venice_last_conversation_id",
  DEFAULT_MODEL: "venice_default_model",
  MODEL_SETTINGS: (modelId: string) => `venice_settings_${modelId}`,
  MODELS_CACHE: "venice_models_v1",
} as const;

/**
 * Default model settings used across the application
 */
export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 2048,
} as const;

/**
 * UI-related constants
 */
export const UI_CONSTANTS = {
  NEW_CHAT_TITLE: "New Chat",
  CARET_BLINK_INTERVAL_MS: 500,
  AUTO_NAME_PROMPT_MAX_LENGTH: 1500,
  AUTO_NAME_MAX_TOKENS: 20,
  AUTO_NAME_TEMPERATURE: 0.3,
  AUTO_NAME_SYSTEM_PROMPT: "Summarize the conversation for a title in 5 words or fewer.",
  MODELS_CACHE_TTL_MS: 1000 * 60 * 30, // 30 minutes
} as const;
