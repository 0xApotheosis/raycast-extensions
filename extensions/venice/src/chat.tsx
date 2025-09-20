import { ActionPanel, Action, Icon, List, showToast, Toast, LocalStorage, confirmAlert, Alert } from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";

import { VeniceClient } from "./api/client";
import { useDefaultModel } from "./hooks/useDefaultModel";
import {
  readConversationsCache,
  loadConversationsFromStorage,
  writeConversationsStorage,
  readLastConversationIdCache,
  loadLastConversationIdFromStorage,
  writeLastConversationId,
} from "./storage/conversations";
import { getModelSettings, hasCustomModelSettings } from "./utils/models";

import type { VeniceModel, ChatMessage, ModelSettings } from "./types";

type Conversation = {
  id: string;
  title: string;
  modelId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export default function Command() {
  const { model, models, error } = useDefaultModel("chat");
  const [currentModelId, setCurrentModelId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const cached = readConversationsCache() ?? [];
    return [...cached].sort((a, b) => b.updatedAt - a.updatedAt);
  });
  const [currentId, setCurrentId] = useState<string | undefined>(() => {
    const cached = readConversationsCache() ?? [];
    const sorted = [...cached].sort((a, b) => b.updatedAt - a.updatedAt);
    const lastId = readLastConversationIdCache();
    return lastId && sorted.some((c) => c.id === lastId) ? lastId : sorted[0]?.id;
  });
  const [stream, setStream] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [caretOn, setCaretOn] = useState(false);
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettings>>({});
  const [customSettingsModels, setCustomSettingsModels] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const pendingSelectIdRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(true);
  const defaultModelSetRef = useRef<boolean>(false);

  useEffect(() => {
    // Load the default model when models become available
    if (model && !defaultModelSetRef.current) {
      (async () => {
        const saved = await LocalStorage.getItem<string>("venice_default_model");
        if (saved && models?.find((m) => m.id === saved)) {
          setCurrentModelId(saved);
        } else if (model) {
          setCurrentModelId(model.id);
          // Persist default if missing
          try {
            await LocalStorage.setItem("venice_default_model", model.id);
          } catch {
            // ignore
          }
        }
        defaultModelSetRef.current = true;
      })();
    }
  }, [model, models]);

  // Additional check: if we have models but currentModelId is not set correctly, fix it
  useEffect(() => {
    if (models && models.length > 0 && currentModelId) {
      const saved = LocalStorage.getItem<string>("venice_default_model");
      saved
        .then((savedId) => {
          if (savedId && savedId !== currentModelId && models.find((m) => m.id === savedId)) {
            setCurrentModelId(savedId);
          }
        })
        .catch(() => {
          // Ignore errors
        });
    }
  }, [models, currentModelId]);

  // Load conversations on mount and reconcile selection from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadConversationsFromStorage();
        const lastId = await loadLastConversationIdFromStorage();
        if (stored && stored.length > 0) {
          const sorted = [...stored].sort((a, b) => b.updatedAt - a.updatedAt);
          setConversations(sorted);
          // Refresh synchronous cache for future warm-starts
          await writeConversationsStorage(sorted);
          const exists = lastId && sorted.some((c) => c.id === lastId);
          setCurrentId(exists ? lastId : sorted[0]?.id);
        }
      } catch {
        // ignore parse errors
      } finally {
        isInitializingRef.current = false;
      }
    })();
  }, []);

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
    await LocalStorage.setItem("venice_default_model", modelId);
    if (currentConversation) {
      const updated: Conversation = { ...currentConversation, modelId, updatedAt: currentConversation.updatedAt };
      await save(conversations.map((c) => (c.id === currentConversation.id ? updated : c)));
    }
  }

  // Blink caret while streaming
  useEffect(() => {
    if (!isStreaming) {
      setCaretOn(false);
      return;
    }
    const id = setInterval(() => setCaretOn((v) => !v), 500);
    return () => clearInterval(id);
  }, [isStreaming]);

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

  function conversationToMarkdown(conv: Conversation): string {
    const parts = conv.messages.map((m) => {
      const name = m.role === "user" ? "You" : m.role === "assistant" ? "Venice AI" : m.role;
      return `**${name}:**\n${m.content}`;
    });
    return parts.join("\n\n---\n\n");
  }

  async function save(updated: Conversation[]): Promise<Conversation[]> {
    const sorted = [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(sorted);
    await writeConversationsStorage(sorted);
    return sorted;
  }

  // Determine the preferred model id for new chats
  async function resolvePreferredModelId(): Promise<string | undefined> {
    // 1) Use currentModelId if it exists and is valid
    if (currentModelId && models?.some((m) => m.id === currentModelId)) {
      return currentModelId;
    }
    // 2) Use saved default if present and valid
    try {
      const saved = await LocalStorage.getItem<string>("venice_default_model");
      if (saved && models?.some((m) => m.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    // 3) Fall back to hook-provided first model, then list first
    if (model?.id) return model.id;
    return models?.[0]?.id;
  }

  async function ensureConversation(): Promise<{ conv: Conversation; list: Conversation[] }> {
    if (currentConversation) return { conv: currentConversation, list: conversations };
    const preferredModelId = await resolvePreferredModelId();
    const conv: Conversation = {
      id: `${Date.now()}`,
      title: "New Chat",
      modelId: preferredModelId ?? "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [conv, ...conversations];
    const updatedList = await save(next);
    setCurrentId(conv.id);
    // Ensure UI state reflects the preferred model ASAP
    if (preferredModelId && preferredModelId !== currentModelId) {
      setCurrentModelId(preferredModelId);
    }
    return { conv, list: updatedList };
  }

  async function onSend() {
    const content = searchText.trim();
    if (!content || !currentModel) return;
    setStream("");
    setIsStreaming(true);
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
    abortRef.current?.abort();
    abortRef.current = new AbortController();
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
      setStream("");
      const finalConversations = await save(updatedConversations.map((c) => (c.id === conv.id ? withAssistant : c)));

      // Auto-name after first assistant reply
      if (withAssistant.messages.length >= 2 && withAssistant.title === "New Chat" && currentModel) {
        try {
          const client2 = new VeniceClient();
          const summarySettings = modelSettings[currentModel.id] || ({} as ModelSettings);
          const summary = await client2.completeChat({
            model: currentModel.id,
            messages: [
              { role: "system", content: "Summarize the conversation title in 5 words or fewer." },
              {
                role: "user",
                content: withAssistant.messages
                  .map((m) => `${m.role}: ${m.content}`)
                  .join("\n\n")
                  .slice(0, 1500),
              },
            ],
            settings: {
              max_tokens: 20,
              temperature: 0.3,
              ...summarySettings,
            },
          });
          const titled: Conversation = { ...withAssistant, title: summary.trim().replace(/\n/g, " ") || "New Chat" };
          await save(finalConversations.map((c) => (c.id === conv.id ? titled : c)));
        } catch {
          // ignore naming errors
        }
      }
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Chat failed", message: String(e) });
    } finally {
      setIsStreaming(false);
    }
  }

  async function onNewChat() {
    const id = `${Date.now()}`;
    const preferredModelId = await resolvePreferredModelId();
    const conv: Conversation = {
      id,
      title: "New Chat",
      modelId: preferredModelId ?? "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [conv, ...conversations];
    await save(next);
    pendingSelectIdRef.current = id;
    setCurrentId(id);
    await writeLastConversationId(id);
    setStream("");
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
      setCurrentId(next[0]?.id);
      if (next[0]?.id) await writeLastConversationId(next[0].id);
      setStream("");
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
      onSelectionChange={async (id) => {
        if (isInitializingRef.current) {
          return; // ignore selection changes during initial load to prevent flicker
        }
        const next = id ?? undefined;
        // Suppress transient selection changes when we just created a chat
        if (pendingSelectIdRef.current) {
          if (next !== pendingSelectIdRef.current) {
            return; // ignore flicker event
          }
          pendingSelectIdRef.current = null;
        }
        if (next !== currentId) {
          setCurrentId(next);
          if (next) await writeLastConversationId(next);
        }
      }}
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
              <Action title="Open" onAction={() => setCurrentId(c.id)} />
              <Action.CopyToClipboard title="Copy Conversation" content={conversationToMarkdown(c)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
