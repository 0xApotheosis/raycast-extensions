import { Cache } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";

import { VeniceClient } from "../api/client";
import { STORAGE_KEYS, UI_CONSTANTS } from "../constants";

import type { VeniceModel } from "../types";

const cache = new Cache();

function readCache(): { models: VeniceModel[]; ts: number } | undefined {
  const raw = cache.get(STORAGE_KEYS.MODELS_CACHE);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as { models: VeniceModel[]; ts: number };
  } catch {
    return undefined;
  }
}

function writeCache(models: VeniceModel[]) {
  cache.set(STORAGE_KEYS.MODELS_CACHE, JSON.stringify({ models, ts: Date.now() }));
}

export function useModels() {
  return useCachedPromise(
    async () => {
      const cached = readCache();
      if (cached && Date.now() - cached.ts < UI_CONSTANTS.MODELS_CACHE_TTL_MS) {
        return cached.models;
      }
      const client = new VeniceClient();
      const models = await client.listModels();
      writeCache(models);
      return models;
    },
    [],
    {
      keepPreviousData: true,
      initialData: readCache()?.models,
      onError: () => {
        // On error, try to serve stale cache if present
        return;
      },
    },
  );
}
