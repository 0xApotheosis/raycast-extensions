import { useEffect, useRef, useReducer, useCallback } from "react";

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
 * Conversation state management actions
 */
type ConversationAction =
  | { type: "SET_CONVERSATIONS"; payload: Conversation[] }
  | { type: "SET_CURRENT_ID"; payload: string | undefined }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "UPDATE_CONVERSATION"; payload: Conversation }
  | { type: "DELETE_CONVERSATION"; payload: string }
  | { type: "SET_INITIALIZING"; payload: boolean };

/**
 * Conversation state interface
 */
interface ConversationState {
  conversations: Conversation[];
  currentId: string | undefined;
  isInitializing: boolean;
}

/**
 * Conversation reducer function
 */
function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.payload };
    case "SET_CURRENT_ID":
      return { ...state, currentId: action.payload };
    case "ADD_CONVERSATION":
      return { ...state, conversations: [action.payload, ...state.conversations] };
    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case "DELETE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.filter((c) => c.id !== action.payload),
        currentId: state.currentId === action.payload ? undefined : state.currentId,
      };
    case "SET_INITIALIZING":
      return { ...state, isInitializing: action.payload };
    default:
      return state;
  }
}

/**
 * Hook to manage conversations state and operations.
 * Handles loading, saving, creating, and selecting conversations.
 */
export function useConversationManager() {
  const [state, dispatch] = useReducer(conversationReducer, {
    conversations: [],
    currentId: undefined,
    isInitializing: true,
  });
  const pendingSelectIdRef = useRef<string | null>(null);

  // Load conversations on mount and reconcile selection from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadConversationsFromStorage();
        const lastId = await loadLastConversationIdFromStorage();
        if (stored && stored.length > 0) {
          const sorted = sortConversationsByDate(stored);
          dispatch({ type: "SET_CONVERSATIONS", payload: sorted });
          const exists = lastId && sorted.some((c) => c.id === lastId);
          dispatch({ type: "SET_CURRENT_ID", payload: exists ? lastId : sorted[0]?.id });
        }
      } catch {
        // ignore parse errors
      } finally {
        dispatch({ type: "SET_INITIALIZING", payload: false });
      }
    })();
  }, []);

  /**
   * Saves conversations to storage and updates state.
   */
  const save = useCallback(async (updated: Conversation[]): Promise<Conversation[]> => {
    const sorted = sortConversationsByDate(updated);
    dispatch({ type: "SET_CONVERSATIONS", payload: sorted });
    await writeConversationsStorage(sorted);
    return sorted;
  }, []);

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
  const selectConversation = useCallback(async (id: string | undefined) => {
    if (state.isInitializing) {
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
    if (next !== state.currentId) {
      dispatch({ type: "SET_CURRENT_ID", payload: next });
      if (next) await writeLastConversationId(next);
    }
  }, [state.isInitializing, state.currentId]);

  return {
    conversations: state.conversations,
    currentId: state.currentId,
    setCurrentId: (id: string | undefined) => dispatch({ type: "SET_CURRENT_ID", payload: id }),
    save,
    resolvePreferredModelId,
    selectConversation,
    isInitializingRef: { current: state.isInitializing },
    pendingSelectIdRef,
  };
}
