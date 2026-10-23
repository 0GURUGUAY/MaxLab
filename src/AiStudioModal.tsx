import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Download,
  FileText,
  Hammer,
  ImagePlus,
  Key,
  Lightbulb,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { generateCraftingIdeas, generateProductDataSheets, generateSketchFromPhoto } from "./ai";
import { fetchCloudMedia } from "./cloud";
import { readMedia, storeMedia } from "./storage";
import type { CraftingIdea, DataSheetsResult, SketchResult } from "./ai";
import type { ProfileSettings } from "./profile";
import type { GeneratedDocument, Product } from "./types";

type AiStudioModalProps = {
  initialTab?: "sketch" | "sheets" | "ideas";
  initialProduct?: Product;
  products: Product[];
  profile: ProfileSettings;
  cloudToken?: string;
  onClose: () => void;
  onOpenProfile: () => void;
  onAddSketchEntry: (productId: string, mediaId: string, mimeType: string) => void;
  onOpenDocumentation: (product: Product, result: DataSheetsResult, coverUrl?: string) => void;
  onOpenSavedDocumentation: (product: Product, document: GeneratedDocument, coverUrl?: string) => void;
  onCreateProductFromIdea: (idea: CraftingIdea) => void;
};

export function AiStudioModal({
  initialTab = "sketch",
  initialProduct,
  products,
  profile,
  cloudToken,
  onClose,
  onOpenProfile,
  onAddSketchEntry,
  onOpenDocumentation,
  onOpenSavedDocumentation,
  onCreateProductFromIdea,
}: AiStudioModalProps) {
  const [activeTab, setActiveTab] = useState<"sketch" | "sheets" | "ideas">(initialTab);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProduct?.id || products[0]?.id || "",
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId) || initialProduct;

  // --------------------------------------------------------------------------
  // ÉTAT CHEMIN 1 : CROQUIS
  // --------------------------------------------------------------------------
  const [sketchSourceFile, setSketchSourceFile] = useState<File | Blob | null>(null);
  const [sketchPreviewUrl, setSketchPreviewUrl] = useState<string>("");
  const [sketchResult, setSketchResult] = useState<SketchResult | null>(null);
  const [sketchLoading, setSketchLoading] = useState(false);
  const [sketchError, setSketchError] = useState("");
  const [sketchSavedNotice, setSketchSavedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger la première image locale ou la récupérer depuis le cloud.
  useEffect(() => {
    if (!selectedProduct) return;
    const firstPhoto = selectedProduct.entries.find((entry) =>
      entry.kind === "photo" || entry.kind === "sketch"
        || (entry.kind === "file" && entry.mimeType?.startsWith("image/") === true));
    setSketchSourceFile(null);
    setSketchPreviewUrl("");
    if (!firstPhoto?.mediaId) return;

    const mediaId = firstPhoto.mediaId;
    const productId = selectedProduct.id;
    let active = true;
    let objectUrl = "";
    void (async () => {
      try {
        let blob = await readMedia(mediaId);
        if (!blob && cloudToken) {
          blob = await fetchCloudMedia(cloudToken, productId, mediaId);
          await storeMedia(mediaId, blob);
        }
        if (!blob) {
          if (active) setSketchError("Image source indisponible : importez une photo pour créer un croquis.");
          return;
        }
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSketchSourceFile(blob);
          setSketchPreviewUrl(objectUrl);
          setSketchError("");
        }
      } catch (error) {
        if (active) setSketchError(error instanceof Error ? error.message : "Impossible de charger l'image source.");
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cloudToken, selectedProductId, selectedProduct]);

  function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSketchSourceFile(file);
    setSketchPreviewUrl(URL.createObjectURL(file));
    setSketchResult(null);
    setSketchError("");
  }

  async function handleGenerateSketch() {
    if (!sketchSourceFile && !sketchPreviewUrl) {
      setSketchError("Veuillez sélectionner ou importer une photo.");
      return;
    }

    setSketchLoading(true);
    setSketchError("");
    setSketchResult(null);

    try {
      let blobToUse = sketchSourceFile;
      if (!blobToUse && sketchPreviewUrl) {
        const resp = await fetch(sketchPreviewUrl);
        blobToUse = await resp.blob();
      }

      if (!blobToUse) throw new Error("Image source introuvable.");

      const res = await generateSketchFromPhoto({
        apiKey: profile.geminiApiKey,
        imageBlobOrFile: blobToUse,
        product: selectedProduct,
      });

      setSketchResult(res);
    } catch (err) {
      setSketchError(err instanceof Error ? err.message : "Erreur lors de la création du croquis.");
    } finally {
      setSketchLoading(false);
    }
  }

  async function handleSaveSketchToProject() {
    if (!sketchResult || !selectedProduct) return;
    const mediaId = crypto.randomUUID();
    await storeMedia(mediaId, sketchResult.blob);
    onAddSketchEntry(selectedProduct.id, mediaId, sketchResult.blob.type);
    setSketchSavedNotice(true);
    setTimeout(() => setSketchSavedNotice(false), 2500);
  }

  // --------------------------------------------------------------------------
  // ÉTAT CHEMIN 2 : FICHES TECHNIQUES & COMMERCIALES
  // --------------------------------------------------------------------------
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState("");

  async function getCoverUrl(product: Product): Promise<string | undefined> {
    const coverEntry = product.entries.find((entry) => entry.kind === "photo" || entry.kind === "sketch"
      || (entry.kind === "file" && entry.mimeType?.startsWith("image/") === true));
    if (!coverEntry?.mediaId) return undefined;
    let blob = await readMedia(coverEntry.mediaId);
    if (!blob && cloudToken) {
      blob = await fetchCloudMedia(cloudToken, product.id, coverEntry.mediaId);
      await storeMedia(coverEntry.mediaId, blob);
    }
    return blob ? URL.createObjectURL(blob) : undefined;
  }

  async function handleGenerateSheets() {
    if (!selectedProduct) {
      setSheetsError("Veuillez sélectionner un projet pour générer ses fiches.");
      return;
    }

    setSheetsLoading(true);
    setSheetsError("");

    try {
      const coverDataUrl = await getCoverUrl(selectedProduct);
      const res = await generateProductDataSheets({
        apiKey: profile.geminiApiKey,
        product: selectedProduct,
        companyName: profile.companyName,
      });

      onOpenDocumentation(selectedProduct, res, coverDataUrl);
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : "Erreur lors de la génération des fiches.");
    } finally {
      setSheetsLoading(false);
    }
  }

  async function handleOpenSavedDocumentation(document: GeneratedDocument) {
    if (!selectedProduct) return;
    setSheetsError("");
    try {
      const coverDataUrl = await getCoverUrl(selectedProduct);
      onOpenSavedDocumentation(selectedProduct, document, coverDataUrl);
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : "Impossible d'ouvrir ce document enregistré.");
    }
  }

  // --------------------------------------------------------------------------
  // ÉTAT CHEMIN 3 : IDÉES DE CRÉATION & FABRICATION
  // --------------------------------------------------------------------------
  const [ideas, setIdeas] = useState<CraftingIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState("");

  async function handleGenerateIdeas() {
    setIdeasLoading(true);
    setIdeasError("");

    try {
      const res = await generateCraftingIdeas({
        apiKey: profile.geminiApiKey,
        product: selectedProduct,
        allProducts: products,
      });
      setIdeas(res);
    } catch (err) {
      setIdeasError(err instanceof Error ? err.message : "Erreur lors de la génération d'idées.");
    } finally {
      setIdeasLoading(false);
    }
  }

  return (
    <div
      className="modal-backdrop ai-studio-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ai-studio-modal">
        {/* EN-TÊTE MODAL */}
        <header className="ai-studio-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              INTELLIGENCE ARTISANALE
            </div>
            <h2>Studio IA MaxLab</h2>
          </div>
          <div className="ai-studio-header-right">
            {!profile.geminiApiKey ? (
              <button className="api-key-warning-pill" onClick={onOpenProfile} title="Configurer votre clé API Gemini">
                <Key size={13} />
                <span>Clé Gemini requise pour l'IA avancée</span>
              </button>
            ) : (
              <span className="api-key-ok-pill" title="Clé Gemini configurée">
                <Check size={13} />
                <span>Gemini connecté</span>
              </span>
            )}
            <button className="modal-close" onClick={onClose} aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* SÉLECTEUR DE PROJET GLOBAL */}
        <div className="ai-studio-project-selector">
          <label>
            <span>Projet de référence :</span>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="ai-project-select"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ONGLETS DES 3 CHEMINS */}
        <nav className="ai-studio-nav" aria-label="Chemins d'intelligence artificielle">
          <button
            className={`ai-nav-item ${activeTab === "sketch" ? "active" : ""}`}
            onClick={() => setActiveTab("sketch")}
          >
            <Sparkles size={16} />
            <div>
              <strong>1. Photo vers Croquis</strong>
              <small>Dessin d'atelier & cotations comme dessin1.jpeg</small>
            </div>
          </button>
          <button
            className={`ai-nav-item ${activeTab === "sheets" ? "active" : ""}`}
            onClick={() => setActiveTab("sheets")}
          >
            <FileText size={16} />
            <div>
              <strong>2. Fiches Tech & Com</strong>
              <small>Fiches atelier et vente avec logo & pied de page</small>
            </div>
          </button>
          <button
            className={`ai-nav-item ${activeTab === "ideas" ? "active" : ""}`}
            onClick={() => setActiveTab("ideas")}
          >
            <Lightbulb size={16} />
            <div>
              <strong>3. Idées de Création</strong>
              <small>Déclinaisons, gammes et valorisation des chutes</small>
            </div>
          </button>
        </nav>

        {/* CONTENU DU CHEMIN SÉLECTIONNÉ */}
        <div className="ai-studio-body">
          {/* ================================================================= */}
          {/* CHEMIN 1 : TRANSFORMER DES PHOTOS EN SKETCHS                     */}
          {/* ================================================================= */}
          {activeTab === "sketch" && (
            <div className="ai-sketch-tab">
              <div className="ai-section-desc">
                Générez avec <strong>Gemini</strong> un croquis technique au crayon graphite à partir d'une photo d'atelier, avec fond texturé et les dimensions connues du projet.
              </div>

              <div className="sketch-mode-toggle" style={{ marginBottom: "12px", fontSize: "13px", color: "#545d50" }}>
                <span>Génération d'image par Gemini · clé API requise</span>
              </div>

              <div className="ai-sketch-layout">
                {/* COLONNE GAUCHE : PHOTO SOURCE */}
                <div className="sketch-preview-box">
                  <div className="box-title">
                    <Camera size={15} /> Photo originale
                  </div>
                  {sketchPreviewUrl ? (
                    <div className="image-frame">
                      <img src={sketchPreviewUrl} alt="Photo source" className="preview-img" />
                    </div>
                  ) : (
                    <div className="empty-box-placeholder" onClick={() => fileInputRef.current?.click()}>
                      <ImagePlus size={32} />
                      <span>Aucune photo sélectionnée</span>
                      <small>Cliquez pour importer une photo</small>
                    </div>
                  )}
                  <div className="box-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={14} /> Importer une autre photo
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="visually-hidden"
                      onChange={handlePhotoSelect}
                    />
                  </div>
                </div>

                {/* COLONNE DROITE : CROQUIS D'ATELIER GÉNÉRÉ */}
                <div className="sketch-preview-box">
                  <div className="box-title">
                    <Sparkles size={15} /> Croquis d'Atelier (Style dessin1.jpeg)
                  </div>
                  {sketchResult ? (
                    <div className="image-frame sketch-frame">
                      <img src={sketchResult.dataUrl} alt="Croquis d'atelier" className="preview-img" />
                      <span className="sketch-badge">
                        ✨ Gemini
                      </span>
                    </div>
                  ) : (
                    <div className="empty-box-placeholder">
                      <Sparkles size={32} />
                      <span>Le croquis s'affichera ici</span>
                      <small>Traits de crayon, texture de papier et cotes métriques</small>
                    </div>
                  )}

                  <div className="box-actions">
                    <button
                      type="button"
                      className="primary-button generate-sketch-btn"
                      onClick={handleGenerateSketch}
                      disabled={sketchLoading || (!sketchSourceFile && !sketchPreviewUrl)}
                    >
                      <Sparkles size={15} className={sketchLoading ? "spin" : ""} />
                      <span>{sketchLoading ? "Transformation en cours…" : "Générer le croquis"}</span>
                    </button>

                    {sketchResult && (
                      <div className="sketch-post-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={handleSaveSketchToProject}
                        >
                          {sketchSavedNotice ? <Check size={14} /> : <Plus size={14} />}
                          <span>{sketchSavedNotice ? "Ajouté au carnet !" : "Enregistrer au projet"}</span>
                        </button>
                        <a
                          href={sketchResult.dataUrl}
                          download={`${selectedProduct?.name || "croquis"}-atelier.jpg`}
                          className="secondary-button download-link"
                        >
                          <Download size={14} /> Télécharger
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {sketchError && <p className="ai-error-message">{sketchError}</p>}
            </div>
          )}

          {/* ================================================================= */}
          {/* CHEMIN 2 : FICHES TECHNIQUES ET COMMERCIALES                      */}
          {/* ================================================================= */}
          {activeTab === "sheets" && (
            <div className="ai-sheets-tab">
              <div className="ai-section-desc">
                Générez automatiquement la <strong>Fiche Technique</strong> (matières, étapes d'usinage, outils, tolérances) et la <strong>Fiche Commerciale</strong> (storytelling, arguments de vente, conseils de présentation) à partir de ce projet.
              </div>

              <div className="sheets-card-preview">
                <div className="sheets-card-header">
                  <div className="sheets-card-logo">
                    {profile.companyLogoUrl ? (
                      <img src={profile.companyLogoUrl} alt="Logo" className="mini-logo" />
                    ) : (
                      <Hammer size={18} />
                    )}
                    <span>{profile.companyName}</span>
                  </div>
                  <span className="sheets-card-tag">DOCUMENTATION PERSONNALISÉE</span>
                </div>

                <div className="sheets-card-body">
                  <h3>{selectedProduct?.name}</h3>
                  <p>
                    Catégorie <strong>{selectedProduct?.category}</strong> · {selectedProduct?.materials || "Matières nobles d'atelier"}
                  </p>
                  <div className="sheets-features-list">
                    <div>✓ En-tête avec votre logo d'entreprise</div>
                    <div>✓ Étapes d'usinage et outillage recommandés</div>
                    <div>✓ Storytelling, argumentaire et conseils de présentation</div>
                    <div>✓ Pied de page personnalisé : {profile.companyInfo.split("\n")[0] || "Coordonnées de l'atelier"}</div>
                  </div>
                </div>

                <div className="sheets-card-footer">
                  <button
                    className="primary-button generate-doc-btn"
                    onClick={handleGenerateSheets}
                    disabled={sheetsLoading}
                  >
                    <FileText size={16} className={sheetsLoading ? "spin" : ""} />
                    <span>{sheetsLoading ? "Rédaction par l'IA en cours…" : "Générer & Voir la Documentation"}</span>
                  </button>
                </div>
              </div>

              <section className="saved-documents">
                <div className="saved-documents-heading">
                  <div>
                    <h3>Documents enregistrés</h3>
                    <p>{selectedProduct?.generatedDocuments?.length ?? 0} fiche(s) conservée(s) dans ce projet</p>
                  </div>
                  <FileText size={17} />
                </div>
                {selectedProduct?.generatedDocuments?.length ? (
                  <ul className="saved-documents-list">
                    {[...selectedProduct.generatedDocuments]
                      .sort((first, second) => Date.parse(second.dataSheets.generatedAt) - Date.parse(first.dataSheets.generatedAt))
                      .map((document) => (
                        <li key={document.id}>
                          <span>
                            <strong>{document.dataSheets.technical.title}</strong>
                            <small>
                              Réf. {document.dataSheets.technical.reference} · {new Date(document.dataSheets.generatedAt).toLocaleString("fr-FR")}
                            </small>
                          </span>
                          <button className="secondary-button" onClick={() => void handleOpenSavedDocumentation(document)}>
                            <FileText size={14} /> Ouvrir
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="saved-documents-empty">Les fiches créées pour ce projet apparaîtront ici.</p>
                )}
              </section>

              {sheetsError && <p className="ai-error-message">{sheetsError}</p>}
            </div>
          )}

          {/* ================================================================= */}
          {/* CHEMIN 3 : IDÉES DE CRÉATION & FABRICATION                        */}
          {/* ================================================================= */}
          {activeTab === "ideas" && (
            <div className="ai-ideas-tab">
              <div className="ai-section-desc">
                Explorez des <strong>déclinaisons</strong>, des <strong>objets complémentaires</strong> de gamme, des astuces pour <strong>valoriser vos chutes de matière</strong>, et des <strong>gabarits d'atelier</strong>.
              </div>

              <div className="ideas-top-action">
                <button
                  className="primary-button"
                  onClick={handleGenerateIdeas}
                  disabled={ideasLoading}
                >
                  <RefreshCw size={15} className={ideasLoading ? "spin" : ""} />
                  <span>{ideasLoading ? "Recherche d'idées en cours…" : "Proposer des idées pour ce projet"}</span>
                </button>
              </div>

              {ideasError && <p className="ai-error-message">{ideasError}</p>}

              <div className="ideas-grid">
                {ideas.map((idea) => (
                  <div key={idea.id} className="idea-card">
                    <div className="idea-card-header">
                      <span className={`idea-type-badge type-${idea.type}`}>{idea.typeLabel}</span>
                      <small className="idea-duration">⏱ {idea.estimatedDuration}</small>
                    </div>
                    <h4>{idea.title}</h4>
                    <p className="idea-desc">{idea.description}</p>

                    <div className="idea-meta">
                      <div>
                        <strong>Matières :</strong> <span>{idea.materialsNeeded}</span>
                      </div>
                      <div>
                        <strong>Difficulté :</strong> <span className="difficulty-tag">{idea.difficulty}</span>
                      </div>
                    </div>

                    <div className="idea-tips">
                      <strong>Astuces d'atelier :</strong>
                      <ul>
                        {idea.craftingTips.map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>

                    <button
                      className="secondary-button create-from-idea-btn"
                      onClick={() => onCreateProductFromIdea(idea)}
                    >
                      <Plus size={14} />
                      <span>Créer cette fiche au carnet</span>
                    </button>
                  </div>
                ))}

                {ideas.length === 0 && !ideasLoading && (
                  <div className="empty-ideas-placeholder">
                    <Lightbulb size={36} />
                    <p>Cliquez sur le bouton ci-dessus pour générer 4 pistes créatives et techniques adaptées à votre création.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
