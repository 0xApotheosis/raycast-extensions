import type { Conversation } from "../storage/conversations";

/**
 * Sorts conversations by updatedAt timestamp in descending order (newest first).
 */
export const sortConversationsByDate = (conversations: Conversation[]): Conversation[] => {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
};
