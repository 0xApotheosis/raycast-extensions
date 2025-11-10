import { useEffect, useRef, useState, useTransition } from "react";

import { VeniceClient } from "../api/client";
import { UI_CONSTANTS } from "../constants";
import { handleError } from "../utils/errors";

import type { Conversation } from "../storage/conversations";
import type { VeniceModel, ModelSettings } from "../types";

/**
 * Stream state for a single conversation
 */
interface StreamState {
  stream: string;
  streamBuffer: string;
  updateTimeout: NodeJS.Timeout | null;
  abortController: AbortController;
}

/**
 * Streaming chat hook that handles multiple concurrent chat streams
 */
export function useChatStreaming() {
  // Track active streams per conversation ID
  const streamStatesRef = useRef<Map<string, StreamState>>(new Map());
  const [activeStreams, setActiveStreams] = useState<Set<string>>(new Set());
  const [caretOn, setCaretOn] = useState(false);

  // Blink caret while any stream is active
  useEffect(() => {
    if (activeStreams.size === 0) {
      setCaretOn(false);
      return;
    }

    // Blink at a reasonable rate to show activity without excessive re-renders
    const id = setInterval(() => {
      setCaretOn((v) => !v);
    }, UI_CONSTANTS.CARET_BLINK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [activeStreams.size]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      streamStatesRef.current.forEach((state) => {
        if (state.updateTimeout) {
          clearTimeout(state.updateTimeout);
        }
        state.abortController.abort();
      });
      streamStatesRef.current.clear();
    };
  }, []);

  /**
   * Gets or creates a stream state for a conversation
   */
  const getOrCreateStreamState = (conversationId: string): StreamState => {
    let state = streamStatesRef.current.get(conversationId);
    if (!state) {
      state = {
        stream: "",
        streamBuffer: "",
        updateTimeout: null,
        abortController: new AbortController(),
      };
      streamStatesRef.current.set(conversationId, state);
    }
    return state;
  };

  /**
   * Debounced stream update function for a specific conversation
   * Updates ref-based stream buffer without triggering React state changes
   */
  const updateStream = (conversationId: string) => {
    const state = streamStatesRef.current.get(conversationId);
    if (!state) return;

    // Cancel any pending update for this conversation
    if (state.updateTimeout) {
      clearTimeout(state.updateTimeout);
    }

    // Debounce updates to reduce overhead - just update the ref
    state.updateTimeout = setTimeout(() => {
      state.stream = state.streamBuffer;
    }, 16); // ~60fps update rate
  };

  /**
   * Resets the streaming state for a specific conversation
   */
  const resetStream = (conversationId?: string) => {
    if (conversationId) {
      const state = streamStatesRef.current.get(conversationId);
      if (state) {
        if (state.updateTimeout) {
          clearTimeout(state.updateTimeout);
        }
        state.abortController.abort();
        streamStatesRef.current.delete(conversationId);
      }
      setActiveStreams((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
    } else {
      // Reset all streams
      streamStatesRef.current.forEach((state) => {
        if (state.updateTimeout) {
          clearTimeout(state.updateTimeout);
        }
        state.abortController.abort();
      });
      streamStatesRef.current.clear();
      setActiveStreams(new Set());
    }
  };

  /**
   * Starts a new streaming session for a conversation
   */
  const startStreaming = (conversationId: string) => {
    // Clean up any existing stream for this conversation
    resetStream(conversationId);

    // Create new stream state
    const state = getOrCreateStreamState(conversationId);
    state.stream = "";
    state.streamBuffer = "";

    setActiveStreams((prev) => new Set(prev).add(conversationId));
  };

  /**
   * Sends a message and streams the response
   */
  const sendMessage = async ({
    conversation,
    message,
    model,
    settings,
    onUserMessage,
    onComplete,
    onError,
  }: {
    conversation: Conversation;
    message: string;
    model: VeniceModel;
    settings: ModelSettings;
    onUserMessage: (conversation: Conversation) => Promise<void>;
    onComplete: (conversation: Conversation) => Promise<void>;
    onError: (error: unknown) => void;
  }) => {
    const client = VeniceClient.getInstance();
    const conversationId = conversation.id;
    let assistantText = "";

    try {
      startStreaming(conversationId);
      const state = getOrCreateStreamState(conversationId);

      // Add user message to conversation
      const now = Date.now();
      const withUser: Conversation = {
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            id: `${now}-u`,
            conversationId: conversation.id,
            role: "user",
            content: message,
            createdAt: now,
          },
        ],
        updatedAt: now, // Only update timestamp when user sends message
        modelId: model.id,
      };

      // Persist user message to storage immediately
      await onUserMessage(withUser);

      // Stream the assistant response
      await client.streamChat({
        model: model.id,
        messages: withUser.messages.map((m) => ({ role: m.role, content: m.content })),
        settings: {
          temperature: settings.temperature,
          top_p: settings.topP,
          top_k: settings.topK,
          max_tokens: settings.maxTokens,
        },
        onChunk: (c) => {
          if (c.type === "text" && c.data) {
            assistantText += c.data;
            state.streamBuffer += c.data;
            // Debounced update - only updates in-memory ref, no state changes
            updateStream(conversationId);
          }
        },
        signal: state.abortController.signal,
      });

      // Add assistant message to conversation
      const doneAt = Date.now();
      const withAssistant: Conversation = {
        ...withUser,
        messages: [
          ...withUser.messages,
          {
            id: `${doneAt}-a`,
            conversationId: withUser.id,
            role: "assistant",
            content: assistantText,
            createdAt: doneAt,
          },
        ],
        // Keep the original updatedAt from user message, don't update on assistant response
        updatedAt: withUser.updatedAt,
      };

      resetStream(conversationId);
      await onComplete(withAssistant);

      return withAssistant;
    } catch (error) {
      resetStream(conversationId);
      onError(error);
      throw error;
    }
  };

  /**
   * Auto-generates a conversation title using the AI
   */
  const generateTitle = async ({
    conversation,
    model,
    settings,
  }: {
    conversation: Conversation;
    model: VeniceModel;
    settings: ModelSettings;
  }): Promise<string> => {
    const client = VeniceClient.getInstance();

    try {
      const summary = await client.completeChat({
        model: model.id,
        messages: [
          { role: "system", content: UI_CONSTANTS.AUTO_NAME_SYSTEM_PROMPT },
          {
            role: "user",
            content: conversation.messages
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n\n")
              .slice(0, UI_CONSTANTS.AUTO_NAME_PROMPT_MAX_LENGTH),
          },
        ],
        settings: {
          max_tokens: UI_CONSTANTS.AUTO_NAME_MAX_TOKENS,
          temperature: UI_CONSTANTS.AUTO_NAME_TEMPERATURE,
          ...(settings.topP !== undefined && { top_p: settings.topP }),
          ...(settings.topK !== undefined && { top_k: settings.topK }),
          ...(settings.maxTokens !== undefined && { max_tokens: settings.maxTokens }),
        },
        veniceParameters: {
          disable_thinking: true,
        },
      });

      return summary.trim().replace(/\n/g, " ") || UI_CONSTANTS.NEW_CHAT_TITLE;
    } catch (error) {
      await handleError(error, "Chat naming");
      return UI_CONSTANTS.NEW_CHAT_TITLE;
    }
  };

  /**
   * Cancels streaming for a specific conversation or all conversations
   */
  const cancelStreaming = (conversationId?: string) => {
    resetStream(conversationId);
  };

  /**
   * Checks if a specific conversation is currently streaming
   */
  const isConversationStreaming = (conversationId: string): boolean => {
    return activeStreams.has(conversationId);
  };

  /**
   * Gets the current stream content for a conversation
   */
  const getStreamContent = (conversationId: string): string => {
    return streamStatesRef.current.get(conversationId)?.stream || "";
  };

  return {
    // State queries
    isStreaming: activeStreams.size > 0,
    activeStreams,
    caretOn,
    isConversationStreaming,
    getStreamContent,
    // Actions
    resetStream,
    startStreaming,
    sendMessage,
    generateTitle,
    cancelStreaming,
  };
}
