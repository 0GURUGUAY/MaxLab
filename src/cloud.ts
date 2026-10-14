import { Capacitor } from "@capacitor/core";
import type { Product } from "./types";
import type { ProfileSettings } from "./profile";

export class CloudRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CloudRequestError";
  }
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  || "644788841502-j9aj9mpchrpng8ure0bfhoalmd0fscjs.apps.googleusercontent.com";
export const CLOUD_URL = "https://maxlab-yk2hz7tcna-uc.a.run.app";
export const BROWSER_SESSION_TOKEN = "__maxlab_browser_session__";

function apiUrl(path: string): string {
  const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "");
  const base = configured || (Capacitor.isNativePlatform() ? CLOUD_URL : "");
  return `${base}${path}`;
}

async function readJson<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`Le serveur a renvoyé une réponse invalide (HTTP ${response.status}).`, { cause: error });
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : `La requête cloud a échoué (HTTP ${response.status}).`;
    const issues = typeof body === "object" && body !== null && "issues" in body && Array.isArray(body.issues)
      ? body.issues.flatMap((issue) => {
        if (typeof issue !== "object" || issue === null
          || !("path" in issue) || !Array.isArray(issue.path)
          || !("message" in issue) || typeof issue.message !== "string") return [];
        const path = issue.path.filter((part: unknown): part is string | number =>
          typeof part === "string" || typeof part === "number").join(".");
        return [`${path || "Donnée"} : ${issue.message}`];
      }).join(" ")
      : "";
    throw new CloudRequestError(issues ? `${message} ${issues}` : message, response.status);
  }
  return body as T;
}

export async function cloudRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        ...init.headers,
        ...(token && token !== BROWSER_SESSION_TOKEN ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    throw new Error("Impossible de joindre MaxLab Cloud. Vérifie ta connexion.", { cause: error });
  }
  return readJson<T>(response);
}

export type CloudIdentity = { sub: string; email?: string; name?: string };

export function verifyCloudSession(token: string): Promise<CloudIdentity> {
  return cloudRequest(token, "/api/auth/me");
}

export function createCloudSession(token: string): Promise<CloudIdentity> {
  return cloudRequest(token, "/api/auth/session", { method: "POST" });
}

export async function clearCloudSession(): Promise<void> {
  const response = await fetch(apiUrl("/api/auth/session"), {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) await readJson<never>(response);
}

export async function getCloudProfile(token: string): Promise<ProfileSettings | null> {
  const result = await cloudRequest<{ profile: ProfileSettings | null }>(token, "/api/profile");
  return result.profile;
}

export async function writeCloudProfile(token: string, profile: ProfileSettings): Promise<void> {
  await cloudRequest<{ saved: boolean }>(token, "/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

export async function listCloudProducts(token: string): Promise<Product[]> {
  const result = await cloudRequest<{ products: Product[] }>(token, "/api/products");
  return result.products;
}

export async function writeCloudProduct(token: string, product: Product): Promise<Product> {
  const result = await cloudRequest<{ product: Product }>(token, `/api/products/${encodeURIComponent(product.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  return result.product;
}

export async function deleteCloudProduct(token: string, productId: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}`), {
    method: "DELETE",
    headers: token && token !== BROWSER_SESSION_TOKEN ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 204) return;
  await readJson<never>(response);
}

export async function deleteCloudMedia(token: string, productId: string, mediaId: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`), {
    method: "DELETE",
    headers: token && token !== BROWSER_SESSION_TOKEN ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 204) return;
  await readJson<never>(response);
}

export async function fetchCloudMedia(token: string, productId: string, mediaId: string): Promise<Blob> {
  const response = await fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`), {
    headers: token && token !== BROWSER_SESSION_TOKEN ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    await readJson<never>(response);
    throw new Error(`Téléchargement du fichier impossible (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("Le serveur a renvoyé un fichier vide.");
  return blob;
}

export async function putCloudMedia(token: string, productId: string, mediaId: string, blob: Blob): Promise<void> {
  const mediaType = blob.type;
  const acceptedTypes = new Set([
    "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain",
    "application/octet-stream", "application/zip",
  ]);
  const response = await fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`), {
    method: "PUT",
    headers: {
      ...(token && token !== BROWSER_SESSION_TOKEN ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/octet-stream",
      "X-Media-Type": acceptedTypes.has(mediaType) ? mediaType : "application/octet-stream",
    },
    body: blob,
    credentials: "include",
    cache: "no-store",
  });
  await readJson<{ id: string }>(response);
}
