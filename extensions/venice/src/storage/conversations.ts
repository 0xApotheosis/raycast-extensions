import { Cache, LocalStorage } from "@raycast/api";

import type { Conversation } from "./types";

const cache = new Cache();

const STORAGE_KEY = "venice_conversations_v1";
const LAST_ID_KEY = "venice_last_conversation_id";

export function readConversationsCache(): Conversation[] | undefined {
  const raw = cache.get(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Conversation[];
  } catch {
    return undefined;
  }
}

export async function loadConversationsFromStorage(): Promise<Conversation[] | undefined> {
  try {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as Conversation[];
  } catch {
    return undefined;
  }
}

export async function writeConversationsStorage(conversations: Conversation[]): Promise<void> {
  // Write-through: persistent LocalStorage + synchronous Cache for instant reads
  const data = JSON.stringify(conversations);
  try {
    await LocalStorage.setItem(STORAGE_KEY, data);
    cache.set(STORAGE_KEY, data);
  } catch (error) {
    // If LocalStorage fails, still update cache as a fallback
    // This ensures the cache stays in sync even if persistent storage fails
    cache.set(STORAGE_KEY, data);
    throw error;
  }
}

export function readLastConversationIdCache(): string | undefined {
  const id = cache.get(LAST_ID_KEY);
  return id || undefined;
}

export async function loadLastConversationIdFromStorage(): Promise<string | undefined> {
  try {
    const id = await LocalStorage.getItem<string>(LAST_ID_KEY);
    return id ?? undefined;
  } catch {
    return undefined;
  }
}

export async function writeLastConversationId(id: string): Promise<void> {
  try {
    await LocalStorage.setItem(LAST_ID_KEY, id);
    cache.set(LAST_ID_KEY, id);
  } catch (error) {
    // If LocalStorage fails, still update cache as a fallback
    cache.set(LAST_ID_KEY, id);
    throw error;
  }
}
