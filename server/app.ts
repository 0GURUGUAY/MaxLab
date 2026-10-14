import express from "express";
import { createHash, randomBytes } from "node:crypto";
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { ApiError, mediaIdSchema, productSchema, profileSettingsSchema } from "./schema";
import type { CloudIdentity, CloudStore } from "./store";

const SESSION_COOKIE = "maxlab_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type Options = {
  store: CloudStore;
  verifyToken: (token: string) => Promise<CloudIdentity>;
  allowedOrigins: string[];
  secureCookies?: boolean;
};

const asyncRoute = (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (request, response, next) => { void handler(request, response, next).catch(next); };

function hashSession(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

function readSessionId(request: Request): string | undefined {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const sessionId = cookie?.slice(SESSION_COOKIE.length + 1);
  return sessionId && /^[A-Za-z0-9_-]{43}$/.test(sessionId) ? sessionId : undefined;
}

function setSessionCookie(response: Response, sessionId: string, secure: boolean): void {
  response.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    ...(secure ? ["Secure"] : []),
  ].join("; "));
}

function clearSessionCookie(response: Response, secure: boolean): void {
  response.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; "));
}

const allowedMediaTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain",
  "application/octet-stream", "application/zip",
]);

export function createApp(options: Options) {
  const app = express();
  const secureCookies = options.secureCookies ?? false;
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });
  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.use("/api", (request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    const origin = request.headers.origin;
    if (origin) {
      if (!options.allowedOrigins.includes(origin)) {
        response.status(403).json({ error: "Origine non autorisée." });
        return;
      }
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Media-Type");
    }
    if (request.method === "OPTIONS") { response.sendStatus(204); return; }
    next();
  });
  app.post("/api/auth/session", asyncRoute(async (request, response) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ") || header.length > 8192) {
      throw new ApiError(401, "Connexion Google requise.");
    }
    let identity: CloudIdentity;
    try {
      identity = await options.verifyToken(header.slice(7));
    } catch (error) {
      console.warn("Vérification Google refusée", error instanceof Error ? error.name : "Erreur");
      throw new ApiError(401, "Connexion Google expirée ou invalide.");
    }
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(identity.sub)) {
      throw new ApiError(401, "Identifiant Google invalide.");
    }
    const sessionId = randomBytes(32).toString("base64url");
    await options.store.createSession(hashSession(sessionId), identity);
    setSessionCookie(response, sessionId, secureCookies);
    response.json(identity);
  }));
  app.delete("/api/auth/session", asyncRoute(async (request, response) => {
    const sessionId = readSessionId(request);
    if (sessionId) await options.store.deleteSession(hashSession(sessionId));
    clearSessionCookie(response, secureCookies);
    response.sendStatus(204);
  }));
  app.use("/api", asyncRoute(async (request, response, next) => {
    const header = request.headers.authorization;
    let identity: CloudIdentity | undefined;
    let sessionId: string | undefined;
    if (header?.startsWith("Bearer ") && header.length <= 8192) {
      try {
        identity = await options.verifyToken(header.slice(7));
      } catch (error) {
        console.warn("Vérification Google refusée", error instanceof Error ? error.name : "Erreur");
        throw new ApiError(401, "Connexion Google expirée ou invalide.");
      }
    } else {
      sessionId = readSessionId(request);
      if (sessionId) identity = await options.store.getSession(hashSession(sessionId));
    }
    if (!identity) throw new ApiError(401, "Connexion Google requise.");
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(identity.sub)) throw new ApiError(401, "Identifiant Google invalide.");
    if (sessionId) setSessionCookie(response, sessionId, secureCookies);
    response.locals.identity = identity;
    next();
  }));
  app.get("/api/auth/me", (_request, response) => response.json(response.locals.identity));
  app.get("/api/profile", asyncRoute(async (_request, response) => {
    response.json({ profile: await options.store.getProfile(response.locals.identity.sub) ?? null });
  }));
  app.put("/api/profile", express.json({ limit: "8mb" }), asyncRoute(async (request, response) => {
    const settings = profileSettingsSchema.parse(request.body);
    await options.store.writeProfile(response.locals.identity.sub, settings);
    response.json({ saved: true });
  }));
  app.get("/api/products", asyncRoute(async (_request, response) => {
    response.json({ products: await options.store.listProducts(response.locals.identity.sub) });
  }));
  app.put("/api/products/:productId", express.json({ limit: "1mb" }), asyncRoute(async (request, response) => {
    const product = productSchema.parse(request.body);
    if (product.id !== request.params.productId) throw new ApiError(400, "Identifiant de création incohérent.");
    response.json({ product: await options.store.writeProduct(response.locals.identity.sub, product) });
  }));
  app.delete("/api/products/:productId", asyncRoute(async (request, response) => {
    const productId = mediaIdSchema.parse(request.params.productId);
    await options.store.deleteProduct(response.locals.identity.sub, productId);
    response.sendStatus(204);
  }));
  app.put("/api/products/:productId/media/:mediaId", express.raw({ type: "application/octet-stream", limit: "20mb" }), asyncRoute(async (request, response) => {
    const productId = mediaIdSchema.parse(request.params.productId);
    const mediaId = mediaIdSchema.parse(request.params.mediaId);
    const mimeType = request.headers["x-media-type"];
    if (typeof mimeType !== "string" || !allowedMediaTypes.has(mimeType)) throw new ApiError(400, "Type de fichier non accepté.");
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) throw new ApiError(400, "Fichier vide ou Content-Type incorrect.");
    if (mimeType.startsWith("image/") && request.body.length > 8 * 1024 * 1024) throw new ApiError(413, "Photo trop volumineuse (8 Mio maximum).");
    await options.store.putMedia(response.locals.identity.sub, productId, mediaId, request.body, mimeType);
    response.status(201).json({ id: mediaId, mimeType, sizeBytes: request.body.length });
  }));
  app.delete("/api/products/:productId/media/:mediaId", asyncRoute(async (request, response) => {
    const productId = mediaIdSchema.parse(request.params.productId);
    const mediaId = mediaIdSchema.parse(request.params.mediaId);
    await options.store.deleteMedia(response.locals.identity.sub, productId, mediaId);
    response.sendStatus(204);
  }));
  app.get("/api/products/:productId/media/:mediaId", asyncRoute(async (request, response) => {
    const productId = mediaIdSchema.parse(request.params.productId);
    const mediaId = mediaIdSchema.parse(request.params.mediaId);
    const file = await options.store.getMedia(response.locals.identity.sub, productId, mediaId);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Disposition", "attachment");
    response.send(file.bytes);
  }));
  app.use("/api", (_request, response) => response.status(404).json({ error: "Route API introuvable." }));
  const errors: ErrorRequestHandler = (error: unknown, _request, response, next) => {
    if (response.headersSent) { next(error); return; }
    if (error instanceof ApiError) { response.status(error.status).json({ error: error.message }); return; }
    if (error instanceof ZodError) {
      response.status(400).json({ error: "Données invalides.", issues: error.issues.map(({ path, message }) => ({ path, message })) });
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error && typeof error.type === "string") {
      if (error.type === "entity.too.large") { response.status(413).json({ error: "Requête trop volumineuse." }); return; }
      if (error.type === "entity.parse.failed") { response.status(400).json({ error: "JSON invalide." }); return; }
    }
    console.error("Erreur API", error);
    response.status(500).json({ error: "Erreur du serveur. Les données n'ont pas été confirmées comme sauvegardées." });
  };
  app.use(errors);
  return app;
}
