const CLOUD_TOKEN_KEY = "maxlab.cloud-token.v1";

export function loadCloudToken(): string {
  return localStorage.getItem(CLOUD_TOKEN_KEY) ?? "";
}

export function saveCloudToken(token: string): void {
  localStorage.setItem(CLOUD_TOKEN_KEY, token);
}

export function clearCloudToken(): void {
  localStorage.removeItem(CLOUD_TOKEN_KEY);
}
