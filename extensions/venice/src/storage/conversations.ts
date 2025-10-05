import { Cache, LocalStorage } from "@raycast/api";

import { STORAGE_KEYS } from "../constants";

import type { ChatMessage } from "../types";

const cache = new Cache();

/**
 * Conversation type with full messages (used by UI components).
 */
export type Conversation = {
  id: string;
  title: string;
  modelId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

/**
 * Loads conversations from LocalStorage.
 *
 * @returns Array of conversations or undefined if not found/error
 */
export async function loadConversationsFromStorage(): Promise<Conversation[] | undefined> {
  try {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return undefined;
    return JSON.parse(raw) as Conversation[];
  } catch {
    return undefined;
  }
}

/**
 * Writes conversations to LocalStorage with cache write-through.
 *
 * @param conversations - Array of conversations to store
 */
export async function writeConversationsStorage(conversations: Conversation[]): Promise<void> {
  // Write-through: persistent LocalStorage + synchronous Cache for instant reads
  const data = JSON.stringify(conversations);
  try {
    await LocalStorage.setItem(STORAGE_KEYS.CONVERSATIONS, data);
    cache.set(STORAGE_KEYS.CONVERSATIONS, data);
  } catch (error) {
    // If LocalStorage fails, still update cache as a fallback
    // This ensures the cache stays in sync even if persistent storage fails
    cache.set(STORAGE_KEYS.CONVERSATIONS, data);
    throw error;
  }
}

/**
 * Loads the last active conversation ID from LocalStorage.
 *
 * @returns The last conversation ID or undefined if not found
 */
export async function loadLastConversationIdFromStorage(): Promise<string | undefined> {
  try {
    const id = await LocalStorage.getItem<string>(STORAGE_KEYS.LAST_CONVERSATION);
    return id ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes the last active conversation ID to LocalStorage with cache write-through.
 *
 * @param id - The conversation ID to store
 */
export async function writeLastConversationId(id: string): Promise<void> {
  try {
    await LocalStorage.setItem(STORAGE_KEYS.LAST_CONVERSATION, id);
    cache.set(STORAGE_KEYS.LAST_CONVERSATION, id);
  } catch (error) {
    // If LocalStorage fails, still update cache as a fallback
    cache.set(STORAGE_KEYS.LAST_CONVERSATION, id);
    throw error;
  }
}
