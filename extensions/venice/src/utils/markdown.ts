import type { Conversation } from "../storage/conversations";

/**
 * Converts a conversation to Markdown format for display or export.
 * Each message is formatted with the role name and content, separated by horizontal rules.
 *
 * @param conversation - The conversation to convert
 * @returns A markdown-formatted string representation of the conversation
 */
export const conversationToMarkdown = (conversation: Conversation): string => {
  const parts = conversation.messages.map((m) => {
    const name = m.role === "user" ? "You" : m.role === "assistant" ? "Venice AI" : m.role;
    return `**${name}:**\n${m.content}`;
  });
  return parts.join("\n\n---\n\n");
};
