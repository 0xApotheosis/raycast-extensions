import type { VeniceCapability, VeniceModel } from "../types";

export function filterModelsByCapability(models: VeniceModel[], capability: "all" | VeniceCapability): VeniceModel[] {
  if (capability === "all") return models;
  return models.filter((m) => (m.capabilities ?? []).includes(capability));
}
