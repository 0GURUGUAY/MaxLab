export type ProfileSettings = {
  geminiApiKey: string;
  companyName: string;
  companyLogoUrl: string; // Base64 data URL ou URL d'image
  companyInfo: string; // Informations affichées en pied de page (adresse, SIRET, contact, etc.)
};

export const PROFILE_STORAGE_KEY = "maxlab.profile.v1";
const PROFILE_SYNC_PENDING_KEY = "maxlab.profile-sync-pending.v1";
export const GEMINI_MODEL = "gemini-3.8-flash";

export const defaultProfileSettings: ProfileSettings = {
  geminiApiKey: "",
  companyName: "MaxLab Atelier",
  companyLogoUrl: "",
  companyInfo: "MaxLab Atelier d'Artisanat & Création\n12, rue des Ateliers · 75011 Paris\ncontact@maxlab-atelier.fr · Tél : 01 42 00 00 00\nSIRET : 894 123 456 00018 · Atelier d'art de France",
};

export function isDefaultProfileSettings(settings: ProfileSettings): boolean {
  return settings.geminiApiKey.trim() === ""
    && settings.companyName === defaultProfileSettings.companyName
    && settings.companyLogoUrl === defaultProfileSettings.companyLogoUrl
    && settings.companyInfo === defaultProfileSettings.companyInfo;
}

export function loadProfileSettings(): ProfileSettings {
  if (typeof localStorage === "undefined") return { ...defaultProfileSettings };
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return { ...defaultProfileSettings };
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return {
      geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey.trim() : "",
      companyName: typeof parsed.companyName === "string" && parsed.companyName.trim() ? parsed.companyName.trim() : defaultProfileSettings.companyName,
      companyLogoUrl: typeof parsed.companyLogoUrl === "string" ? parsed.companyLogoUrl : "",
      companyInfo: typeof parsed.companyInfo === "string" ? parsed.companyInfo : defaultProfileSettings.companyInfo,
    };
  } catch {
    return { ...defaultProfileSettings };
  }
}

export function saveProfileSettings(settings: ProfileSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(settings));
}

export function markProfilePendingSync(): void {
  localStorage.setItem(PROFILE_SYNC_PENDING_KEY, "1");
}

export function hasProfilePendingSync(): boolean {
  return localStorage.getItem(PROFILE_SYNC_PENDING_KEY) === "1";
}

export function clearProfilePendingSync(): void {
  localStorage.removeItem(PROFILE_SYNC_PENDING_KEY);
}

export async function testGeminiApiKey(apiKey: string): Promise<{ ok: boolean; message: string; model?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { ok: false, message: "Veuillez renseigner une clé API Gemini." };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cleanKey },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Reponds seulement 'OK' en un mot." }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
        },
      }),
    });

    if (response.ok) {
      return { ok: true, message: `Connexion à Google Gemini réussie (${GEMINI_MODEL}) !`, model: GEMINI_MODEL };
    }

    const errorJson = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const msg = errorJson?.error?.message || `Erreur HTTP ${response.status}`;
    return { ok: false, message: `Échec de validation de la clé : ${msg}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `Erreur réseau : ${error.message}` : "Impossible de contacter l'API Gemini.",
    };
  }
}
