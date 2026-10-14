import type { Product } from "./types";
import { GEMINI_MODEL } from "./profile";

export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

export type TechnicalSheet = {
  title: string;
  reference: string;
  category: string;
  dimensions: string;
  materials: Array<{ name: string; specs: string }>;
  fabricationSteps: Array<{ step: number; title: string; description: string; duration?: string }>;
  toolsRequired: string[];
  finishingAndCare: string;
  qualityPoints: string[];
  safetyNotes?: string;
};

export type CommercialSheet = {
  title: string;
  tagline: string;
  storytelling: string;
  keyArguments: string[];
  targetAudience: string;
  presentationTips: string;
  salesPitch: string;
};

export type DataSheetsResult = {
  technical: TechnicalSheet;
  commercial: CommercialSheet;
  generatedAt: string;
  modelUsed?: string;
};

export type CraftingIdea = {
  id: string;
  title: string;
  category: string;
  type: "variation" | "complementary" | "offcut" | "process";
  typeLabel: string;
  description: string;
  materialsNeeded: string;
  difficulty: "accessible" | "intermédiaire" | "avancé";
  estimatedDuration: string;
  craftingTips: string[];
  whyItFits: string;
};

async function callGeminiApi(
  apiKey: string,
  prompt: string,
  imagesBase64?: Array<{ mimeType: string; data: string }>,
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) throw new Error("Veuillez renseigner votre clé API Gemini dans la section Profil.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  for (const img of imagesBase64 ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  parts.push({ text: prompt });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cleanKey },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 3000,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(`Erreur Gemini : ${errorBody?.error?.message || `HTTP ${response.status}`}`);
  }
  const json = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini n'a renvoyé aucun texte. La réponse peut avoir été bloquée ou interrompue.");
  return text;
}

async function callGeminiImageApi(
  apiKey: string,
  prompt: string,
  image: { mimeType: string; data: string },
): Promise<{ base64: string; mimeType: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) throw new Error("Veuillez renseigner votre clé API Gemini dans la section Profil.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cleanKey },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: image },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(`Erreur Gemini : ${errorBody?.error?.message || `HTTP ${response.status}`}`);
  }

  const json = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
      };
    }>;
  };
  const imagePart = json.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => part.inlineData?.data)?.inlineData;
  if (!imagePart?.data) {
    throw new Error("Gemini n'a renvoyé aucune image. La réponse peut avoir été bloquée ou interrompue.");
  }
  return { base64: imagePart.data, mimeType: imagePart.mimeType || "image/jpeg" };
}

export type SketchResult = {
  blob: Blob;
  dataUrl: string;
  source: "gemini";
  dimensionsDetected?: string;
  details?: string;
};

export async function generateSketchFromPhoto(params: {
  apiKey?: string;
  imageBlobOrFile: Blob | File;
  product?: Partial<Product>;
}): Promise<SketchResult> {
  const { apiKey, imageBlobOrFile, product } = params;
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    throw new Error("Veuillez renseigner votre clé API Gemini dans la section Profil.");
  }

  const imageBytes = new Uint8Array(await imageBlobOrFile.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < imageBytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...imageBytes.subarray(offset, offset + 0x8000));
  }
  const base64 = btoa(binary);
  const mimeType = imageBlobOrFile.type || "image/jpeg";
  const prompt = `Transforme la photo fournie en croquis technique d'atelier de l'objet ${product?.name || "artisanal"}.
Conserve fidèlement sa forme, ses proportions, ses détails et ses matériaux visibles. Présente-le comme un dessin au crayon graphite avec hachures fines, lignes de construction propres et fond papier crème légèrement texturé.
${product?.dimensions ? `Indique la cote connue « ${product.dimensions} » sans en inventer d'autres.` : "N'invente aucune dimension ni annotation chiffrée."}
Vue isométrique, composition sobre, l'objet reste clairement reconnaissable. Génère une image, sans légende ni texte superflu.`;
  const generatedImage = await callGeminiImageApi(cleanKey, prompt, { mimeType, data: base64 });
  const byteCharacters = atob(generatedImage.base64);
  const byteArray = Uint8Array.from(byteCharacters, (character) => character.charCodeAt(0));
  const blob = new Blob([byteArray], { type: generatedImage.mimeType });
  const dataUrl = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;

  return {
    blob,
    dataUrl,
    source: "gemini",
    details: "Croquis technique généré par Gemini à partir de la photo source.",
  };
}

