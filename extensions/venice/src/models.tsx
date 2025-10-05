import { ActionPanel, Action, Icon, List, Color, showToast, Toast, LocalStorage } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";

import AdvancedSettingsForm from "./advanced-settings";
import { STORAGE_KEYS } from "./constants";
import { useModels } from "./hooks/useModels";
import { filterModelsByCapability, hasCustomModelSettings } from "./utils/models";

import type { VeniceModel } from "./types";

// Hook to get the default model ID
function useDefaultModelId() {
  const [defaultModelId, setDefaultModelId] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    const loadDefaultModel = async () => {
      try {
        const saved = await LocalStorage.getItem<string>(STORAGE_KEYS.DEFAULT_MODEL);
        if (isMounted) {
          setDefaultModelId(saved);
        }
      } catch {
        if (isMounted) {
          setDefaultModelId(undefined);
        }
      }
    };

    loadDefaultModel();

    return () => {
      isMounted = false;
    };
  }, []);

  return { defaultModelId, setDefaultModelId };
}

type CapabilityFilter = "all" | "chat" | "image";

export default function Command() {
  const { data: models, isLoading, mutate, error } = useModels();
  const [filter, setFilter] = useState<CapabilityFilter>("all");
  const { defaultModelId, setDefaultModelId } = useDefaultModelId();
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
        <ModelItem
          key={m.id}
          model={m}
          onRefresh={mutate}
          defaultModelId={defaultModelId}
          setDefaultModelId={setDefaultModelId}
        />
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

function ModelItem({
  model,
  onRefresh,
  defaultModelId,
  setDefaultModelId,
}: {
  model: VeniceModel;
  onRefresh: () => void;
  defaultModelId?: string;
  setDefaultModelId: (id: string | undefined) => void;
}) {
  const [hasCustom, setHasCustom] = useState<boolean>(false);

  async function refreshCustomState() {
    try {
      const custom = await hasCustomModelSettings(model.id);
      setHasCustom(custom);
    } catch {
      setHasCustom(false);
    }
  }

  useEffect(() => {
    refreshCustomState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  const accessories: Array<{ tag?: { value: string; color?: Color.ColorLike }; text?: string }> = [];

  if (defaultModelId === model.id) {
    accessories.push({ tag: { value: "Default", color: Color.Green } });
  }
  if (hasCustom) {
    accessories.push({ tag: { value: "Custom", color: Color.Orange } });
  }
  accessories.push({ tag: { value: model.capabilities.join(", "), color: Color.Blue } });
  if (model.contextWindow) accessories.push({ text: `${model.contextWindow} tokens` });

  // Wrap onRefresh to also refresh local custom state explicitly
  const handleRefresh = async () => {
    await refreshCustomState();
    onRefresh();
  };

  const handleSetAsDefault = async () => {
    try {
      await LocalStorage.setItem(STORAGE_KEYS.DEFAULT_MODEL, model.id);
      setDefaultModelId(model.id); // Update state immediately - this will be shared across all ModelItems
      await showToast({ style: Toast.Style.Success, title: `${model.name || model.id} set as default` });
      onRefresh(); // Refresh the models list
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to set default", message: String(e) });
    }
  };

  return (
    <List.Item
      icon={Icon.Cog}
      title={model.name || model.id}
      subtitle={model.description}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action title="Set as Default Model" icon={Icon.Checkmark} onAction={handleSetAsDefault} />
          <Action.Push
            title="Advanced Settings"
            icon={Icon.Gear}
            target={<AdvancedSettingsForm model={model} onRefresh={handleRefresh} />}
          />
          <Action.CopyToClipboard title="Copy Model ID" content={model.id} />
        </ActionPanel>
      }
    />
  );
}
