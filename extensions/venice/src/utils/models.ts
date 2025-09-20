import type { VeniceCapability, VeniceModel, ModelSettings } from "../types";

export function filterModelsByCapability(models: VeniceModel[], capability: "all" | VeniceCapability): VeniceModel[] {
  if (capability === "all") return models;
  return models.filter((m) => (m.capabilities ?? []).includes(capability));
}

export async function getModelSettings(modelId: string): Promise<ModelSettings> {
  const defaults: ModelSettings = {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 2048,
  };

  try {
    const { LocalStorage } = await import("@raycast/api");
    const saved = await LocalStorage.getItem<string>(`venice_settings_${modelId}`);
    if (saved) {
      const parsed = JSON.parse(saved) as ModelSettings;
      return { ...defaults, ...parsed };
    }
  } catch {
    // Return defaults if parsing fails
  }

  return defaults;
}

export async function hasCustomModelSettings(modelId: string): Promise<boolean> {
  const defaults: ModelSettings = {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 2048,
  };

  try {
    const { LocalStorage } = await import("@raycast/api");
    const saved = await LocalStorage.getItem<string>(`venice_settings_${modelId}`);
    if (!saved) return false;

    const parsed = JSON.parse(saved) as ModelSettings;
    return (
      parsed.temperature !== defaults.temperature ||
      parsed.topP !== defaults.topP ||
      parsed.topK !== defaults.topK ||
      parsed.maxTokens !== defaults.maxTokens
    );
  } catch {
    return false;
  }
}