// ============================================================================
// CHEMIN 2 : FICHES TECHNIQUES ET COMMERCIALES
// ============================================================================

export async function generateProductDataSheets(params: {
  apiKey?: string;
  product: Product;
  companyName?: string;
  imageBase64?: { mimeType: string; data: string };
}): Promise<DataSheetsResult> {
  const { apiKey, product, companyName = "MaxLab Atelier", imageBase64 } = params;

  if (apiKey?.trim()) {
    const prompt = `Tu es le responsable technique et marketing d'un atelier d'artisanat haut de gamme ("${companyName}").
Génère une FICHE TECHNIQUE et une FICHE COMMERCIALE professionnelles pour ce produit :
- Nom : ${product.name}
- Catégorie : ${product.category} (${product.subcategory || "artisanat"})
- Matières renseignées : ${product.materials || "non précisé"}
- Dimensions : ${product.dimensions || "sur mesure"}
- Techniques : ${product.techniques || "façonnage manuel"}
- Outils : ${product.tools || "outillage d'atelier traditionnel"}
- Temps passé : ${product.duration || "non précisé"}
- Description d'origine : ${product.description || "pièce artisanale"}

Réponds STRICTEMENT avec un JSON valide respectant cette structure exacte sans texte avant ou après :
{
  "technical": {
    "title": "Nom officiel de la pièce",
    "reference": "REF-MAX-XXXX",
    "category": "${product.category}",
    "dimensions": "dimensions précises",
    "materials": [
      { "name": "Matière 1", "specs": "Détails, essence ou provenance" }
    ],
    "fabricationSteps": [
      { "step": 1, "title": "Étape 1", "description": "Explication du geste", "duration": "30 min" }
    ],
    "toolsRequired": ["Outil 1", "Machine 2"],
    "finishingAndCare": "Traitement de surface et conseils d'entretien",
    "qualityPoints": ["Point de contrôle 1", "Tolérance géométrique"]
  },
  "commercial": {
    "title": "Titre commercial attractif",
    "tagline": "Une phrase d'accroche poétique et valorisante",
    "storytelling": "L'histoire de la pièce, l'inspiration de l'atelier, la beauté de la matière vivante",
    "keyArguments": ["Argument 1", "Argument 2", "Argument 3", "Argument 4"],
    "targetAudience": "Public cible et occasions idéales (cadeau, décoration d'intérieur, amateurs d'artisanat)",
    "presentationTips": "Conseils de mise en valeur en boutique ou photo",
    "salesPitch": "Le mot de l'artisan pour convaincre un client exigeant"
  }
}

N'invente aucun prix de vente, coût, marge ni estimation financière. Ne mentionne aucun montant dans les textes commerciaux.`;

    try {
      const images = imageBase64 ? [imageBase64] : undefined;
      const rawText = await callGeminiApi(apiKey, prompt, images);
      
      // Nettoyer d'éventuels backticks markdown json
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned) as { technical: TechnicalSheet; commercial: CommercialSheet };
      return {
        technical: parsed.technical,
        commercial: parsed.commercial,
        generatedAt: new Date().toISOString(),
        modelUsed: "Google Gemini",
      };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Impossible de générer les fiches Gemini.");
    }
  }

  // Générateur local hors ligne / template riche
  return generateOfflineDataSheets(product);
}

