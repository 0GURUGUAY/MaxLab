import test from "node:test";
import assert from "node:assert/strict";
import { clearCloudToken, loadCloudToken, saveCloudToken } from "../src/authStorage.ts";

test("cloud authentication token is persisted and can be cleared", () => {
  const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });

  try {
    assert.equal(loadCloudToken(), "");
    saveCloudToken("google-id-token");
    assert.equal(loadCloudToken(), "google-id-token");
    clearCloudToken();
    assert.equal(loadCloudToken(), "");
  } finally {
    if (previousLocalStorage) Object.defineProperty(globalThis, "localStorage", previousLocalStorage);
    else delete globalThis.localStorage;
  }
});
