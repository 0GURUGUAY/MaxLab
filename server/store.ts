import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ApiError } from "./schema";
import type { Product } from "../src/types";
import type { ProfileSettings } from "../src/profile";

export type CloudIdentity = { sub: string; email?: string; name?: string };

type Services = {
  db: ReturnType<typeof getFirestore>;
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>;
};

export function createCloudStore(bucketName: string, services?: Services) {
  const db = services?.db ?? getFirestore();
  const bucket = services?.bucket ?? getStorage().bucket(bucketName);
  const productRef = (userId: string, productId: string) =>
    db.collection("users").doc(userId).collection("products").doc(productId);
  const profileRef = (userId: string) =>
    db.collection("users").doc(userId).collection("settings").doc("profile");
  const mediaPath = (userId: string, productId: string, mediaId: string) =>
    `users/${userId}/products/${productId}/media/${mediaId}`;
  const profileLogoPath = (userId: string) => `users/${userId}/profile/company-logo`;

  return {
    async createSession(sessionId: string, identity: CloudIdentity): Promise<void> {
      await db.collection("sessions").doc(sessionId).set(identity);
    },
    async getSession(sessionId: string): Promise<CloudIdentity | undefined> {
      const snapshot = await db.collection("sessions").doc(sessionId).get();
      return snapshot.exists ? snapshot.data() as CloudIdentity : undefined;
    },
    async deleteSession(sessionId: string): Promise<void> {
      await db.collection("sessions").doc(sessionId).delete();
    },
    async listProducts(userId: string): Promise<Product[]> {
      const snapshot = await db.collection("users").doc(userId).collection("products")
        .orderBy("updatedAt", "desc").limit(100).get();
      return snapshot.docs.map((document) => document.data() as Product);
    },
    async getProfile(userId: string): Promise<ProfileSettings | undefined> {
      const snapshot = await profileRef(userId).get();
      if (!snapshot.exists) return undefined;
      const value = snapshot.data() as Omit<ProfileSettings, "companyLogoUrl"> & {
        companyLogoUrl?: string;
        companyLogoInBucket?: boolean;
      };
      let companyLogoUrl = value.companyLogoUrl ?? "";
      if (value.companyLogoInBucket) {
        const file = bucket.file(profileLogoPath(userId));
        const [exists] = await file.exists();
        if (!exists) throw new Error("Le logo du profil est introuvable dans le stockage cloud.");
        const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
        companyLogoUrl = `data:${metadata.contentType ?? "application/octet-stream"};base64,${bytes.toString("base64")}`;
      }
      return {
        geminiApiKey: value.geminiApiKey,
        companyName: value.companyName,
        companyLogoUrl,
        companyInfo: value.companyInfo,
      };
    },
    async writeProfile(userId: string, settings: ProfileSettings): Promise<void> {
      const logoFile = bucket.file(profileLogoPath(userId));
      const logoData = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/.exec(settings.companyLogoUrl);
      let companyLogoUrl = settings.companyLogoUrl;
      let companyLogoInBucket = false;
      if (settings.companyLogoUrl.startsWith("data:")) {
        if (!logoData) throw new ApiError(400, "Le logo doit être une image PNG, JPEG, WebP, GIF ou SVG encodée en base64.");
        const bytes = Buffer.from(logoData[2], "base64");
        if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
          throw new ApiError(413, "Le logo doit faire au maximum 5 Mio.");
        }
        await logoFile.save(bytes, {
          resumable: false,
          validation: "crc32c",
          metadata: { contentType: logoData[1], cacheControl: "private, no-store" },
        });
        companyLogoUrl = "";
        companyLogoInBucket = true;
      } else if (settings.companyLogoUrl) {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(settings.companyLogoUrl);
        } catch (error) {
          throw new ApiError(400, "L'adresse du logo est invalide.");
        }
        if (parsedUrl.protocol !== "https:") throw new ApiError(400, "L'adresse du logo doit utiliser HTTPS.");
        await logoFile.delete({ ignoreNotFound: true });
      } else {
        await logoFile.delete({ ignoreNotFound: true });
      }
      await profileRef(userId).set({
        geminiApiKey: settings.geminiApiKey,
        companyName: settings.companyName,
        companyLogoUrl,
        companyLogoInBucket,
        companyInfo: settings.companyInfo,
        updatedAt: new Date().toISOString(),
      });
    },
    async writeProduct(userId: string, product: Product): Promise<Product> {
      const ref = productRef(userId, product.id);
      const updatedAt = new Date().toISOString();
      const saved = await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        const existingProduct = existing.data() as Product | undefined;
        if (existingProduct && Date.parse(product.updatedAt) < Date.parse(existingProduct.updatedAt)) {
          throw new ApiError(409, "Cette fiche a été modifiée sur un autre appareil. Relance la synchronisation pour récupérer la version la plus récente.");
        }
        const value = { ...product, updatedAt };
        transaction.set(ref, value);
        return value;
      });
      return saved;
    },
    async deleteProduct(userId: string, productId: string): Promise<void> {
      const ref = productRef(userId, productId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new ApiError(404, "Création introuvable.");
      await ref.delete();
      const [files] = await bucket.getFiles({ prefix: `users/${userId}/products/${productId}/media/` });
      await Promise.all(files.map((file) => file.delete()));
    },
    async putMedia(userId: string, productId: string, mediaId: string, bytes: Buffer, mimeType: string): Promise<void> {
      const product = await productRef(userId, productId).get();
      if (!product.exists) throw new ApiError(404, "Création introuvable.");
      await bucket.file(mediaPath(userId, productId, mediaId)).save(bytes, {
        resumable: false,
        validation: "crc32c",
        metadata: { contentType: mimeType, cacheControl: "private, no-store" },
      });
    },
    async deleteMedia(userId: string, productId: string, mediaId: string): Promise<void> {
      const product = await productRef(userId, productId).get();
      if (!product.exists) throw new ApiError(404, "Création introuvable.");
      await bucket.file(mediaPath(userId, productId, mediaId)).delete({ ignoreNotFound: true });
    },
    async getMedia(userId: string, productId: string, mediaId: string): Promise<{ bytes: Buffer; mimeType: string }> {
      const product = await productRef(userId, productId).get();
      if (!product.exists) throw new ApiError(404, "Création introuvable.");
      const file = bucket.file(mediaPath(userId, productId, mediaId));
      const [exists] = await file.exists();
      if (!exists) throw new ApiError(404, "Fichier introuvable.");
      const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
      return { bytes, mimeType: metadata.contentType ?? "application/octet-stream" };
    },
  };
}

export type CloudStore = ReturnType<typeof createCloudStore>;
