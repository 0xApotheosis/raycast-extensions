import { useEffect, useMemo, useRef, useState } from "react";
import { ActionPanel, Action, Icon, List, showToast, Toast, LocalStorage, confirmAlert, Alert } from "@raycast/api";
import { useDefaultModel } from "./hooks/useDefaultModel";
import { VeniceClient } from "./api/client";
import type { VeniceModel, ChatMessage } from "./types";
type Conversation = {
  id: string;
  title: string;
  modelId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "venice_conversations_v1";
const LAST_ID_KEY = "venice_last_conversation_id";

export default function Command() {
  const { model, models, isLoading, error } = useDefaultModel("chat");
  const [currentModelId, setCurrentModelId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const [stream, setStream] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [caretOn, setCaretOn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingSelectIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await LocalStorage.getItem<string>("venice_default_model");
      if (saved) setCurrentModelId(saved);
      else if (model) setCurrentModelId(model.id);
    })();
  }, [model?.id]);

  // Load conversations and last open conversation on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Conversation[];
          setConversations(parsed);
          const last = await LocalStorage.getItem<string>(LAST_ID_KEY);
          if (last && parsed.find((c) => c.id === last)) setCurrentId(last);
          else if (parsed.length > 0) setCurrentId(parsed[0].id);
        }
      } catch {
        // ignore parse errors
      }
    })();
  }, []);

  useEffect(() => {
    if (error) showToast({ style: Toast.Style.Failure, title: "Models error", message: String(error) });
  }, [error]);

  const currentConversation: Conversation | undefined = useMemo(
    () => conversations.find((c) => c.id === currentId),
    [conversations, currentId],
  );

  const currentModel: VeniceModel | undefined = useMemo(
    () => models?.find((m) => m.id === (currentConversation?.modelId ?? currentModelId)) || models?.[0],
    [models, currentConversation?.modelId, currentModelId],
  );

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

  function toMarkdown(conv?: Conversation): string {
    if (!conv) return "";
    const parts = conv.messages.map((m) => {
      const name = m.role === "user" ? "You" : m.role === "assistant" ? "Venice AI" : m.role;
      return `**${name}:**\n${m.content}`;
    });
    if (stream || isStreaming) {
      const caret = isStreaming && caretOn ? " ▍" : "";
      parts.push(`**Venice AI (streaming):**\n${stream}${caret}`);
    }
    return parts.join("\n\n---\n\n");
  }

  async function save(updated: Conversation[]) {
    const sorted = [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(sorted);
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  }

  function ensureConversation(): { conv: Conversation; list: Conversation[] } {
    if (currentConversation) return { conv: currentConversation, list: conversations };
    const conv: Conversation = {
      id: `${Date.now()}`,
      title: "New Chat",
      modelId: currentModel?.id ?? "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [conv, ...conversations];
    void save(next);
    setCurrentId(conv.id);
    return { conv, list: next };
  }

  async function onSend() {
    const content = searchText.trim();
    if (!content || !currentModel) return;
    setStream("");
    setIsStreaming(true);
    const { conv, list } = ensureConversation();
    const now = Date.now();
    const withUser: Conversation = {
      ...conv,
      messages: [
        ...conv.messages,
        { id: `${now}-u`, conversationId: conv.id, role: "user", content, createdAt: now },
      ],
      updatedAt: now,
      modelId: currentModel.id,
    };
    const base = list.some((c) => c.id === conv.id) ? list : [conv, ...list];
    await save(base.map((c) => (c.id === conv.id ? withUser : c)));
    setSearchText("");

    const client = new VeniceClient();
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let assistantText = "";
    try {
      await client.streamChat({
        model: currentModel.id,
        messages: withUser.messages.map((m) => ({ role: m.role, content: m.content })),
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
      await save(conversations.map((c) => (c.id === conv.id ? withAssistant : c)));

      // Auto-name after first assistant reply
      if (withAssistant.messages.length >= 2 && withAssistant.title === "New Chat" && currentModel) {
        try {
          const client2 = new VeniceClient();
          const summary = await client2.completeChat({
            model: currentModel.id,
            messages: [
              { role: "system", content: "Summarize the conversation title in 5 words or fewer." },
              { role: "user", content: withAssistant.messages.map((m) => `${m.role}: ${m.content}`).join("\n\n").slice(0, 1500) },
            ],
            settings: { max_tokens: 20, temperature: 0.3 },
          });
          const titled: Conversation = { ...withAssistant, title: summary.trim().replaceAll("\n", " ") || "New Chat" };
          await save(conversations.map((c) => (c.id === conv.id ? titled : c)));
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
    const conv: Conversation = {
      id,
      title: "New Chat",
      modelId: currentModel?.id ?? "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [conv, ...conversations];
    await save(next);
    pendingSelectIdRef.current = id;
    setCurrentId(id);
    await LocalStorage.setItem(LAST_ID_KEY, id);
    setStream("");
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
      setStream("");
    }
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <List
      isLoading={isLoading || isStreaming}
      isShowingDetail
      searchBarPlaceholder="Ask a question privately... (Press Enter to send)"
      selectedItemId={currentId}
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarAccessory={
        <List.Dropdown tooltip="Select Model" value={currentModel?.id ?? currentModelId} onChange={onModelChange}>
          {models?.map((m) => (
            <List.Dropdown.Item key={m.id} value={m.id} title={m.name} />
          ))}
        </List.Dropdown>
      }
      onSelectionChange={async (id) => {
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
          if (next) await LocalStorage.setItem(LAST_ID_KEY, next);
        }
      }}
      actions={
        <ActionPanel>
          <Action title="Send Message" icon={Icon.Airplane} onAction={onSend} />
          <Action title="New Chat" icon={Icon.Plus} onAction={onNewChat} shortcut={{ modifiers: ["cmd"], key: "n" }} />
          <Action title="Delete Chat" icon={Icon.Trash} onAction={() => onDelete()} shortcut={{ modifiers: ["cmd"], key: "backspace" }} />
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
          detail={<List.Item.Detail markdown={toMarkdown(c.id === currentId ? { ...c, messages: c.messages } : c)} />}
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
              <Action.CopyToClipboard title="Copy Conversation" content={toMarkdown(c)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
