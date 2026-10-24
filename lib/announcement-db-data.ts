/**
 * Shipped registry rows, bound to the pure gate logic in
 * announcement-db.ts. Only this module imports the JSON file (the
 * Next build resolves JSON imports natively); node --test cannot, so
 * tests import announcement-db.ts and read the JSON with fs instead.
 * Adding a complete row to announcement-db.json opens its model in
 * the panel with no code change anywhere else.
 */
import registryData from './announcement-db.json';
import {
  configForModelIn,
  entryForModel,
  isModelSelectableIn,
  registryStatusOf,
  type RegistryEntry,
} from './announcement-db.ts';
import type { BodyConfig } from './parametric-body.ts';

const registryFile = registryData as unknown as {
  version: number;
  entries: RegistryEntry[];
};

export const REGISTRY_ENTRIES: readonly RegistryEntry[] =
  registryFile.entries;

export function registryEntryForModel(
  modelId: string,
): RegistryEntry | undefined {
  return entryForModel(REGISTRY_ENTRIES, modelId);
}

export function isModelSelectable(modelId: string): boolean {
  return isModelSelectableIn(REGISTRY_ENTRIES, modelId);
}

export function registryStatus(): { complete: number; partial: number } {
  return registryStatusOf(REGISTRY_ENTRIES);
}

export function configForRegisteredModel(
  modelId: string,
): BodyConfig | null {
  return configForModelIn(REGISTRY_ENTRIES, modelId);
}
