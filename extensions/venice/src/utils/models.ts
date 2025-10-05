import { DEFAULT_MODEL_SETTINGS, STORAGE_KEYS } from "../constants";

import type { VeniceCapability, VeniceModel, ModelSettings } from "../types";

/**
 * Filters models by their capability (chat, image, or all).
 *
 * @param models - Array of Venice models
 * @param capability - Capability to filter by
 * @returns Filtered array of models
 */
export function filterModelsByCapability(models: VeniceModel[], capability: "all" | VeniceCapability): VeniceModel[] {
  if (capability === "all") return models;
  return models.filter((m) => (m.capabilities ?? []).includes(capability));
}

/**
 * Gets the model settings for a specific model, merging with defaults.
 *
 * @param modelId - The model ID
 * @returns The model settings (defaults merged with any custom settings)
 */
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

/**
 * Checks if a model has custom settings that differ from defaults.
 *
 * @param modelId - The model ID to check
 * @returns True if the model has custom settings
 */
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

/**
 * Batch checks multiple models for custom settings.
 * More efficient than checking each model individually.
 *
 * @param modelIds - Array of model IDs to check
 * @returns Record mapping model IDs to whether they have custom settings
 */
export async function batchHasCustomModelSettings(modelIds: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};

  await Promise.all(
    modelIds.map(async (modelId) => {
      result[modelId] = await hasCustomModelSettings(modelId);
    }),
  );

  return result;
}
