import { Cache, LocalStorage } from "@raycast/api";

const cache = new Cache();

const STORAGE_KEY = "venice_conversations_v1";
const LAST_ID_KEY = "venice_last_conversation_id";

export function readConversationsCache<T = any>(): T[] | undefined {
  const raw = cache.get(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return undefined;
  }
}

export async function loadConversationsFromStorage<T = any>(): Promise<T[] | undefined> {
  try {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as T[];
  } catch {
    return undefined;
  }
}

export async function writeConversationsStorage<T = any>(conversations: T[]): Promise<void> {
  // Write-through: persistent LocalStorage + synchronous Cache for instant reads
  cache.set(STORAGE_KEY, JSON.stringify(conversations));
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
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
  cache.set(LAST_ID_KEY, id);
  await LocalStorage.setItem(LAST_ID_KEY, id);
}
