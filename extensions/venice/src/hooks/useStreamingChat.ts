import { useEffect, useRef, useState } from "react";

import { UI_CONSTANTS } from "../constants";

/**
 * Hook to manage streaming chat state (stream content, streaming status, caret blinking).
 */
export function useStreamingChat() {
  const [stream, setStream] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [caretOn, setCaretOn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Blink caret while streaming
  useEffect(() => {
    if (!isStreaming) {
      setCaretOn(false);
      return;
    }
    const id = setInterval(() => setCaretOn((v) => !v), UI_CONSTANTS.CARET_BLINK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isStreaming]);

  /**
   * Resets the streaming state.
   */
  const resetStream = () => {
    setStream("");
    setIsStreaming(false);
  };

  /**
   * Starts a new streaming session.
   */
  const startStreaming = () => {
    setStream("");
    setIsStreaming(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
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
  };
}
