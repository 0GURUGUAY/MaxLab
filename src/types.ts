export type ProductCategory = "bois" | "cuir" | "tissu" | "photos";
export type ProductStatus = "idea" | "in-progress" | "finished";
export type EntryKind = "note" | "photo" | "file" | "sketch";
export type EntryWorkMethod = "manual" | "machine";

export type WorkshopEntry = {
  id: string;
  kind: EntryKind;
  createdAt: string;
  text: string;
  durationMinutes?: number;
  workMethod?: EntryWorkMethod;
  machineName?: string;
  toolNames?: string[];
  mediaId?: string;
  mediaPath?: string;
  fileName?: string;
  mimeType?: string;
};

export type GeneratedDocument = {
  id: string;
  dataSheets: import("./ai").DataSheetsResult;
};

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  subcategory: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  materials: string;
  dimensions: string;
  techniques: string;
  tools: string;
  duration: string;
  description: string;
  entries: WorkshopEntry[];
  generatedDocuments?: GeneratedDocument[];
};
