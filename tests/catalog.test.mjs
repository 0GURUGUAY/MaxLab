import test from "node:test";
import assert from "node:assert/strict";
import { addEntry, collectEquipmentOptions, createProduct, formatDurationMinutes, insertEntry, isStarterProduct, mergeProductVersions, moveEntry, removeEntry, summarizeEntryWork, updateNoteEntry } from "../src/catalog.ts";

test("createProduct trims the name and initializes workshop fields", () => {
  const product = createProduct({ name: "  Petite boîte  ", category: "bois" }, new Date("2026-10-12T12:00:00.000Z"));
  assert.equal(product.name, "Petite boîte");
  assert.equal(product.category, "bois");
  assert.equal(product.status, "idea");
  assert.deepEqual(product.entries, []);
  assert.deepEqual(product.generatedDocuments, []);
  assert.equal(product.createdAt, "2026-10-12T12:00:00.000Z");
});

test("addEntry adds a journal event and updates the product timestamp", () => {
  const product = createProduct({ name: "Sac", category: "cuir" }, new Date("2026-10-10T00:00:00.000Z"));
  const updated = addEntry(product, { kind: "note", text: "Assemblage terminé" }, new Date("2026-10-12T00:00:00.000Z"));
  assert.equal(updated.entries.length, 1);
  assert.equal(updated.entries[0].text, "Assemblage terminé");
  assert.equal(updated.entries[0].createdAt, updated.updatedAt);
  assert.equal(product.entries.length, 0);
});

test("insertEntry places a journal event at the requested position", () => {
  const product = createProduct({
    name: "Sac",
    category: "cuir",
    entries: [
      { id: "first", kind: "note", text: "Première étape", createdAt: "2026-10-10T00:00:00.000Z" },
      { id: "second", kind: "photo", text: "Deuxième étape", createdAt: "2026-10-11T00:00:00.000Z" },
    ],
  });
  const updated = insertEntry(product, { kind: "note", text: "Étape insérée" }, 1, new Date("2026-10-12T00:00:00.000Z"));
  assert.deepEqual(updated.entries.map((entry) => entry.text), ["Première étape", "Étape insérée", "Deuxième étape"]);
  assert.equal(updated.entries[1].createdAt, updated.updatedAt);
  assert.deepEqual(product.entries.map((entry) => entry.id), ["first", "second"]);
});

test("moveEntry reorders a journal event without mutating the original product", () => {
  const product = createProduct({
    name: "Sac",
    category: "cuir",
    entries: [
      { id: "first", kind: "note", text: "Première étape", createdAt: "2026-10-10T00:00:00.000Z" },
      { id: "second", kind: "photo", text: "Deuxième étape", createdAt: "2026-10-11T00:00:00.000Z" },
      { id: "third", kind: "note", text: "Troisième étape", createdAt: "2026-10-12T00:00:00.000Z" },
    ],
  });
  const updated = moveEntry(product, 2, 0, new Date("2026-10-13T00:00:00.000Z"));
  assert.deepEqual(updated.entries.map((entry) => entry.id), ["third", "first", "second"]);
  assert.equal(updated.updatedAt, "2026-10-13T00:00:00.000Z");
  assert.deepEqual(product.entries.map((entry) => entry.id), ["first", "second", "third"]);
  assert.equal(moveEntry(product, 0, 3), product);
});

test("mergeProductVersions keeps newer remote fields and local-only entries", () => {
  const local = createProduct({
    id: "product-1",
    name: "Atelier",
    category: "bois",
    updatedAt: "2026-10-10T00:00:00.000Z",
    entries: [
      { id: "photo-1", kind: "photo", text: "", mediaId: "media-1", createdAt: "2026-10-09T00:00:00.000Z" },
      { id: "note-1", kind: "note", text: "Ancienne note", createdAt: "2026-10-08T00:00:00.000Z" },
    ],
  });
  const remote = createProduct({
    id: "product-1",
    name: "Atelier modifié",
    category: "bois",
    updatedAt: "2026-10-12T00:00:00.000Z",
    entries: [{ id: "note-1", kind: "note", text: "Note mise à jour", createdAt: "2026-10-08T00:00:00.000Z" }],
  });

  const merged = mergeProductVersions(local, remote);

  assert.equal(merged.name, "Atelier modifié");
  assert.deepEqual(merged.entries.map((entry) => entry.id), ["photo-1", "note-1"]);
  assert.equal(merged.entries[1].text, "Note mise à jour");
  assert.equal(merged.entries[0].mediaId, "media-1");
});

test("mergeProductVersions keeps remote-only entries when local fields are newer", () => {
  const local = {
    ...createProduct({
    id: "product-1",
    name: "Atelier modifié",
    category: "bois",
    entries: [{ id: "photo-1", kind: "photo", text: "", mediaId: "media-1", createdAt: "2026-10-10T00:00:00.000Z" }],
    }),
    updatedAt: "2026-10-12T00:00:00.000Z",
  };
  const remote = {
    ...createProduct({
    id: "product-1",
    name: "Atelier",
    category: "bois",
    entries: [{ id: "note-1", kind: "note", text: "Note cloud", createdAt: "2026-10-11T00:00:00.000Z" }],
    }),
    updatedAt: "2026-10-10T00:00:00.000Z",
  };

  const merged = mergeProductVersions(local, remote);

  assert.equal(merged.name, "Atelier modifié");
  assert.deepEqual(merged.entries.map((entry) => entry.id), ["note-1", "photo-1"]);
});

