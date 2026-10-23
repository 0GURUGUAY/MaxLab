import type { Product } from "./types";

const PRODUCTS_KEY = "maxlab.products.v1";
const ACTIVE_PRODUCT_KEY = "maxlab.active-product.v1";
const DELETED_PRODUCTS_KEY = "maxlab.deleted-products.v1";
const PENDING_SYNC_KEY = "maxlab.pending-sync.v1";
const DATABASE = "maxlab-media";
const STORE = "media";

export type PendingSyncTags = Record<string, string>;

export function stripMediaPaths(product: Product): Product {
  return {
    ...product,
    entries: product.entries.map(({ mediaPath: _mediaPath, ...entry }) => entry),
  };
}

function openMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir le stockage des fichiers."));
  });
}

export function loadProducts(): Product[] {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Le carnet d'atelier enregistré est illisible.");
  return (parsed as Product[]).map(stripMediaPaths);
}

export function hasStoredProducts(): boolean {
  return localStorage.getItem(PRODUCTS_KEY) !== null;
}

export function saveProducts(products: Product[]): void {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.map(stripMediaPaths)));
}

export function loadActiveProductId(): string {
  return localStorage.getItem(ACTIVE_PRODUCT_KEY) ?? "";
}

export function saveActiveProductId(id: string): void {
  localStorage.setItem(ACTIVE_PRODUCT_KEY, id);
}

export function clearActiveProductId(): void {
  localStorage.removeItem(ACTIVE_PRODUCT_KEY);
}

export function loadPendingSyncTags(): PendingSyncTags {
  const raw = localStorage.getItem(PENDING_SYNC_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
    || Object.values(parsed).some((tag) => typeof tag !== "string")) {
    throw new Error("La liste des créations à synchroniser est illisible.");
  }
  return parsed as PendingSyncTags;
}

export function markPendingSync(ids: string[]): PendingSyncTags {
  const tags = loadPendingSyncTags();
  ids.forEach((id) => { tags[id] = crypto.randomUUID(); });
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(tags));
  return tags;
}

export function clearPendingSync(ids: string[], expectedTags?: PendingSyncTags): PendingSyncTags {
  const tags = loadPendingSyncTags();
  ids.forEach((id) => {
    if (!expectedTags || tags[id] === expectedTags[id]) delete tags[id];
  });
  if (Object.keys(tags).length) localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(tags));
  else localStorage.removeItem(PENDING_SYNC_KEY);
  return tags;
}

export function loadDeletedProductIds(): string[] {
  const raw = localStorage.getItem(DELETED_PRODUCTS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
    throw new Error("La liste des suppressions locales est illisible.");
  }
  return parsed;
}

export function markProductDeleted(id: string): void {
  const deleted = new Set(loadDeletedProductIds());
  deleted.add(id);
  localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify([...deleted]));
}

export function clearDeletedProductIds(): void {
  localStorage.removeItem(DELETED_PRODUCTS_KEY);
}

export function clearDeletedProductId(id: string): void {
  const remaining = loadDeletedProductIds().filter((deletedId) => deletedId !== id);
  if (remaining.length) localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(remaining));
  else localStorage.removeItem(DELETED_PRODUCTS_KEY);
}

export async function storeMedia(id: string, blob: Blob): Promise<void> {
  const db = await openMediaDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(blob, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Impossible d'enregistrer le fichier."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Enregistrement du fichier annulé."));
    });
  } finally {
    db.close();
  }
}

export async function readMedia(id: string): Promise<Blob | undefined> {
  const db = await openMediaDatabase();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error ?? new Error("Impossible de charger le fichier."));
    });
  } finally {
    db.close();
  }
}

export async function deleteMedia(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openMediaDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const mediaStore = transaction.objectStore(STORE);
      ids.forEach((id) => mediaStore.delete(id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Impossible de supprimer les fichiers du projet."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Suppression des fichiers annulée."));
    });
  } finally {
    db.close();
  }
}
