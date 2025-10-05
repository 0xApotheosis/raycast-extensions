/**
 * Date formatting utilities for consistent date display throughout the application.
 */

/**
 * Formats a timestamp as a relative time string (e.g., "2 hours ago", "yesterday").
 *
 * @param timestamp - The timestamp in milliseconds
 * @returns A human-readable relative time string
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  } else if (days === 1) {
    return "yesterday";
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
};

/**
 * Formats a timestamp as a short date string (e.g., "Jan 15, 2024").
 *
 * @param timestamp - The timestamp in milliseconds
 * @returns A formatted date string
 */
export const formatShortDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Formats a timestamp as a full datetime string (e.g., "Jan 15, 2024 at 3:45 PM").
 *
 * @param timestamp - The timestamp in milliseconds
 * @returns A formatted datetime string
 */
export const formatFullDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
