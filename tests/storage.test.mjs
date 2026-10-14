import test from "node:test";
import assert from "node:assert/strict";
import { clearPendingSync, loadPendingSyncTags, markPendingSync, stripMediaPaths } from "../src/storage.ts";

test("pending sync tags are cleared only when the saved revision still matches", () => {
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

  test("stripMediaPaths removes inline image data while preserving the media reference", () => {
    const product = {
      id: "product-1",
      entries: [{
        id: "entry-1",
        kind: "sketch",
        mediaId: "media-1",
        mediaPath: `data:image/jpeg;base64,${"A".repeat(2000)}`,
      }],
    };

    const result = stripMediaPaths(product);
    assert.equal("mediaPath" in result.entries[0], false);
    assert.equal(result.entries[0].mediaId, "media-1");
    assert.equal(product.entries[0].mediaPath.startsWith("data:"), true);
  });

  try {
    const firstRevision = markPendingSync(["product-1"]);
    const secondRevision = markPendingSync(["product-1"]);
    assert.notEqual(firstRevision["product-1"], secondRevision["product-1"]);

    clearPendingSync(["product-1"], firstRevision);
    assert.deepEqual(loadPendingSyncTags(), secondRevision);

    clearPendingSync(["product-1"], secondRevision);
    assert.deepEqual(loadPendingSyncTags(), {});
  } finally {
    if (previousLocalStorage) Object.defineProperty(globalThis, "localStorage", previousLocalStorage);
    else delete globalThis.localStorage;
  }
});
