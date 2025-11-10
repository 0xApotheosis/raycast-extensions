import { useEffect, useRef, useState, useTransition } from "react";

import { VeniceClient } from "../api/client";
import { UI_CONSTANTS } from "../constants";
import { handleError } from "../utils/errors";

import type { Conversation } from "../storage/conversations";
import type { VeniceModel, ModelSettings } from "../types";

/**
 * Streaming chat hook that handles the complete chat streaming flow
 */
export function useChatStreaming() {
  const [stream, setStream] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [caretOn, setCaretOn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [isPending, startTransition] = useTransition();

  // Batch streaming updates to reduce re-renders
  const streamBufferRef = useRef("");
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced stream update function
  const updateStream = () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      startTransition(() => {
        setStream(streamBufferRef.current);
      });
    }, 16); // ~60fps update rate
  };

  // Blink caret while streaming (debounced)
  useEffect(() => {
    if (!isStreaming) {
      setCaretOn(false);
      return;
    }

    // Debounce caret updates to reduce CPU usage
    const id = setInterval(() => {
      startTransition(() => {
        setCaretOn((v) => !v);
      });
    }, UI_CONSTANTS.CARET_BLINK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isStreaming]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Resets the streaming state.
   */
  const resetStream = () => {
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    streamBufferRef.current = "";
    setStream("");
    setIsStreaming(false);
  };

  /**
   * Starts a new streaming session.
   */
  const startStreaming = () => {
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    streamBufferRef.current = "";
    setStream("");
    setIsStreaming(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
  };

  /**
   * Sends a message and streams the response
   */
  const sendMessage = async ({
    conversation,
    message,
    model,
    settings,
    onUpdate,
    onComplete,
    onError,
  }: {
    conversation: Conversation;
    message: string;
    model: VeniceModel;
    settings: ModelSettings;
    onUpdate: (conversation: Conversation) => void;
    onComplete: (conversation: Conversation) => void;
    onError: (error: unknown) => void;
  }) => {
    const client = VeniceClient.getInstance();
    let assistantText = "";

    try {
      startStreaming();

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
        updatedAt: now,
        modelId: model.id,
      };

      onUpdate(withUser);

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
            streamBufferRef.current += c.data;
            updateStream(); // Batched update
          }
        },
        signal: abortRef.current?.signal,
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
        updatedAt: doneAt,
      };

      resetStream();
      onComplete(withAssistant);

      return withAssistant;
    } catch (error) {
      resetStream();
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
   * Cancels the current streaming operation
   */
  const cancelStreaming = () => {
    abortRef.current?.abort();
    resetStream();
  };

  return {
    stream,
    setStream,
    isStreaming,
    setIsStreaming,
    caretOn,
    abortRef,
    resetStream,
    startStreaming,
    sendMessage,
    generateTitle,
    cancelStreaming,
    isPending, // Expose transition state for UI optimization
  };
}
