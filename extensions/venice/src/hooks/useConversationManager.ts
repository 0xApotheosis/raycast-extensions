import { useEffect, useReducer, useCallback } from "react";

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
        conversations: state.conversations.map((c) => (c.id === action.payload.id ? action.payload : c)),
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

  // Load conversations on mount and reconcile selection from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadConversationsFromStorage();
        const lastId = await loadLastConversationIdFromStorage();
        if (stored && stored.length > 0) {
          const sorted = sortConversationsByDate(stored);
          const exists = lastId && sorted.some((c) => c.id === lastId);
          const initialId = exists ? lastId : sorted[0]?.id;

          dispatch({ type: "SET_CONVERSATIONS", payload: sorted });
          dispatch({ type: "SET_CURRENT_ID", payload: initialId });
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
    defaultModel: VeniceModel | undefined
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
   * Updates the current conversation selection and persists it.
   */
  const setConversation = useCallback(
    async (id: string | undefined) => {
      if (id !== state.currentId) {
        dispatch({ type: "SET_CURRENT_ID", payload: id });
        if (id) await writeLastConversationId(id);
      }
    },
    [state.currentId]
  );

  /**
   * Synchronously sets the current conversation ID without persisting.
   * Used to ensure UI state is correct before triggering re-renders.
   */
  const setCurrentId = useCallback((id: string | undefined) => {
    dispatch({ type: "SET_CURRENT_ID", payload: id });
  }, []);

  return {
    conversations: state.conversations,
    currentId: state.currentId,
    save,
    resolvePreferredModelId,
    setConversation,
    setCurrentId,
  };
}
