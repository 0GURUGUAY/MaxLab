import test from "node:test";
import assert from "node:assert/strict";
import { generateCraftingIdeas, generateProductDataSheets, generateSketchFromPhoto, GEMINI_IMAGE_MODEL } from "../src/ai.ts";

const sampleProduct = {
  id: "prod-1",
  name: "Bougeoir en chêne brûlé",
  category: "bois",
  subcategory: "bougies",
  status: "in-progress",
  createdAt: "2026-10-12T10:00:00Z",
  updatedAt: "2026-10-12T12:00:00Z",
  materials: "Chêne massif, cire végétale, coupelle métal",
  dimensions: "Ø 77 mm × 147 mm",
  techniques: "Tournage sur bois, brûlage Shou Sugi Ban, cire protectrice",
  tools: "Tour à bois, gouges, chalumeau, brosse métallique",
  duration: "2 h 30",
  description: "Bougeoir cylindrique inspiré des lignes minimalistes d'atelier.",
  entries: [],
};

test("generateProductDataSheets generates rich technical and commercial sheets", async () => {
  const result = await generateProductDataSheets({
    product: sampleProduct,
    companyName: "MaxLab Atelier",
  });

  assert.ok(result.technical);
  assert.equal(result.technical.title, sampleProduct.name);
  assert.ok(result.technical.reference.startsWith("ML-BOI"));
  assert.ok(result.technical.materials.length >= 1);
  assert.ok(result.technical.fabricationSteps.length >= 3);
  assert.ok(result.technical.toolsRequired.length >= 1);
  assert.ok(result.technical.finishingAndCare);

  assert.ok(result.commercial);
  assert.equal(result.commercial.title, sampleProduct.name);
  assert.ok(result.commercial.keyArguments.length >= 2);
  assert.equal("suggestedPrice" in result.commercial, false);
  assert.ok(result.commercial.salesPitch);
});

test("generateCraftingIdeas generates relevant ideas across key craft categories", async () => {
  const ideas = await generateCraftingIdeas({
    product: sampleProduct,
  });

  assert.equal(ideas.length, 4);
  const types = ideas.map((i) => i.type);
  assert.ok(types.includes("variation"));
  assert.ok(types.includes("complementary"));
  assert.ok(types.includes("offcut"));
  assert.ok(types.includes("process"));

  for (const idea of ideas) {
    assert.ok(idea.title);
    assert.ok(idea.description);
    assert.ok(idea.materialsNeeded);
    assert.ok(idea.craftingTips.length >= 1);
  }
});

  test("Gemini sheets and ideas use the same current model and preserve image inputs", async (t) => {
    const sheets = await generateProductDataSheets({ product: sampleProduct });
    const ideas = await generateCraftingIdeas({ product: sampleProduct });
    const calls = [];
    const results = [sheets, ideas];
    t.mock.method(globalThis, "fetch", async (url, options) => {
      calls.push({ url, options });
      const text = JSON.stringify(results.shift());
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: text.slice(0, 12) }, { text: text.slice(12) }] } }],
      }));
    });
    const image = { mimeType: "image/jpeg", data: "test-image" };
    const generatedSheets = await generateProductDataSheets({
      apiKey: "test-key", product: sampleProduct, imageBase64: image,
    });
    const generatedIdeas = await generateCraftingIdeas({ apiKey: "test-key", product: sampleProduct });
    assert.deepEqual(generatedSheets.technical, sheets.technical);
    assert.deepEqual(generatedIdeas, ideas);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
      assert.equal(call.options.headers["x-goog-api-key"], "test-key");
    }
    assert.deepEqual(JSON.parse(calls[0].options.body).contents[0].parts[0].inlineData, image);
    const sheetsPrompt = JSON.parse(calls[0].options.body).contents[0].parts.at(-1).text;
    assert.match(sheetsPrompt, /N'invente aucun prix de vente/);
    assert.equal(sheetsPrompt.includes("suggestedPrice"), false);
  });

  test("Gemini failures do not masquerade as locally generated sheets or ideas", async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 403 });
    });
    await assert.rejects(generateProductDataSheets({ apiKey: "test-key", product: sampleProduct }), /API key not valid/);
    await assert.rejects(generateCraftingIdeas({ apiKey: "test-key", product: sampleProduct }), /API key not valid/);
    assert.equal(calls, 2);
  });

test("generateSketchFromPhoto uses Gemini image generation and returns its image", async (t) => {
  let call;
  const generatedImage = Uint8Array.from([10, 20, 30]);
  t.mock.method(globalThis, "fetch", async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [
            { text: "Croquis généré." },
            { inlineData: { mimeType: "image/png", data: btoa(String.fromCharCode(...generatedImage)) } },
          ],
        },
      }],
    }));
  });

  const result = await generateSketchFromPhoto({
    apiKey: " test-key ",
    imageBlobOrFile: new Blob([Uint8Array.from([1, 2, 3])], { type: "image/jpeg" }),
    product: sampleProduct,
  });

  assert.equal(call.url, `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`);
  assert.equal(call.options.headers["x-goog-api-key"], "test-key");
  const requestBody = JSON.parse(call.options.body);
  assert.deepEqual(requestBody.contents[0].parts[0].inlineData, {
    mimeType: "image/jpeg",
    data: "AQID",
  });
  assert.match(requestBody.contents[0].parts[1].text, /Transforme la photo/);
  assert.deepEqual(requestBody.generationConfig.responseModalities, ["TEXT", "IMAGE"]);
  assert.equal(result.source, "gemini");
  assert.equal(result.blob.type, "image/png");
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), generatedImage);
});

test("generateSketchFromPhoto reports Gemini failures without a local fallback", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "Image generation is unavailable" } }), { status: 400 });
  });

  await assert.rejects(
    generateSketchFromPhoto({
      apiKey: "test-key",
      imageBlobOrFile: new Blob([Uint8Array.from([1, 2, 3])], { type: "image/jpeg" }),
      product: sampleProduct,
    }),
    /Image generation is unavailable/,
  );
  assert.equal(calls, 1);
});

test("generateSketchFromPhoto requires a Gemini API key", async () => {
  await assert.rejects(
    generateSketchFromPhoto({
      imageBlobOrFile: new Blob([Uint8Array.from([1, 2, 3])], { type: "image/jpeg" }),
      product: sampleProduct,
    }),
    /clé API Gemini/,
  );
});
