import { ActionPanel, Action, Icon, List, showToast, Toast, LocalStorage, confirmAlert, Alert } from "@raycast/api";
import { useEffect, useState, useRef, useMemo } from "react";

import { STORAGE_KEYS, UI_CONSTANTS } from "./constants";
import { useChatModel } from "./hooks/useChatModel";
import { useChatStreaming } from "./hooks/useChatStreaming";
import { useConversationManager } from "./hooks/useConversationManager";
import { useDefaultModel } from "./hooks/useDefaultModel";
import { type Conversation, writeLastConversationId } from "./storage/conversations";
import { formatRelativeTime } from "./utils/date";
import { handleError } from "./utils/errors";
import { conversationToMarkdown } from "./utils/markdown";
import { getModelSettings, hasCustomModelSettings } from "./utils/models";

import type { VeniceModel, ModelSettings } from "./types";

function ConversationListItem({
  conversation,
  isSelected,
  isStreaming,
  markdown,
  onSend,
  onNewChat,
  onDelete,
  onDeleteAll,
  onCancelStreaming,
}: {
  conversation: Conversation;
  isSelected: boolean;
  isStreaming: boolean;
  markdown: string | undefined;
  onSend: () => void;
  onNewChat: () => void;
  onDelete: () => void;
  onDeleteAll: () => void;
  onCancelStreaming: () => void;
}) {
  const accessories = [];
  if (isStreaming) {
    accessories.push({ text: "Typing…" });
  }
  accessories.push({ text: formatRelativeTime(conversation.updatedAt) });

  return (
    <List.Item
      id={conversation.id}
      title={conversation.title}
      accessories={accessories}
      detail={<List.Item.Detail markdown={markdown} />}
      actions={
        <ActionPanel>
          <Action title="Send Message" icon={Icon.Airplane} onAction={onSend} />
          <Action title="New Chat" icon={Icon.Plus} onAction={onNewChat} shortcut={{ modifiers: ["cmd"], key: "n" }} />
          <Action
            title="Delete Chat"
            icon={Icon.Trash}
            onAction={onDelete}
            shortcut={{ modifiers: ["cmd"], key: "backspace" }}
          />
          <Action
            title="Delete All Conversations"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            onAction={onDeleteAll}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
          />
          <Action
            title="Cancel Streaming"
            icon={Icon.Stop}
            onAction={onCancelStreaming}
            shortcut={{ modifiers: ["cmd"], key: "." }}
          />
          <Action.CopyToClipboard title="Copy Conversation" content={conversationToMarkdown(conversation)} />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const { model, models, error, isLoading: isLoadingModels } = useDefaultModel("chat");
  const { currentModelId, setCurrentModelId } = useChatModel(models, model);
  const { conversations, currentId, isInitializing, save, resolvePreferredModelId, setConversation, setCurrentId } =
    useConversationManager();
  const {
    isStreaming,
    isConversationStreaming,
    getStreamContent,
    caretOn,
    resetStream,
    sendMessage,
    generateTitle,
    cancelStreaming,
  } = useChatStreaming();

  const [searchText, setSearchText] = useState("");
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettings>>({});
  const [customSettingsModels, setCustomSettingsModels] = useState<Set<string>>(new Set());

  // Track when we're doing a programmatic update to ignore ALL onSelectionChange events
  const isProgrammaticUpdateRef = useRef(false);

  // Keep a ref to always have the latest conversations state for async callbacks
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (error) showToast({ style: Toast.Style.Failure, title: "Models error", message: String(error) });
  }, [error]);

  // Load model settings
  useEffect(() => {
    if (!models) return;
    (async () => {
      const settings: Record<string, ModelSettings> = {};
      const customModels = new Set<string>();

      // Batch load all settings in parallel
      const settingsPromises = models.map(async (model) => {
        const [modelSettings, hasCustom] = await Promise.all([
          getModelSettings(model.id),
          hasCustomModelSettings(model.id),
        ]);
        return { modelId: model.id, settings: modelSettings, hasCustom };
      });

      const results = await Promise.all(settingsPromises);

      results.forEach(({ modelId, settings: modelSettings, hasCustom }) => {
        settings[modelId] = modelSettings;
        if (hasCustom) {
          customModels.add(modelId);
        }
      });

      setModelSettings(settings);
      setCustomSettingsModels(customModels);
    })();
  }, [models]);

  const currentConversation: Conversation | undefined = conversations.find((c) => c.id === currentId);

  // Priority order: current conversation model > saved default > first model
  const targetModelId = currentConversation?.modelId ?? currentModelId;
  const currentModel: VeniceModel | undefined = models?.find((m) => m.id === targetModelId) || models?.[0] || undefined;

  const onModelChange = async (modelId: string) => {
    setCurrentModelId(modelId);
    await LocalStorage.setItem(STORAGE_KEYS.DEFAULT_MODEL, modelId);
    if (currentConversation) {
      const updated: Conversation = { ...currentConversation, modelId, updatedAt: currentConversation.updatedAt };
      // Use ref to get latest state in case of rapid model changes
      const currentConvs = conversationsRef.current;
      await save(currentConvs.map((c) => (c.id === currentConversation.id ? updated : c)));
    }
  };

  // Memoize markdown generation to avoid unnecessary recalculations
  const currentMarkdown = useMemo(() => {
    if (!currentConversation) return "";

    const parts = currentConversation.messages.map((m) => {
      const name = m.role === "user" ? "You" : m.role === "assistant" ? "Venice AI" : m.role;
      return `**${name}:**\n${m.content}`;
    });

    const streamContent = getStreamContent(currentConversation.id);
    if (streamContent || isConversationStreaming(currentConversation.id)) {
      const caret = isConversationStreaming(currentConversation.id) && caretOn ? " ▍" : "";
      parts.push(`**Venice AI (streaming):**\n${streamContent}${caret}`);
    }

    return parts.join("\n\n---\n\n");
  }, [currentConversation, caretOn, getStreamContent, isConversationStreaming]);

  const ensureConversation = async (): Promise<{ conv: Conversation; list: Conversation[] }> => {
    if (currentConversation) return { conv: currentConversation, list: conversations };
    const preferredModelId = await resolvePreferredModelId(currentModelId, models, model);
    const conv: Conversation = {
      id: `${Date.now()}`,
      title: UI_CONSTANTS.NEW_CHAT_TITLE,
      modelId: preferredModelId ?? "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Mark that we're doing a programmatic update to ignore ALL onSelectionChange events
    isProgrammaticUpdateRef.current = true;

    // Set selection synchronously BEFORE save triggers re-render
    setCurrentId(conv.id);
    const next = [conv, ...conversations];
    const updatedList = await save(next);
    // Persist to storage (manual since we already updated currentId)
    await writeLastConversationId(conv.id);

    // Clear the programmatic flag after a brief moment
    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 100);

    // Ensure UI state reflects the preferred model ASAP
    if (preferredModelId && preferredModelId !== currentModelId) {
      setCurrentModelId(preferredModelId);
    }
    return { conv, list: updatedList };
  };

  const onSend = async () => {
    const content = searchText.trim();
    if (!content || !currentModel) return;

    // Clear input immediately for better UX
    setSearchText("");

    const { conv } = await ensureConversation();
    const conversationId = conv.id;
    const settings = modelSettings[currentModel.id] || ({} as ModelSettings);

    try {
      await sendMessage({
        conversation: conv,
        message: content,
        model: currentModel,
        settings,
        // Save user message immediately (once), moves conversation to top
        onUserMessage: async (conversationWithUserMsg) => {
          // Use ref to always get current conversations state (not stale closure)
          const currentConvs = conversationsRef.current;
          await save(
            currentConvs.some((c) => c.id === conversationId)
              ? currentConvs.map((c) => (c.id === conversationId ? conversationWithUserMsg : c))
              : [conversationWithUserMsg, ...currentConvs]
          );
        },
        // Save complete conversation when streaming finishes
        onComplete: async (completedConv) => {
          // Use ref to always get current conversations state to avoid overwriting concurrent updates
          const currentConvs = conversationsRef.current;
          const finalConversations = await save(
            currentConvs.some((c) => c.id === conversationId)
              ? currentConvs.map((c) => (c.id === conversationId ? completedConv : c))
              : [completedConv, ...currentConvs]
          );

          // Auto-name after first assistant reply
          if (
            completedConv.messages.length >= 2 &&
            completedConv.title === UI_CONSTANTS.NEW_CHAT_TITLE &&
            currentModel
          ) {
            try {
              const title = await generateTitle({
                conversation: completedConv,
                model: currentModel,
                settings,
              });
              const titled: Conversation = {
                ...completedConv,
                title,
              };
              // Use ref to get latest state - avoids overwriting concurrent title generations
              const latestConvs = conversationsRef.current;
              await save(latestConvs.map((c) => (c.id === conversationId ? titled : c)));
            } catch (e) {
              await handleError(e, "Chat naming");
            }
          }
        },
        onError: async (error) => {
          await handleError(error, "Chat");
        },
      });
    } catch (error) {
      await handleError(error, "Chat");
    }
  };

  const onNewChat = async () => {
    const id = `${Date.now()}`;
    const preferredModelId = await resolvePreferredModelId(currentModelId, models, model);
    const conv: Conversation = {
      id,
      title: UI_CONSTANTS.NEW_CHAT_TITLE,
      modelId: preferredModelId ?? "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Mark that we're doing a programmatic update to ignore ALL onSelectionChange events
    isProgrammaticUpdateRef.current = true;

    // Set selection synchronously BEFORE save triggers re-render
    setCurrentId(id);
    const next = [conv, ...conversations];
    await save(next);
    // Persist to storage (manual since we already updated currentId)
    await writeLastConversationId(id);

    // Clear the programmatic flag after a brief moment
    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 100);

    // Don't reset any streams - allow multiple conversations to stream concurrently

    // Ensure UI model picker reflects the preferred model immediately
    if (preferredModelId && preferredModelId !== currentModelId) {
      setCurrentModelId(preferredModelId);
    }
  };

  const onDelete = async (id?: string) => {
    const targetId = id ?? currentId;
    if (!targetId) return;
    const ok = await confirmAlert({
      title: "Delete Conversation?",
      message: "This will remove the conversation permanently from your device.",
      icon: Icon.Trash,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;

    // Find the index of the conversation being deleted
    const deletedIndex = conversations.findIndex((c) => c.id === targetId);
    const next = conversations.filter((c) => c.id !== targetId);

    // Select the conversation at the same index, or the previous one if we deleted the last
    const nextIndex = Math.min(deletedIndex, next.length - 1);
    const nextId = next[nextIndex]?.id;

    // Mark that we're doing a programmatic update to ignore ALL onSelectionChange events
    isProgrammaticUpdateRef.current = true;

    // Set selection synchronously BEFORE save triggers re-render
    setCurrentId(nextId);
    await save(next);
    // Persist to storage (manual since we already updated currentId)
    if (nextId) await writeLastConversationId(nextId);

    // Clear the programmatic flag after a brief moment
    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 100);

    // Reset only the stream for the deleted conversation
    resetStream(targetId);
  };

  // Create delete handlers for each conversation
  const deleteHandlers = new Map<string, () => Promise<void>>();
  conversations.forEach((c) => {
    deleteHandlers.set(c.id, () => onDelete(c.id));
  });

  const onDeleteAll = async () => {
    if (conversations.length === 0) return;
    const ok = await confirmAlert({
      title: "Delete All Conversations?",
      message: `This will permanently delete all ${conversations.length} conversation${conversations.length > 1 ? "s" : ""} from your device.`,
      icon: Icon.Trash,
      primaryAction: { title: "Delete All", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;

    // Mark that we're doing a programmatic update to ignore ALL onSelectionChange events
    isProgrammaticUpdateRef.current = true;

    setCurrentId(undefined);
    await save([]);
    await writeLastConversationId("");

    // Clear the programmatic flag after a brief moment
    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 100);

    // Reset all streams
    resetStream();
    await showToast({
      style: Toast.Style.Success,
      title: "All Conversations Deleted",
    });
  };

  const handleSelectionChange = (id: string | null) => {
    // Ignore ALL selection changes during programmatic updates
    if (isProgrammaticUpdateRef.current) {
      return;
    }
    // Only update if actually different
    if (id && id !== currentId) {
      setConversation(id);
    }
  };

  return (
    <List
      isLoading={isLoadingModels || isInitializing || isStreaming}
      isShowingDetail
      searchBarPlaceholder="Ask a question privately... (Press Enter to send)"
      selectedItemId={currentId}
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      onSelectionChange={handleSelectionChange}
      searchBarAccessory={
        <List.Dropdown tooltip="Select Model" value={currentModel?.id ?? currentModelId} onChange={onModelChange}>
          {models?.map((m) => (
            <List.Dropdown.Item
              key={m.id}
              value={m.id}
              title={m.name}
              icon={customSettingsModels.has(m.id) ? Icon.Gear : undefined}
            />
          ))}
        </List.Dropdown>
      }
      actions={
        <ActionPanel>
          <Action title="Send Message" icon={Icon.Airplane} onAction={onSend} />
          <Action title="New Chat" icon={Icon.Plus} onAction={onNewChat} shortcut={{ modifiers: ["cmd"], key: "n" }} />
          <Action
            title="Delete Chat"
            icon={Icon.Trash}
            onAction={onDelete}
            shortcut={{ modifiers: ["cmd"], key: "backspace" }}
          />
          <Action
            title="Delete All Conversations"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            onAction={onDeleteAll}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
          />
          <Action
            title="Cancel Streaming"
            icon={Icon.Stop}
            onAction={cancelStreaming}
            shortcut={{ modifiers: ["cmd"], key: "." }}
          />
        </ActionPanel>
      }
    >
      {conversations.map((c) => {
        const handler = deleteHandlers.get(c.id);
        if (!handler) return null;
        return (
          <ConversationListItem
            key={c.id}
            conversation={c}
            isSelected={c.id === currentId}
            isStreaming={isConversationStreaming(c.id)}
            markdown={c.id === currentId ? currentMarkdown : undefined}
            onSend={onSend}
            onNewChat={onNewChat}
            onDelete={handler}
            onDeleteAll={onDeleteAll}
            onCancelStreaming={cancelStreaming}
          />
        );
      })}
    </List>
  );
}
