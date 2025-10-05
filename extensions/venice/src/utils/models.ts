import { DEFAULT_MODEL_SETTINGS, STORAGE_KEYS } from "../constants";

import type { VeniceCapability, VeniceModel, ModelSettings } from "../types";

export function filterModelsByCapability(models: VeniceModel[], capability: "all" | VeniceCapability): VeniceModel[] {
  if (capability === "all") return models;
  return models.filter((m) => (m.capabilities ?? []).includes(capability));
}

export async function getModelSettings(modelId: string): Promise<ModelSettings> {
  try {
    const { LocalStorage } = await import("@raycast/api");
    const saved = await LocalStorage.getItem<string>(STORAGE_KEYS.MODEL_SETTINGS(modelId));
    if (saved) {
      const parsed = JSON.parse(saved) as ModelSettings;
      return { ...DEFAULT_MODEL_SETTINGS, ...parsed };
    }
  } catch {
    // Return defaults if parsing fails
  }

  return DEFAULT_MODEL_SETTINGS;
}

export async function hasCustomModelSettings(modelId: string): Promise<boolean> {
  try {
    const { LocalStorage } = await import("@raycast/api");
    const saved = await LocalStorage.getItem<string>(STORAGE_KEYS.MODEL_SETTINGS(modelId));
    if (!saved) return false;

    const parsed = JSON.parse(saved) as ModelSettings;
    return (
      parsed.temperature !== DEFAULT_MODEL_SETTINGS.temperature ||
      parsed.topP !== DEFAULT_MODEL_SETTINGS.topP ||
      parsed.topK !== DEFAULT_MODEL_SETTINGS.topK ||
      parsed.maxTokens !== DEFAULT_MODEL_SETTINGS.maxTokens
    );
  } catch {
    return false;
  }
}
