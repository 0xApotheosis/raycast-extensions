import { ActionPanel, Action, Icon, List, Color, showToast, Toast, LocalStorage } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";

import AdvancedSettingsForm from "./advanced-settings";
import { useModels } from "./hooks/useModels";
import { filterModelsByCapability } from "./utils/models";

import type { VeniceModel } from "./types";

// Hook to get the default model ID
function useDefaultModelId() {
  const [defaultModelId, setDefaultModelId] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadDefaultModel = async () => {
      const saved = await LocalStorage.getItem<string>("venice_default_model");
      if (isMounted) {
        setDefaultModelId(saved);
      }
    };

    loadDefaultModel();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  // Expose a refresh function
  useEffect(() => {
    const interval = setInterval(() => {
      // Check for changes every 500ms
      LocalStorage.getItem<string>("venice_default_model")
        .then((saved) => {
          setDefaultModelId(saved);
        })
        .catch(() => {
          // Ignore errors
        });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return { defaultModelId, refresh: () => setRefreshKey((prev) => prev + 1) };
}

type CapabilityFilter = "all" | "chat" | "image";

export default function Command() {
  const { data: models, isLoading, mutate, error } = useModels();
  const [filter, setFilter] = useState<CapabilityFilter>("all");
  const filtered = useMemo(() => (models ? filterModelsByCapability(models, filter) : []), [models, filter]);

  useEffect(() => {
    if (error) {
      showToast({ style: Toast.Style.Failure, title: "Failed to load models", message: String(error) });
    }
  }, [error]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search models..."
      searchBarAccessory={<CapabilityDropdown value={filter} onChange={setFilter} />}
      filtering
      throttle
    >
      {filtered?.map((m) => (
        <ModelItem key={m.id} model={m} onRefresh={mutate} />
      ))}
    </List>
  );
}

function CapabilityDropdown(props: { value: CapabilityFilter; onChange: (v: CapabilityFilter) => void }) {
  return (
    <List.Dropdown
      tooltip="Filter by capability"
      value={props.value}
      onChange={(v) => props.onChange(v as CapabilityFilter)}
    >
      <List.Dropdown.Item title="All" value="all" />
      <List.Dropdown.Item title="Chat" value="chat" />
      <List.Dropdown.Item title="Image" value="image" />
    </List.Dropdown>
  );
}

function ModelItem({ model, onRefresh }: { model: VeniceModel; onRefresh: () => void }) {
  const { defaultModelId } = useDefaultModelId();

  const accessories: Array<{ tag?: { value: string; color?: Color.ColorLike }; text?: string }> = [
    { tag: { value: model.capabilities.join(", "), color: Color.Blue } },
  ];

  // Add Default tag if this model is the default
  if (defaultModelId === model.id) {
    accessories.unshift({ tag: { value: "Default", color: Color.Green } });
  }

  if (model.contextWindow) accessories.push({ text: `${model.contextWindow} tokens` });

  return (
    <List.Item
      icon={Icon.Cog}
      title={model.name || model.id}
      subtitle={model.description}
      accessories={accessories}
      actions={<ModelActions model={model} onRefresh={onRefresh} />}
    />
  );
}

function ModelActions({ model, onRefresh }: { model: VeniceModel; onRefresh: () => void }) {
  return (
    <ActionPanel>
      <Action
        title="Set as Default Model"
        icon={Icon.Checkmark}
        onAction={async () => {
          try {
            await LocalStorage.setItem("venice_default_model", model.id);
            await showToast({ style: Toast.Style.Success, title: `${model.name || model.id} set as default` });
            onRefresh(); // Refresh the models list and trigger default model refresh
          } catch (e) {
            await showToast({ style: Toast.Style.Failure, title: "Failed to set default", message: String(e) });
          }
        }}
      />
      <Action.Push
        title="Advanced Settings"
        icon={Icon.Gear}
        target={<AdvancedSettingsForm model={model} onRefresh={onRefresh} />}
      />
      <Action.CopyToClipboard title="Copy Model ID" content={model.id} />
    </ActionPanel>
  );
}
