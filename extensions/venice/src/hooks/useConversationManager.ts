import { useEffect, useRef, useState } from "react";

import { STORAGE_KEYS } from "../constants";
import {
  loadConversationsFromStorage,
  loadLastConversationIdFromStorage,
  writeConversationsStorage,
  writeLastConversationId,
  type Conversation,
} from "../storage/conversations";
import { sortConversationsByDate } from "../utils/sorting";
import { getStoredString } from "../utils/storage";

import type { VeniceModel } from "../types";

/**
 * Hook to manage conversations state and operations.
 * Handles loading, saving, creating, and selecting conversations.
 */
export function useConversationManager() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const isInitializingRef = useRef<boolean>(true);
  const pendingSelectIdRef = useRef<string | null>(null);

  // Load conversations on mount and reconcile selection from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadConversationsFromStorage();
        const lastId = await loadLastConversationIdFromStorage();
        if (stored && stored.length > 0) {
          const sorted = sortConversationsByDate(stored);
          setConversations(sorted);
          const exists = lastId && sorted.some((c) => c.id === lastId);
          setCurrentId(exists ? lastId : sorted[0]?.id);
        }
      } catch {
        // ignore parse errors
      } finally {
        isInitializingRef.current = false;
      }
    })();
  }, []);

  /**
   * Saves conversations to storage and updates state.
   */
  const save = async (updated: Conversation[]): Promise<Conversation[]> => {
    const sorted = sortConversationsByDate(updated);
    setConversations(sorted);
    await writeConversationsStorage(sorted);
    return sorted;
  };

  /**
   * Determines the preferred model id for new chats.
   */
  const resolvePreferredModelId = async (
    currentModelId: string | undefined,
    models: VeniceModel[] | undefined,
    defaultModel: VeniceModel | undefined,
  ): Promise<string | undefined> => {
    // 1) Use currentModelId if it exists and is valid
    if (currentModelId && models?.some((m) => m.id === currentModelId)) {
      return currentModelId;
    }
    // 2) Use saved default if present and valid
    try {
      const saved = await getStoredString(STORAGE_KEYS.DEFAULT_MODEL);
      if (saved && models?.some((m) => m.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    // 3) Fall back to hook-provided first model, then list first
    if (defaultModel?.id) return defaultModel.id;
    return models?.[0]?.id;
  };

  /**
   * Updates the current conversation selection.
   */
  const selectConversation = async (id: string | undefined) => {
    if (isInitializingRef.current) {
      return; // ignore selection changes during initial load to prevent flicker
    }
    const next = id ?? undefined;
    // Suppress transient selection changes when we just created a chat
    if (pendingSelectIdRef.current) {
      if (next !== pendingSelectIdRef.current) {
        return; // ignore flicker event
      }
      pendingSelectIdRef.current = null;
    }
    if (next !== currentId) {
      setCurrentId(next);
      if (next) await writeLastConversationId(next);
    }
  };

  return {
    conversations,
    currentId,
    setCurrentId,
    save,
    resolvePreferredModelId,
    selectConversation,
    isInitializingRef,
    pendingSelectIdRef,
  };
}
