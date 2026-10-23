import type { EntryWorkMethod, Product, ProductCategory, ProductStatus, WorkshopEntry } from "./types";

export type EntryWorkDetails = {
  durationMinutes?: number;
  workMethod?: EntryWorkMethod;
  machineName?: string;
  toolNames?: string[];
};

export type ProductWorkSummary = {
  totalMinutes: number;
  manualMinutes: number;
  machineMinutes: number;
  machines: string[];
  tools: string[];
};

export type EquipmentOptions = {
  machines: string[];
  tools: string[];
};

function addUniqueName(names: Map<string, string>, value: string): void {
  const name = value.trim();
  if (name && !names.has(name.toLocaleLowerCase("fr"))) names.set(name.toLocaleLowerCase("fr"), name);
}

export function collectEquipmentOptions(products: Product[]): EquipmentOptions {
  const machines = new Map<string, string>();
  const tools = new Map<string, string>();
  for (const product of products) {
    product.tools.split(/[,;\n]+/).forEach((tool) => addUniqueName(tools, tool));
    for (const entry of product.entries) {
      if (entry.kind !== "note") continue;
      if (entry.workMethod === "machine" && entry.machineName) addUniqueName(machines, entry.machineName);
      entry.toolNames?.forEach((tool) => addUniqueName(tools, tool));
    }
  }
  return {
    machines: [...machines.values()].sort((first, second) => first.localeCompare(second, "fr")),
    tools: [...tools.values()].sort((first, second) => first.localeCompare(second, "fr")),
  };
}

export const categoryLabels: Record<ProductCategory, string> = {
  bois: "Bois",
  cuir: "Cuir",
  tissu: "Tissu",
  photos: "Photos",
};

export const statusLabels: Record<ProductStatus, string> = {
  idea: "À explorer",
  "in-progress": "En cours",
  finished: "Terminé",
};

export function makeId(): string {
  return crypto.randomUUID();
}

export function mergeProductVersions(local: Product, remote: Product): Product {
  const preferred = Date.parse(local.updatedAt) > Date.parse(remote.updatedAt) ? local : remote;
  const secondary = preferred === local ? remote : local;
  const entries = [...preferred.entries];
  const entryIds = new Set(entries.map((entry) => entry.id));

  for (const entry of secondary.entries) {
    if (entryIds.has(entry.id)) continue;
    entryIds.add(entry.id);
    const createdAt = Date.parse(entry.createdAt);
    const insertionIndex = entries.findIndex((existing) => Date.parse(existing.createdAt) < createdAt);
    entries.splice(insertionIndex < 0 ? entries.length : insertionIndex, 0, entry);
  }

  return { ...preferred, entries };
}

export function createProduct(input: Pick<Product, "name" | "category"> & Partial<Product>, now = new Date()): Product {
  const timestamp = now.toISOString();
  return {
    id: makeId(),
    name: input.name.trim(),
    category: input.category,
    subcategory: input.subcategory?.trim() ?? "",
    status: input.status ?? "idea",
    createdAt: timestamp,
    updatedAt: timestamp,
    materials: input.materials?.trim() ?? "",
    dimensions: input.dimensions?.trim() ?? "",
    techniques: input.techniques?.trim() ?? "",
    tools: input.tools?.trim() ?? "",
    duration: input.duration?.trim() ?? "",
    description: input.description?.trim() ?? "",
    entries: input.entries ?? [],
    generatedDocuments: input.generatedDocuments ?? [],
  };
}

export function addEntry(product: Product, entry: Omit<WorkshopEntry, "id" | "createdAt">, now = new Date()): Product {
  return insertEntry(product, entry, 0, now);
}

export function insertEntry(product: Product, entry: Omit<WorkshopEntry, "id" | "createdAt">, index: number, now = new Date()): Product {
  const createdAt = now.toISOString();
  const insertionIndex = Math.max(0, Math.min(index, product.entries.length));
  const newEntry = { ...entry, id: makeId(), createdAt };
  return {
    ...product,
    updatedAt: createdAt,
    entries: [
      ...product.entries.slice(0, insertionIndex),
      newEntry,
      ...product.entries.slice(insertionIndex),
    ],
  };
}

export function updateNoteEntry(
  product: Product,
  entryId: string,
  text: string,
  workDetails: EntryWorkDetails,
  now = new Date(),
): Product {
  const entryIndex = product.entries.findIndex((entry) => entry.id === entryId && entry.kind === "note");
  if (entryIndex === -1) return product;
  const entries = [...product.entries];
  entries[entryIndex] = {
    ...entries[entryIndex],
    text,
    durationMinutes: workDetails.durationMinutes,
    workMethod: workDetails.workMethod,
    machineName: workDetails.machineName,
    toolNames: workDetails.toolNames,
  };
  return { ...product, entries, updatedAt: now.toISOString() };
}

export function summarizeEntryWork(entries: WorkshopEntry[]): ProductWorkSummary {
  const summary: ProductWorkSummary = { totalMinutes: 0, manualMinutes: 0, machineMinutes: 0, machines: [], tools: [] };
  const machines = new Map<string, string>();
  const tools = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind !== "note") continue;
    entry.toolNames?.forEach((tool) => addUniqueName(tools, tool));
    if (!entry.durationMinutes || !entry.workMethod) continue;
    summary.totalMinutes += entry.durationMinutes;
    if (entry.workMethod === "manual") {
      summary.manualMinutes += entry.durationMinutes;
    } else {
      summary.machineMinutes += entry.durationMinutes;
      const machineName = entry.machineName?.trim();
      if (machineName) addUniqueName(machines, machineName);
    }
  }
  summary.machines = [...machines.values()];
  summary.tools = [...tools.values()];
  return summary;
}

export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours} h ${remainingMinutes} min`;
  if (hours) return `${hours} h`;
  return `${remainingMinutes} min`;
}

export function moveEntry(product: Product, fromIndex: number, toIndex: number, now = new Date()): Product {
  const lastIndex = product.entries.length - 1;
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex > lastIndex ||
    toIndex < 0 ||
    toIndex > lastIndex ||
    fromIndex === toIndex
  ) {
    return product;
  }

  const entries = [...product.entries];
  const [entry] = entries.splice(fromIndex, 1);
  entries.splice(toIndex, 0, entry);
  return { ...product, entries, updatedAt: now.toISOString() };
}

export function removeEntry(product: Product, entryId: string, now = new Date()): Product {
  const entries = product.entries.filter((entry) => entry.id !== entryId);
  if (entries.length === product.entries.length) return product;
  return { ...product, entries, updatedAt: now.toISOString() };
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Intl.DateTimeFormat("fr-FR", options).format(new Date(value));
}

export const STARTER_PRODUCT_IDS = new Set([
  "5ecf53ae-37d0-4f74-a261-7eac91a59401",
  "sample-box",
]);

export function isStarterProduct(product: Product): boolean {
  return STARTER_PRODUCT_IDS.has(product.id);
}
