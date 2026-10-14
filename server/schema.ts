import { z } from "zod";

const timestamp = z.iso.datetime();
const text = z.string().max(5000);
const idSchema = z.string().uuid();

export const entrySchema = z.strictObject({
  id: idSchema,
  kind: z.enum(["note", "photo", "file", "sketch"]),
  createdAt: timestamp,
  text,
  durationMinutes: z.number().int().min(1).max(525600).optional(),
  workMethod: z.enum(["manual", "machine"]).optional(),
  machineName: z.string().trim().max(120).optional(),
  toolNames: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  mediaId: idSchema.optional(),
  mediaPath: z.string().max(1000).optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(150).optional(),
});

const generatedDocumentSchema = z.strictObject({
  id: idSchema,
  dataSheets: z.strictObject({
    technical: z.strictObject({
      title: z.string().max(200),
      reference: z.string().max(100),
      category: z.string().max(100),
      dimensions: z.string().max(500),
      materials: z.array(z.strictObject({
        name: z.string().max(200),
        specs: z.string().max(1000),
      })).max(50),
      fabricationSteps: z.array(z.strictObject({
        step: z.number().int().positive(),
        title: z.string().max(200),
        description: z.string().max(2000),
        duration: z.string().max(100).optional(),
      })).max(50),
      toolsRequired: z.array(z.string().max(200)).max(100),
      finishingAndCare: z.string().max(3000),
      qualityPoints: z.array(z.string().max(1000)).max(50),
      safetyNotes: z.string().max(3000).optional(),
    }),
    commercial: z.strictObject({
      title: z.string().max(200),
      tagline: z.string().max(1000),
      storytelling: z.string().max(5000),
      keyArguments: z.array(z.string().max(1000)).max(50),
      targetAudience: z.string().max(2000),
      presentationTips: z.string().max(3000),
      salesPitch: z.string().max(3000),
    }),
    generatedAt: timestamp,
    modelUsed: z.string().max(100).optional(),
  }),
});

export const productSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  category: z.enum(["bois", "cuir", "tissu", "photos"]),
  subcategory: z.string().max(100),
  status: z.enum(["idea", "in-progress", "finished"]),
  createdAt: timestamp,
  updatedAt: timestamp,
  materials: z.string().max(1000),
  dimensions: z.string().max(500),
  techniques: z.string().max(2000),
  tools: z.string().max(1000),
  duration: z.string().max(200),
  description: z.string().max(10000),
  entries: z.array(entrySchema).max(200),
  generatedDocuments: z.array(generatedDocumentSchema).max(50).optional(),
}).superRefine((product, context) => {
  const entryIds = product.entries.map((entry) => entry.id);
  const mediaIds = product.entries.flatMap((entry) => entry.mediaId ? [entry.mediaId] : []);
  if (new Set(entryIds).size !== entryIds.length) {
    context.addIssue({ code: "custom", path: ["entries"], message: "Chaque entrée doit avoir un identifiant unique." });
  }
  if (new Set(mediaIds).size !== mediaIds.length) {
    context.addIssue({ code: "custom", path: ["entries"], message: "Chaque média doit avoir un identifiant unique." });
  }
  if (Buffer.byteLength(JSON.stringify(product), "utf8") > 700_000) {
    context.addIssue({ code: "custom", message: "Fiche trop volumineuse ; réduisez le texte ou le nombre d'étapes." });
  }
});

export const profileSettingsSchema = z.strictObject({
  geminiApiKey: z.string().max(512),
  companyName: z.string().trim().min(1).max(120),
  companyLogoUrl: z.string().max(7_000_000),
  companyInfo: z.string().max(5000),
});

export const mediaIdSchema = idSchema;

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}
