import { ActionPanel, Action, Icon, List, showToast, Toast, LocalStorage, confirmAlert, Alert } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";

import { VeniceClient } from "./api/client";
import { STORAGE_KEYS, UI_CONSTANTS } from "./constants";
import { useChatModel } from "./hooks/useChatModel";
import { useConversationManager } from "./hooks/useConversationManager";
import { useDefaultModel } from "./hooks/useDefaultModel";
import { useStreamingChat } from "./hooks/useStreamingChat";
import { type Conversation } from "./storage/conversations";
import { handleError } from "./utils/errors";
import { conversationToMarkdown } from "./utils/markdown";
import { getModelSettings, hasCustomModelSettings } from "./utils/models";

import type { VeniceModel, ModelSettings } from "./types";

export default function Command() {
  const { model, models, error } = useDefaultModel("chat");
  const { currentModelId, setCurrentModelId } = useChatModel(models, model);
  const { conversations, currentId, save, resolvePreferredModelId, selectConversation, pendingSelectIdRef } =
    useConversationManager();
  const { stream, setStream, isStreaming, setIsStreaming, caretOn, abortRef, startStreaming, resetStream } =
    useStreamingChat();

  const [searchText, setSearchText] = useState("");
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettings>>({});
  const [customSettingsModels, setCustomSettingsModels] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (error) showToast({ style: Toast.Style.Failure, title: "Models error", message: String(error) });
  }, [error]);

  // Load model settings
  useEffect(() => {
    if (!models) return;
    (async () => {
      const settings: Record<string, ModelSettings> = {};
      const customModels = new Set<string>();
      for (const model of models) {
        settings[model.id] = await getModelSettings(model.id);
        if (await hasCustomModelSettings(model.id)) {
          customModels.add(model.id);
        }
      }
      setModelSettings(settings);
      setCustomSettingsModels(customModels);
    })();
  }, [models]);

  const currentConversation: Conversation | undefined = useMemo(
    () => conversations.find((c) => c.id === currentId),
    [conversations, currentId],
  );

  const currentModel: VeniceModel | undefined = useMemo(() => {
    // Priority order: current conversation model > saved default > first model
    const targetModelId = currentConversation?.modelId ?? currentModelId;
    return models?.find((m) => m.id === targetModelId) || models?.[0] || undefined;
  }, [models, currentConversation?.modelId, currentModelId]);

  async function onModelChange(modelId: string) {
    setCurrentModelId(modelId);
    await LocalStorage.setItem(STORAGE_KEYS.DEFAULT_MODEL, modelId);
    if (currentConversation) {
      const updated: Conversation = { ...currentConversation, modelId, updatedAt: currentConversation.updatedAt };
      await save(conversations.map((c) => (c.id === currentConversation.id ? updated : c)));
    }
  }

  const currentMarkdown = useMemo(() => {
    if (!currentConversation) return "";
    const parts = currentConversation.messages.map((m) => {
      const name = m.role === "user" ? "You" : m.role === "assistant" ? "Venice AI" : m.role;
      return `**${name}:**\n${m.content}`;
    });
    if (stream || isStreaming) {
      const caret = isStreaming && caretOn ? " ▍" : "";
      parts.push(`**Venice AI (streaming):**\n${stream}${caret}`);
    }
    return parts.join("\n\n---\n\n");
  }, [currentConversation, stream, isStreaming, caretOn]);

  async function ensureConversation(): Promise<{ conv: Conversation; list: Conversation[] }> {
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
    const next = [conv, ...conversations];
    const updatedList = await save(next);
    await selectConversation(conv.id);
    // Ensure UI state reflects the preferred model ASAP
    if (preferredModelId && preferredModelId !== currentModelId) {
      setCurrentModelId(preferredModelId);
    }
    return { conv, list: updatedList };
  }

  async function onSend() {
    const content = searchText.trim();
    if (!content || !currentModel) return;
    startStreaming();
    const { conv, list } = await ensureConversation();
    const now = Date.now();
    const withUser: Conversation = {
      ...conv,
      messages: [...conv.messages, { id: `${now}-u`, conversationId: conv.id, role: "user", content, createdAt: now }],
      updatedAt: now,
      modelId: currentModel.id,
    };
    const base = list.some((c) => c.id === conv.id) ? list : [conv, ...list];
    const updatedConversations = await save(base.map((c) => (c.id === conv.id ? withUser : c)));
    setSearchText("");

    const client = new VeniceClient();
    let assistantText = "";
    try {
      const settings = modelSettings[currentModel.id] || ({} as ModelSettings);
      await client.streamChat({
        model: currentModel.id,
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
            setStream((prev) => prev + c.data);
          }
        },
        signal: abortRef.current.signal,
      });
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
      const finalConversations = await save(updatedConversations.map((c) => (c.id === conv.id ? withAssistant : c)));

      // Auto-name after first assistant reply
      if (withAssistant.messages.length >= 2 && withAssistant.title === UI_CONSTANTS.NEW_CHAT_TITLE && currentModel) {
        try {
          const client2 = new VeniceClient();
          const summarySettings = modelSettings[currentModel.id] || ({} as ModelSettings);
          const summary = await client2.completeChat({
            model: currentModel.id,
            messages: [
              { role: "system", content: UI_CONSTANTS.AUTO_NAME_SYSTEM_PROMPT },
              {
                role: "user",
                content: withAssistant.messages
                  .map((m) => `${m.role}: ${m.content}`)
                  .join("\n\n")
                  .slice(0, UI_CONSTANTS.AUTO_NAME_PROMPT_MAX_LENGTH),
              },
            ],
            settings: {
              max_tokens: UI_CONSTANTS.AUTO_NAME_MAX_TOKENS,
              temperature: UI_CONSTANTS.AUTO_NAME_TEMPERATURE,
              ...(summarySettings.topP !== undefined && { top_p: summarySettings.topP }),
              ...(summarySettings.topK !== undefined && { top_k: summarySettings.topK }),
              ...(summarySettings.maxTokens !== undefined && { max_tokens: summarySettings.maxTokens }),
            },
            veniceParameters: {
              disable_thinking: true,
            },
          });
          const titled: Conversation = {
            ...withAssistant,
            title: summary.trim().replace(/\n/g, " ") || UI_CONSTANTS.NEW_CHAT_TITLE,
          };
          await save(finalConversations.map((c) => (c.id === conv.id ? titled : c)));
        } catch (e) {
          await handleError(e, "Chat naming");
        }
      }
    } catch (e) {
      await handleError(e, "Chat");
    } finally {
      setIsStreaming(false);
    }
  }

  async function onNewChat() {
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
    const next = [conv, ...conversations];
    await save(next);
    pendingSelectIdRef.current = id;
    await selectConversation(id);
    resetStream();
    // Ensure UI model picker reflects the preferred model immediately
    if (preferredModelId && preferredModelId !== currentModelId) {
      setCurrentModelId(preferredModelId);
    }
  }

  async function onDelete(id?: string) {
    const targetId = id ?? currentId;
    if (!targetId) return;
    const ok = await confirmAlert({
      title: "Delete Conversation?",
      message: "This will remove the conversation permanently from your device.",
      icon: Icon.Trash,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;
    const next = conversations.filter((c) => c.id !== targetId);
    await save(next);
    if (currentId === targetId) {
      await selectConversation(next[0]?.id);
      resetStream();
    }
  }

  return (
    <List
      isLoading={isStreaming}
      isShowingDetail
      searchBarPlaceholder="Ask a question privately... (Press Enter to send)"
      selectedItemId={currentId}
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}
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
      onSelectionChange={selectConversation}
      actions={
        <ActionPanel>
          <Action title="Send Message" icon={Icon.Airplane} onAction={onSend} />
          <Action title="New Chat" icon={Icon.Plus} onAction={onNewChat} shortcut={{ modifiers: ["cmd"], key: "n" }} />
          <Action
            title="Delete Chat"
            icon={Icon.Trash}
            onAction={() => onDelete()}
            shortcut={{ modifiers: ["cmd"], key: "backspace" }}
          />
          <Action
            title="Cancel Streaming"
            icon={Icon.Stop}
            onAction={() => abortRef.current?.abort()}
            shortcut={{ modifiers: ["cmd"], key: "." }}
          />
        </ActionPanel>
      }
    >
      {conversations.map((c) => (
        <List.Item
          id={c.id}
          key={c.id}
          title={c.title}
          accessories={[
            ...(c.id === currentId && isStreaming ? [{ text: "Typing…" as const }] : []),
            { date: new Date(c.updatedAt) },
          ]}
          detail={<List.Item.Detail markdown={c.id === currentId ? currentMarkdown : undefined} />}
          actions={
            <ActionPanel>
              <Action title="Send Message" icon={Icon.Airplane} onAction={onSend} />
              <Action title="New Chat" icon={Icon.Plus} onAction={onNewChat} />
              <Action title="Delete Chat" icon={Icon.Trash} onAction={() => onDelete(c.id)} />
              <Action
                title="Cancel Streaming"
                icon={Icon.Stop}
                onAction={() => abortRef.current?.abort()}
                shortcut={{ modifiers: ["cmd"], key: "." }}
              />
              <Action title="Open" onAction={() => selectConversation(c.id)} />
              <Action.CopyToClipboard title="Copy Conversation" content={conversationToMarkdown(c)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
