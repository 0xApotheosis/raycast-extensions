import { showToast, Toast } from "@raycast/api";

/**
 * Centralized error handling utility.
 * Logs the error to console and displays a toast notification to the user.
 *
 * @param error - The error that occurred
 * @param context - A descriptive context of where/what failed
 * @param options - Optional configuration for toast display
 */
export const handleError = async (
  error: unknown,
  context: string,
  options?: {
    hideToast?: boolean;
    logToConsole?: boolean;
  },
): Promise<void> => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Always log to console for debugging unless explicitly disabled
  if (options?.logToConsole !== false) {
    console.error(`[${context}]`, error);
  }

  // Show toast unless explicitly hidden
  if (!options?.hideToast) {
    await showToast({
      style: Toast.Style.Failure,
      title: `${context} failed`,
      message: errorMessage,
    });
  }
};

/**
 * Safe async wrapper that handles errors with context.
 * Useful for wrapping async operations in try-catch with automatic error handling.
 *
 * @param fn - Async function to execute
 * @param context - Context description for error handling
 * @param onError - Optional custom error handler
 * @returns The result of the function or undefined if it fails
 */
export const safeAsync = async <T>(
  fn: () => Promise<T>,
  context: string,
  onError?: (error: unknown) => void,
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    await handleError(error, context);
    onError?.(error);
    return undefined;
  }
};
