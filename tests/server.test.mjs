import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../server/app.ts";

const product = {
  id: "27492d2a-8f34-4e0c-a58a-dc9eab778755",
  name: "Boîte",
  category: "bois",
  subcategory: "",
  status: "idea",
  createdAt: "2026-10-12T12:00:00.000Z",
  updatedAt: "2026-10-12T12:00:00.000Z",
  materials: "",
  dimensions: "",
  techniques: "",
  tools: "",
  duration: "",
  description: "",
  entries: [],
};

async function withApi(run) {
  const calls = [];
  let savedProfile;
  const sessions = new Map();
  const store = {
    createSession: async (sessionId, identity) => { sessions.set(sessionId, identity); },
    getSession: async (sessionId) => sessions.get(sessionId),
    deleteSession: async (sessionId) => { sessions.delete(sessionId); },
    listProducts: async (userId) => { calls.push(["list", userId]); return []; },
    getProfile: async (userId) => { calls.push(["getProfile", userId]); return savedProfile; },
    writeProfile: async (userId, value) => { calls.push(["writeProfile", userId]); savedProfile = value; },
    writeProduct: async (userId, value) => { calls.push(["write", userId]); return value; },
    deleteProduct: async (userId, productId) => { calls.push(["delete", userId, productId]); },
    putMedia: async (...args) => { calls.push(["putMedia", ...args.slice(0, 3)]); },
    deleteMedia: async (...args) => { calls.push(["deleteMedia", ...args]); },
    getMedia: async () => ({ bytes: Buffer.from("hello"), mimeType: "text/plain" }),
  };
  const app = createApp({
    store,
    allowedOrigins: ["http://localhost:5173"],
    verifyToken: async (token) => {
      if (token !== "valid-id-token") throw new Error("Invalid token");
      return { sub: "google-account-123", email: "maker@example.com" };
    },
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`, calls);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("API denies requests without a verified Google token", async () => {
  await withApi(async (base) => {
    const response = await fetch(`${base}/api/products`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Connexion Google requise." });
  });
});

test("browser sessions persist across requests and are revoked on logout", async () => {
  await withApi(async (base, calls) => {
    const loginResponse = await fetch(`${base}/api/auth/session`, {
      method: "POST",
      headers: { Authorization: "Bearer valid-id-token", Origin: "http://localhost:5173" },
    });
    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.headers.get("access-control-allow-credentials"), "true");
    const sessionCookie = loginResponse.headers.get("set-cookie");
    assert.match(sessionCookie, /HttpOnly/);
    assert.match(sessionCookie, /SameSite=Lax/);
    const cookie = sessionCookie.split(";")[0];

    const restoredResponse = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(restoredResponse.status, 200);
    assert.match(restoredResponse.headers.get("set-cookie"), /Max-Age=31536000/);
    assert.deepEqual(await restoredResponse.json(), { sub: "google-account-123", email: "maker@example.com" });

    const logoutResponse = await fetch(`${base}/api/auth/session`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/);

    const revokedResponse = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(revokedResponse.status, 401);
    assert.deepEqual(calls, []);
  });
});

test("API rejects unapproved browser origins", async () => {
  await withApi(async (base) => {
    const response = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: "Bearer valid-id-token", Origin: "https://attacker.example" },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Origine non autorisée." });
  });
});

test("authenticated product routes are scoped to the verified Google subject", async () => {
  await withApi(async (base, calls) => {
    const response = await fetch(`${base}/api/products`, {
      headers: { Authorization: "Bearer valid-id-token", Origin: "http://localhost:5173" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { products: [] });
    assert.deepEqual(calls, [["list", "google-account-123"]]);
  });
});

test("profile settings are stored and returned only within the authenticated Google account", async () => {
  const profile = {
    geminiApiKey: "AIzaSyTestKey",
    companyName: "Atelier Max",
    companyLogoUrl: "",
    companyInfo: "Menuiserie et confection",
  };

  await withApi(async (base, calls) => {
    const putResponse = await fetch(`${base}/api/profile`, {
      method: "PUT",
      headers: { Authorization: "Bearer valid-id-token", "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    assert.equal(putResponse.status, 200);
    assert.deepEqual(await putResponse.json(), { saved: true });

    const getResponse = await fetch(`${base}/api/profile`, {
      headers: { Authorization: "Bearer valid-id-token" },
    });
    assert.equal(getResponse.status, 200);
    assert.deepEqual(await getResponse.json(), { profile });
    assert.deepEqual(calls, [
      ["writeProfile", "google-account-123"],
      ["getProfile", "google-account-123"],
    ]);
  });
});

test("profile endpoint validates settings before saving", async () => {
  await withApi(async (base, calls) => {
    const response = await fetch(`${base}/api/profile`, {
      method: "PUT",
      headers: { Authorization: "Bearer valid-id-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        geminiApiKey: "test-key",
        companyName: "",
        companyLogoUrl: "",
        companyInfo: "",
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });
});

test("product endpoint validates the submitted schema before writing", async () => {
  await withApi(async (base, calls) => {
    const response = await fetch(`${base}/api/products/${product.id}`, {
      method: "PUT",
      headers: { Authorization: "Bearer valid-id-token", "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, category: "unknown" }),
    });
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });
});

test("product endpoint stores note work time and machine details", async () => {
  await withApi(async (base, calls) => {
    const entry = {
      id: "c67d183a-5653-4fea-91f7-21c0b43e1049",
      kind: "note",
      createdAt: "2026-10-12T12:00:00.000Z",
      text: "Découpe des pièces",
      durationMinutes: 45,
      workMethod: "machine",
      machineName: "Scie sur table",
      toolNames: ["Ponceuse"],
    };
    const response = await fetch(`${base}/api/products/${product.id}`, {
      method: "PUT",
      headers: { Authorization: "Bearer valid-id-token", Origin: "http://localhost:5173", "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, entries: [entry] }),
    });
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    assert.deepEqual(result.product.entries, [entry]);
    assert.deepEqual(calls, [["write", "google-account-123"]]);
  });
});

test("media endpoint deletes a file within the authenticated product", async () => {
  await withApi(async (base, calls) => {
    const response = await fetch(`${base}/api/products/${product.id}/media/7461ca65-58a7-48bb-93fb-0f2647537472`, {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-id-token" },
    });
    assert.equal(response.status, 204);
    assert.deepEqual(calls, [["deleteMedia", "google-account-123", product.id, "7461ca65-58a7-48bb-93fb-0f2647537472"]]);
  });
});

test("product endpoint stores generated documents for later reopening", async () => {
  const generatedDocument = {
    id: "c67d183a-5653-4fea-91f7-21c0b43e1049",
    dataSheets: {
      technical: {
        title: "Bougeoir",
        reference: "ML-BOI-BOU-100",
        category: "bois",
        dimensions: "Ø 77 mm × 147 mm",
        materials: [{ name: "Chêne", specs: "Bois massif" }],
        fabricationSteps: [{ step: 1, title: "Tournage", description: "Tourner le cylindre", duration: "1 h" }],
        toolsRequired: ["Tour à bois"],
        finishingAndCare: "Nettoyer avec un chiffon sec.",
        qualityPoints: ["Vérifier la stabilité."],
      },
      commercial: {
        title: "Bougeoir artisanal",
        tagline: "Une pièce façonnée à la main.",
        storytelling: "Création d'atelier.",
        keyArguments: ["Fabrication artisanale."],
        targetAudience: "Amateurs d'artisanat.",
        presentationTips: "Présenter sur fond clair.",
        salesPitch: "Une pièce unique pour votre intérieur.",
      },
      generatedAt: "2026-10-13T12:00:00.000Z",
      modelUsed: "Google Gemini",
    },
  };

  await withApi(async (base, calls) => {
    const response = await fetch(`${base}/api/products/${product.id}`, {
      method: "PUT",
      headers: { Authorization: "Bearer valid-id-token", "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, generatedDocuments: [generatedDocument] }),
    });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.deepEqual(saved.product.generatedDocuments, [generatedDocument]);
    assert.deepEqual(calls, [["write", "google-account-123"]]);
  });
});
