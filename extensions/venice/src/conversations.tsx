import {
  Action,
  ActionPanel,
  Alert,
  Form,
  Icon,
  LaunchType,
  List,
  useNavigation,
  confirmAlert,
  launchCommand,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";

import {
  loadConversationsFromStorage,
  writeConversationsStorage,
  writeLastConversationId,
} from "./storage/conversations";

import type { ChatMessage } from "./types";

type Conversation = {
  id: string;
  title: string;
  modelId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export default function Command() {
  const { push } = useNavigation();
  const [searchText, setSearchText] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await loadConversationsFromStorage<Conversation>();
      if (stored) {
        try {
          setConversations(stored.sort((a, b) => b.updatedAt - a.updatedAt));
        } catch {
          // ignore parse errors
        }
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      const text = c.messages
        .map((m) => m.content)
        .join("\n")
        .toLowerCase();
      return text.includes(q);
    });
  }, [conversations, searchText]);

  function toMarkdown(conv: Conversation): string {
    const parts = conv.messages.map((m) => {
      const name = m.role === "user" ? "You" : m.role === "assistant" ? "Venice AI" : m.role;
      return `**${name}:**\n${m.content}`;
    });
    return parts.join("\n\n---\n\n");
  }

  async function remove(id: string) {
    const ok = await confirmAlert({
      title: "Delete Conversation?",
      message: "This will remove the conversation permanently from your device.",
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
      icon: Icon.Trash,
    });
    if (!ok) return;
    const next = conversations.filter((c) => c.id !== id);
    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(sorted);
    await writeConversationsStorage(sorted);
  }

  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search conversations by title or content"
      isShowingDetail
    >
      {filtered.map((c) => (
        <List.Item
          key={c.id}
          id={c.id}
          title={c.title}
          accessories={[{ date: new Date(c.updatedAt) }]}
          detail={<List.Item.Detail markdown={toMarkdown(c)} />}
          actions={
            <ActionPanel>
              <Action
                title="Open in Chat"
                icon={Icon.Sidebar}
                onAction={async () => {
                  await writeLastConversationId(c.id);
                  await launchCommand({ name: "chat", type: LaunchType.UserInitiated });
                }}
              />
              <Action.CopyToClipboard title="Copy Markdown" content={toMarkdown(c)} />
              <Action
                title="Rename"
                icon={Icon.Pencil}
                onAction={async () => {
                  const onRename = async (title: string) => {
                    const next = conversations.map((x) => (x.id === c.id ? { ...x, title, updatedAt: Date.now() } : x));
                    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
                    setConversations(sorted);
                    await writeConversationsStorage(sorted);
                  };
                  push(<RenameForm initial={c.title} onSubmit={onRename} />);
                }}
              />
              <Action title="Delete" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => remove(c.id)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function RenameForm(props: { initial: string; onSubmit: (title: string) => Promise<void> }) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save"
            onSubmit={async (values: { title: string }) => {
              await props.onSubmit(values.title.trim() || props.initial);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" defaultValue={props.initial} />
    </Form>
  );
}
