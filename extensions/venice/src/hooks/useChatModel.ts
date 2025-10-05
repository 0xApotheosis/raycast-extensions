import { LocalStorage } from "@raycast/api";
import { useEffect, useRef, useState } from "react";

import { STORAGE_KEYS } from "../constants";

import type { VeniceModel } from "../types";

/**
 * Hook to manage the current chat model selection.
 * Handles loading from storage and updating the default model.
 *
 * @param models - Available models list
 * @param defaultModel - The default model from useDefaultModel hook
 * @returns Current model ID and setter function
 */
export function useChatModel(models: VeniceModel[] | undefined, defaultModel: VeniceModel | undefined) {
  const [currentModelId, setCurrentModelId] = useState<string | undefined>(undefined);
  const defaultModelSetRef = useRef<boolean>(false);

  // Load the default model when models become available
  useEffect(() => {
    if (defaultModel && !defaultModelSetRef.current) {
      (async () => {
        const saved = await LocalStorage.getItem<string>(STORAGE_KEYS.DEFAULT_MODEL);
        if (saved && models?.find((m) => m.id === saved)) {
          setCurrentModelId(saved);
        } else if (defaultModel) {
          setCurrentModelId(defaultModel.id);
          // Persist default if missing
          try {
            await LocalStorage.setItem(STORAGE_KEYS.DEFAULT_MODEL, defaultModel.id);
          } catch {
            // ignore
          }
        }
        defaultModelSetRef.current = true;
      })();
    }
  }, [defaultModel, models]);

  // Additional check: if we have models but currentModelId is not set correctly, fix it
  useEffect(() => {
    if (models && models.length > 0 && currentModelId) {
      const saved = LocalStorage.getItem<string>(STORAGE_KEYS.DEFAULT_MODEL);
      saved
        .then((savedId) => {
          if (savedId && savedId !== currentModelId && models.find((m) => m.id === savedId)) {
            setCurrentModelId(savedId);
          }
        })
        .catch(() => {
          // Ignore errors
        });
    }
  }, [models, currentModelId]);

  return { currentModelId, setCurrentModelId };
}