function generateOfflineDataSheets(product: Product): DataSheetsResult {
  const refCode = `ML-${product.category.toUpperCase().slice(0, 3)}-${product.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const materialsList = product.materials
    ? product.materials.split(/[,;\n]/).map((m) => ({ name: m.trim(), specs: "Sélection atelier premier choix" })).filter((m) => m.name)
    : [
        { name: "Matière brute noble", specs: "Essence ou étoffe sélectionnée pour sa texture et sa durabilité" },
        { name: "Finitions d'atelier", specs: "Huile naturelle, cire d'abeille ou traitement protecteur sans COV" },
      ];

  const toolsList = product.tools
    ? product.tools.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean)
    : ["Trusquin et réglet d'atelier", "Outils de coupe manuels", "Abrasifs grain fin (120 à 320)", "Chiffon de lustrage"];

  const tech: TechnicalSheet = {
    title: product.name,
    reference: refCode,
    category: product.category,
    dimensions: product.dimensions || "Dimensions selon gabarit d'atelier (ex: Ø 77 mm × 147 mm)",
    materials: materialsList,
    fabricationSteps: [
      { step: 1, title: "Sélection & Débit", description: "Contrôle du fil de la matière, traçage et découpe des bruts aux cotes majorées.", duration: "30 min" },
      { step: 2, title: "Usinage & Mise en forme", description: product.techniques || "Passage aux outils de façonnage, rainurage, tournage ou ajustage des liaisons.", duration: "1 h 15" },
      { step: 3, title: "Assemblage & Ponçage", description: "Vérification des affleurements, ponçage progressif au grain fin pour un toucher soyeux.", duration: "45 min" },
      { step: 4, title: "Finition & Protection", description: "Application de la finition d'atelier pour nourrir la matière et révéler son grain.", duration: "30 min" },
    ],
    toolsRequired: toolsList,
    finishingAndCare: "Nettoyer avec un chiffon doux sec ou légèrement humide. Ne pas exposer directement aux sources d'humidité excessive.",
    qualityPoints: [
      "Absence d'éclat et perfection des arêtes adoucies",
      "Stabilité dimensionnelle et planéité de la base",
      "Homogénéité de la patine et de l'aspect de surface",
    ],
  };

  const comm: CommercialSheet = {
    title: product.name,
    tagline: `Une création d'exception façonnée à la main en ${product.category}.`,
    storytelling: product.description || `Née au cœur de notre atelier, cette pièce allie respect des gestes traditionnels et élégance contemporaine. Chaque nuance de matière raconte l'histoire du geste humain et du temps consacré à la perfection.`,
    keyArguments: [
      "100% fait main à l'atelier avec des matières nobles sélectionnées",
      "Finition écologique et naturelle respectueuse de la matière",
      "Chaque pièce est unique avec ses nuances naturelles propres",
      "Durabilité pensée pour traverser le temps et se patiner avec élégance",
    ],
    targetAudience: "Amateurs de bel artisanat, décoration raffinée, cadeaux intemporels haut de gamme.",
    presentationTips: "Présenter sur fond clair ou bois naturel brut avec un éclairage chaud mettant en valeur les textures.",
    salesPitch: `« Cette pièce n'est pas produite en série : elle a passé plusieurs heures entre les mains de l'artisan pour trouver cette harmonie entre texture et équilibre. »`,
  };

  return {
    technical: tech,
    commercial: comm,
    generatedAt: new Date().toISOString(),
    modelUsed: "MaxLab Atelier Engine",
  };
}

// ============================================================================
// CHEMIN 3 : IDÉES DE FABRICATION OU CRÉATION BASÉES SUR DES PROJETS
// ============================================================================

export async function generateCraftingIdeas(params: {
  apiKey?: string;
  product?: Product;
  allProducts?: Product[];
  focus?: "variations" | "complementary" | "offcuts" | "all";
}): Promise<CraftingIdea[]> {
  const { apiKey, product, allProducts = [] } = params;

  if (apiKey?.trim()) {
    const contextDescription = product
      ? `Projet source : "${product.name}" (Catégorie: ${product.category}, Matières: ${product.materials}, Dimensions: ${product.dimensions}, Techniques: ${product.techniques}, Description: ${product.description})`
      : `Catalogue de l'atelier : ${allProducts.map((p) => `${p.name} (${p.category})`).join(", ")}`;

    const prompt = `Tu es un maître d'atelier artisan et designer d'objets.
À partir de ce contexte d'atelier :
${contextDescription}

Propose 4 idées concrètes et inspirantes de fabrication ou création d'atelier :
1. Une DECLINAISON ou variante de forme / matière
2. Un OBJET COMPLEMENTAIRE pour former une gamme / ensemble
3. Une création astucieuse pour VALORISER LES CHUTES de matière
4. Une OPTIMISATION TECHNIQUE ou création d'un gabarit d'usinage pour l'atelier

Réponds STRICTEMENT avec un tableau JSON de 4 objets sans texte autour :
[
  {
    "id": "idea-1",
    "title": "Titre créatif de l'idée",
    "category": "${product?.category || "bois"}",
    "type": "variation",
    "typeLabel": "Déclinaison & Variante",
    "description": "Description détaillée de l'objet et du concept",
    "materialsNeeded": "Matières nécessaires",
    "difficulty": "intermédiaire",
    "estimatedDuration": "2 h 30",
    "craftingTips": ["Astuce de fabrication 1", "Astuce 2"],
    "whyItFits": "Pourquoi cette idée valorise le travail déjà accompli"
  }
]`;

    try {
      const rawText = await callGeminiApi(apiKey, prompt);
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned) as CraftingIdea[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
      throw new Error("Gemini n'a renvoyé aucune idée exploitable.");
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Impossible de générer les idées Gemini.");
    }
  }

  // Fallback local avec des idées pertinentes adaptées au projet
  return generateOfflineCraftingIdeas(product);
}

