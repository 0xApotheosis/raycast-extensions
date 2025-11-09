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
import { useEffect, useMemo, useState, useCallback } from "react";

import {
  loadConversationsFromStorage,
  writeConversationsStorage,
  writeLastConversationId,
  type Conversation,
} from "./storage/conversations";
import { formatRelativeTime } from "./utils/date";
import { conversationToMarkdown } from "./utils/markdown";
import { sortConversationsByDate } from "./utils/sorting";

export default function Command() {
  const { push } = useNavigation();
  const [searchText, setSearchText] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await loadConversationsFromStorage();
      if (stored) {
        try {
          setConversations(sortConversationsByDate(stored));
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

  const remove = useCallback(
    async (id: string) => {
      const ok = await confirmAlert({
        title: "Delete Conversation?",
        message: "This will remove the conversation permanently from your device.",
        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
        icon: Icon.Trash,
      });
      if (!ok) return;
      const next = conversations.filter((c) => c.id !== id);
      const sorted = sortConversationsByDate(next);
      setConversations(sorted);
      await writeConversationsStorage(sorted);
    },
    [conversations]
  );

  const deleteHandlers = useMemo(() => {
    const handlers = new Map<string, () => Promise<void>>();
    filtered.forEach((c) => {
      handlers.set(c.id, () => remove(c.id));
    });
    return handlers;
  }, [filtered, remove]);

  const openInChatHandlers = useMemo(() => {
    const handlers = new Map<string, () => Promise<void>>();
    filtered.forEach((c) => {
      handlers.set(c.id, async () => {
        await writeLastConversationId(c.id);
        await launchCommand({ name: "chat", type: LaunchType.UserInitiated });
      });
    });
    return handlers;
  }, [filtered]);

  const renameCallbacks = useMemo(() => {
    const callbacks = new Map<string, (title: string) => Promise<void>>();
    filtered.forEach((c) => {
      callbacks.set(c.id, async (title: string) => {
        const next = conversations.map((x) => (x.id === c.id ? { ...x, title, updatedAt: Date.now() } : x));
        const sorted = sortConversationsByDate(next);
        setConversations(sorted);
        await writeConversationsStorage(sorted);
      });
    });
    return callbacks;
  }, [filtered, conversations]);

  const renameHandlers = useMemo(() => {
    const handlers = new Map<string, () => Promise<void>>();
    filtered.forEach((c) => {
      const callback = renameCallbacks.get(c.id);
      if (callback) {
        handlers.set(c.id, async () => {
          push(<RenameForm initial={c.title} onSubmit={callback} />);
        });
      }
    });
    return handlers;
  }, [filtered, push, renameCallbacks]);

  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search conversations by title or content"
      isShowingDetail
    >
      {filtered.map((c) => {
        const deleteHandler = deleteHandlers.get(c.id);
        const openHandler = openInChatHandlers.get(c.id);
        const renameHandler = renameHandlers.get(c.id);
        if (!deleteHandler || !openHandler || !renameHandler) return null;

        return (
          <List.Item
            key={c.id}
            id={c.id}
            title={c.title}
            accessories={[{ text: formatRelativeTime(c.updatedAt) }]}
            detail={<List.Item.Detail markdown={conversationToMarkdown(c)} />}
            actions={
              <ActionPanel>
                <Action title="Open in Chat" icon={Icon.Sidebar} onAction={openHandler} />
                <Action.CopyToClipboard title="Copy Markdown" content={conversationToMarkdown(c)} />
                <Action title="Rename" icon={Icon.Pencil} onAction={renameHandler} />
                <Action title="Delete" icon={Icon.Trash} style={Action.Style.Destructive} onAction={deleteHandler} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function RenameForm(props: { initial: string; onSubmit: (title: string) => Promise<void> }) {
  const { pop } = useNavigation();

  const handleSubmit = useCallback(
    async (values: { title: string }) => {
      await props.onSubmit(values.title.trim() || props.initial);
      pop();
    },
    [props, pop]
  );

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" defaultValue={props.initial} />
    </Form>
  );
}
