import { useMemo } from "react";
import type { VeniceCapability, VeniceModel } from "../types";
import { useModels } from "./useModels";
import { filterModelsByCapability } from "../utils/models";

export function useDefaultModel(capability: "all" | VeniceCapability = "all") {
  const { data: models, isLoading, mutate, error } = useModels();
  const filtered = useMemo(() => (models ? filterModelsByCapability(models, capability) : []), [models, capability]);
  const first = filtered && filtered.length > 0 ? filtered[0] : undefined;
  return { model: first as VeniceModel | undefined, models: filtered, isLoading, mutate, error };
}