function generateOfflineCraftingIdeas(product?: Product): CraftingIdea[] {
  const cat = product?.category || "bois";
  const name = product?.name || "cette pièce";

  return [
    {
      id: "idea-" + Math.random().toString(36).slice(2, 8),
      title: `Déclinaison Duo Bi-Matière pour ${name}`,
      category: cat,
      type: "variation",
      typeLabel: "Déclinaison & Finition",
      description: `Créer une variante associant deux essences contrastées (chêne clair et noyer foncé, ou cuir naturel et bois teinté). Jouer sur des rainures de liaison visibles pour souligner l'assemblage.`,
      materialsNeeded: `${product?.materials || "Chêne massif, noyer, huile de lin, cire naturelle"}`,
      difficulty: "intermédiaire",
      estimatedDuration: "2 h 00",
      craftingTips: [
        "Raboter les deux essences ensemble pour garantir une planéité parfaite du joint de colle.",
        "Utiliser une colle vinylique transparente pour des joints invisibles.",
      ],
      whyItFits: `Reprend la silhouette de ${name} tout en lui offrant une identité visuelle encore plus haut de gamme.`,
    },
    {
      id: "idea-" + Math.random().toString(36).slice(2, 8),
      title: `Plateau de Présentation Coordonné`,
      category: cat,
      type: "complementary",
      typeLabel: "Objet Complémentaire de Gamme",
      description: `Un plateau d'accueil aux bords chanfreinés à 45° pensé pour accueillir ${name} et quelques accessoires (boîte d'allumettes, coupelle à bijoux ou vide-poche).`,
      materialsNeeded: "Chute de plateau ou planche rabotée, pieds feutre ou laiton",
      difficulty: "accessible",
      estimatedDuration: "1 h 30",
      craftingTips: [
        "Creuser une cuvette légère au défonçage ou à la gouge pour marquer l'emplacement de la pièce.",
        "Poncer jusqu'au grain 320 pour un toucher soyeux.",
      ],
      whyItFits: `Transforme une pièce isolée en un ensemble décoratif cohérent et augmentant la valeur commerciale.`,
    },
    {
      id: "idea-" + Math.random().toString(36).slice(2, 8),
      title: `Valorisation des Chutes : Porte-clés & Marque-pages d'Atelier`,
      category: cat,
      type: "offcut",
      typeLabel: "Valorisation des Chutes",
      description: `Utiliser les chutes de coupe issues de ${name} pour réaliser des porte-clés géométriques biseautés ou des petits cales-portes minimalistes gravés au poinçon.`,
      materialsNeeded: "Chutes de débit, anneau brisé en laiton, lacet de cuir",
      difficulty: "accessible",
      estimatedDuration: "45 min",
      craftingTips: [
        "Percer au diamètre 4 mm avec une mèche à bois bien affûtée pour éviter tout éclatement.",
        "Finition identique à la grande pièce pour une signature d'atelier reconnaissable.",
      ],
      whyItFits: "Zéro déchet à l'atelier et produit d'appel parfait à offrir ou vendre en complément.",
    },
    {
      id: "idea-" + Math.random().toString(36).slice(2, 8),
      title: `Gabarit d'Usinage & Perçage Répétable`,
      category: cat,
      type: "process",
      typeLabel: "Optimisation d'Atelier",
      description: `Fabriquer un gabarit en contreplaqué avec butée réglable pour reproduire l'usinage et les cotes de ${name} en divisant par deux le temps de traçage.`,
      materialsNeeded: "Contreplaqué 15 mm, vis à bois, serre-joints rapides",
      difficulty: "intermédiaire",
      estimatedDuration: "1 h 15",
      craftingTips: [
        "Intégrer des rainures de dégagement pour les copeaux lors des usinages en série.",
        "Graver les cotes au feutre indélébile ou au fer à marquer directement sur le gabarit.",
      ],
      whyItFits: "Augmente la précision, la répétabilité et la sécurité des gestes à l'atelier.",
    },
  ];
}