test("removeEntry removes a journal event without mutating the original product", () => {
  const product = createProduct({
    name: "Sac",
    category: "cuir",
    entries: [
      { id: "note-1", kind: "note", text: "Étape", createdAt: "2026-10-10T00:00:00.000Z" },
      { id: "photo-1", kind: "photo", text: "", mediaId: "media-1", createdAt: "2026-10-11T00:00:00.000Z" },
    ],
  });
  const updated = removeEntry(product, "photo-1", new Date("2026-10-13T00:00:00.000Z"));
  assert.deepEqual(updated.entries.map((entry) => entry.id), ["note-1"]);
  assert.equal(updated.updatedAt, "2026-10-13T00:00:00.000Z");
  assert.deepEqual(product.entries.map((entry) => entry.id), ["note-1", "photo-1"]);
  assert.equal(removeEntry(product, "unknown"), product);
});

test("note work details can be edited without changing the note identity or creation date", () => {
  const product = createProduct({
    name: "Tabouret",
    category: "bois",
    entries: [{ id: "note-1", kind: "note", text: "Découpe", createdAt: "2026-10-12T00:00:00.000Z" }],
  });
  const updated = updateNoteEntry(
    product,
    "note-1",
    "Découpe sur la scie",
    { durationMinutes: 45, workMethod: "machine", machineName: "Scie sur table", toolNames: ["Ciseau à bois"] },
    new Date("2026-10-13T00:00:00.000Z"),
  );
  assert.deepEqual(updated.entries[0], {
    id: "note-1",
    kind: "note",
    text: "Découpe sur la scie",
    createdAt: "2026-10-12T00:00:00.000Z",
    durationMinutes: 45,
    workMethod: "machine",
    machineName: "Scie sur table",
    toolNames: ["Ciseau à bois"],
  });
  assert.equal(updated.updatedAt, "2026-10-13T00:00:00.000Z");
  assert.equal(product.entries[0].text, "Découpe");
  assert.equal(updateNoteEntry(product, "unknown", "Texte", {}).entries, product.entries);
  const cleared = updateNoteEntry(updated, "note-1", "Sans durée", {});
  assert.equal(cleared.entries[0].durationMinutes, undefined);
  assert.equal(cleared.entries[0].workMethod, undefined);
  assert.equal(cleared.entries[0].machineName, undefined);
  assert.equal(cleared.entries[0].toolNames, undefined);
});

test("project work summary totals timed notes and lists each used machine once", () => {
  const entries = [
    { id: "manual", kind: "note", text: "Ponçage", createdAt: "2026-10-12T00:00:00.000Z", durationMinutes: 35, workMethod: "manual", toolNames: ["Ciseau"] },
    { id: "machine-1", kind: "note", text: "Découpe", createdAt: "2026-10-12T00:00:00.000Z", durationMinutes: 50, workMethod: "machine", machineName: "Scie", toolNames: ["Ponceuse"] },
    { id: "machine-2", kind: "note", text: "Rainure", createdAt: "2026-10-12T00:00:00.000Z", durationMinutes: 25, workMethod: "machine", machineName: "Scie", toolNames: ["Ciseau"] },
    { id: "photo", kind: "photo", text: "", createdAt: "2026-10-12T00:00:00.000Z", durationMinutes: 999, workMethod: "machine", machineName: "Caméra" },
    { id: "untimed", kind: "note", text: "Croquis", createdAt: "2026-10-12T00:00:00.000Z" },
  ];
  assert.deepEqual(summarizeEntryWork(entries), {
    totalMinutes: 110,
    manualMinutes: 35,
    machineMinutes: 75,
    machines: ["Scie"],
    tools: ["Ciseau", "Ponceuse"],
  });
  assert.equal(formatDurationMinutes(95), "1 h 35 min");
  assert.equal(formatDurationMinutes(120), "2 h");
});

test("saved machine and tool names become reusable suggestions", () => {
  const products = [
    createProduct({
      name: "Table",
      category: "bois",
      tools: "Scie, Rabot\nCiseau",
      entries: [{
        id: "note-1",
        kind: "note",
        text: "Découpe",
        createdAt: "2026-10-12T00:00:00.000Z",
        durationMinutes: 30,
        workMethod: "machine",
        machineName: "Scie circulaire",
        toolNames: ["Ponceuse", "rabot"],
      }],
    }),
  ];
  assert.deepEqual(collectEquipmentOptions(products), {
    machines: ["Scie circulaire"],
    tools: ["Ciseau", "Ponceuse", "Rabot", "Scie"],
  });
});

test("starter products are recognized for local and cloud cleanup", () => {
  assert.equal(isStarterProduct({ id: "5ecf53ae-37d0-4f74-a261-7eac91a59401" }), true);
  assert.equal(isStarterProduct({ id: "sample-box" }), true);
  assert.equal(isStarterProduct({ id: "27492d2a-8f34-4e0c-a58a-dc9eab778755" }), false);
});
