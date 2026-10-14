import test from "node:test";
import assert from "node:assert/strict";
import { clearProfilePendingSync, defaultProfileSettings, hasProfilePendingSync, isDefaultProfileSettings, loadProfileSettings, markProfilePendingSync, saveProfileSettings, testGeminiApiKey } from "../src/profile.ts";

test("loadProfileSettings returns defaults when storage is empty", () => {
  const globalStorage = new Map();
  global.localStorage = {
    getItem: (key) => globalStorage.get(key) ?? null,
    setItem: (key, val) => globalStorage.set(key, val),
    removeItem: (key) => globalStorage.delete(key),
  };

  const settings = loadProfileSettings();
  assert.equal(settings.companyName, "MaxLab Atelier");
  assert.equal(settings.geminiApiKey, "");
  assert.ok(settings.companyInfo.includes("MaxLab"));
});

test("saveProfileSettings persists and reloads correctly", () => {
  const custom = {
    geminiApiKey: "AIzaSyFakeKey123",
    companyName: "Atelier du Bois & Cuir",
    companyLogoUrl: "data:image/png;base64,fakeLogo",
    companyInfo: "10 rue de l'Atelier · SIRET 12345678900010",
  };

  saveProfileSettings(custom);
  const reloaded = loadProfileSettings();
  assert.equal(reloaded.geminiApiKey, "AIzaSyFakeKey123");
  assert.equal(reloaded.companyName, "Atelier du Bois & Cuir");
  assert.equal(reloaded.companyLogoUrl, "data:image/png;base64,fakeLogo");
  assert.equal(reloaded.companyInfo, "10 rue de l'Atelier · SIRET 12345678900010");
});

test("profile changes can be marked pending until cloud synchronization succeeds", () => {
  assert.equal(hasProfilePendingSync(), false);
  markProfilePendingSync();
  assert.equal(hasProfilePendingSync(), true);
  clearProfilePendingSync();
  assert.equal(hasProfilePendingSync(), false);
});

test("default profile detection preserves customized account settings during initial sync", () => {
  assert.equal(isDefaultProfileSettings(defaultProfileSettings), true);
  assert.equal(isDefaultProfileSettings({ ...defaultProfileSettings, geminiApiKey: "AIzaSyTestKey" }), false);
  assert.equal(isDefaultProfileSettings({ ...defaultProfileSettings, companyInfo: "Mon atelier" }), false);
});

test("testGeminiApiKey returns failure when apiKey is empty", async () => {
  const res = await testGeminiApiKey("");
  assert.equal(res.ok, false);
  assert.ok(res.message.includes("Veuillez renseigner une clé"));
});

test("key validation uses Gemini 3.8 Flash without putting the key in the URL", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ candidates: [] }), { status: 200 });
  });
  const result = await testGeminiApiKey(" test-key ");
  assert.equal(result.ok, true);
  assert.equal(result.model, "gemini-3.8-flash");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
  assert.equal(calls[0].options.headers["x-goog-api-key"], "test-key");
});

test("key validation reports API errors without retrying retired models", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "Quota exceeded" } }), { status: 429 });
  });
  const result = await testGeminiApiKey("test-key");
  assert.equal(result.ok, false);
  assert.match(result.message, /Quota exceeded/);
  assert.equal(calls, 1);
});
