import { Cache } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { VeniceClient } from "../api/client";
import type { VeniceModel } from "../types";

const cache = new Cache();
const MODELS_CACHE_KEY = "venice_models_v1";
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

function readCache(): { models: VeniceModel[]; ts: number } | undefined {
  const raw = cache.get(MODELS_CACHE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as { models: VeniceModel[]; ts: number };
  } catch {
    return undefined;
  }
}

function writeCache(models: VeniceModel[]) {
  cache.set(MODELS_CACHE_KEY, JSON.stringify({ models, ts: Date.now() }));
}

export function useModels() {
  const client = new VeniceClient();
  return useCachedPromise(
    async () => {
      const cached = readCache();
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.models;
      }
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
    }
  );
}
