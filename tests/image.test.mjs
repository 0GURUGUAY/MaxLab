import test from "node:test";
import assert from "node:assert/strict";
import { compressPhoto } from "../src/image.ts";

test("compressPhoto resizes large images and converts them to a smaller JPEG", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let bitmapClosed = false;
  let canvas;
  globalThis.createImageBitmap = async () => ({
    width: 4000,
    height: 3000,
    close() {
      bitmapClosed = true;
    },
  });
  globalThis.document = {
    createElement() {
      canvas = {
        getContext() {
          return {
            fillRect() {},
            drawImage() {},
          };
        },
        toBlob(callback, type, quality) {
          assert.equal(type, "image/jpeg");
          assert.equal(quality, 0.72);
          callback(new Blob(["compressed image"], { type }));
        },
      };
      return canvas;
    },
  };

  try {
    const source = new File(["large source image"], "atelier.png", { type: "image/png", lastModified: 123 });
    const compressed = await compressPhoto(source);
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 1200);
    assert.equal(compressed.name, "atelier.jpg");
    assert.equal(compressed.type, "image/jpeg");
    assert.equal(compressed.lastModified, 123);
    assert.ok(compressed.size < source.size);
    assert.equal(bitmapClosed, true);
  } finally {
    if (originalCreateImageBitmap) globalThis.createImageBitmap = originalCreateImageBitmap;
    else delete globalThis.createImageBitmap;
    if (originalDocument) globalThis.document = originalDocument;
    else delete globalThis.document;
  }
});

test("compressPhoto converts unsupported gallery formats to JPEG even when conversion is larger", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  globalThis.createImageBitmap = async () => ({
    width: 1200,
    height: 900,
    close() {},
  });
  globalThis.document = {
    createElement() {
      return {
        getContext() {
          return { fillRect() {}, drawImage() {} };
        },
        toBlob(callback, type) {
          callback(new Blob(["converted jpeg bytes"], { type }));
        },
      };
    },
  };

  try {
    const source = new File(["heic"], "photo.heic", { type: "image/heic" });
    const compressed = await compressPhoto(source);
    assert.notEqual(compressed, source);
    assert.equal(compressed.name, "photo.jpg");
    assert.equal(compressed.type, "image/jpeg");
  } finally {
    if (originalCreateImageBitmap) globalThis.createImageBitmap = originalCreateImageBitmap;
    else delete globalThis.createImageBitmap;
    if (originalDocument) globalThis.document = originalDocument;
    else delete globalThis.document;
  }
});
