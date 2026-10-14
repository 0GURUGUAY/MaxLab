import { useState } from "react";
import { Copy, Download, FileText, Hammer, Printer, Sparkles, X } from "lucide-react";
import type { DataSheetsResult } from "./ai";
import type { ProfileSettings } from "./profile";
import type { Product } from "./types";

type DocumentationModalProps = {
  product: Product;
  dataSheets: DataSheetsResult;
  profile: ProfileSettings;
  coverImageSrc?: string;
  onClose: () => void;
  onAddToProject: (text: string) => void;
};

export function DocumentationModal({
  product,
  dataSheets,
  profile,
  coverImageSrc,
  onClose,
  onAddToProject,
}: DocumentationModalProps) {
  const [activeTab, setActiveTab] = useState<"technical" | "commercial" | "both">("both");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const { technical, commercial } = dataSheets;

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    const paper = document.getElementById("printable-sheet");
    if (!paper) {
      setPdfError("Le document à exporter est introuvable.");
      return;
    }
    setPdfBusy(true);
    setPdfError("");
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      await document.fonts.ready;
      await Promise.all(Array.from(paper.querySelectorAll("img"), (image) => image.decode()));
      const filename = `${product.name.trim().replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "documentation"}-${activeTab}.pdf`;
      await html2pdf().set({
        filename,
        margin: [8, 8, 8, 8],
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#fffefa",
          scrollY: 0,
          onclone: (clonedDocument: Document) => {
            const clonedPaper = clonedDocument.getElementById("printable-sheet");
            if (clonedPaper) {
              clonedPaper.style.width = "190mm";
              clonedPaper.style.height = "auto";
              clonedPaper.style.maxHeight = "none";
              clonedPaper.style.overflow = "visible";
              clonedPaper.style.padding = "8mm";
              clonedPaper.style.boxSizing = "border-box";
            }
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(paper).save();
    } catch (error) {
      setPdfError(error instanceof Error ? `Impossible de générer le PDF : ${error.message}` : "Impossible de générer le PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  function handleCopy() {
    const markdown = `# ${product.name}
**Société :** ${profile.companyName}
**Référence :** ${technical.reference}
**Date :** ${new Date(dataSheets.generatedAt).toLocaleDateString("fr-FR")}

---
## FICHE TECHNIQUE
- **Dimensions :** ${technical.dimensions}
- **Catégorie :** ${technical.category}

### Matières :
${technical.materials.map((m) => `- ${m.name} : ${m.specs}`).join("\n")}

### Étapes de fabrication :
${technical.fabricationSteps.map((s) => `${s.step}. **${s.title}** (${s.duration || ""}) : ${s.description}`).join("\n")}

### Outils :
${technical.toolsRequired.join(", ")}

### Finitions & Entretien :
${technical.finishingAndCare}

---
## FICHE COMMERCIALE
**Titre :** ${commercial.title}
*${commercial.tagline}*

### Histoire & Démarche :
${commercial.storytelling}

### Arguments Clés :
${commercial.keyArguments.map((a) => `- ${a}`).join("\n")}

### Conseils de présentation :
${commercial.presentationTips}
### Public visé :
${commercial.targetAudience}
### Argumentaire :
${commercial.salesPitch}

---
${profile.companyInfo}`;

    void navigator.clipboard.writeText(markdown).then(() => {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    }).catch((error: unknown) => {
      setPdfError(error instanceof Error ? `Impossible de copier le document : ${error.message}` : "Impossible de copier le document.");
    });
  }

  function handleSaveToJournal() {
    const summary = `📋 Documentation générée (${technical.reference}) :
• Dimensions : ${technical.dimensions}
• ${commercial.keyArguments.slice(0, 2).join(" · ")}`;
    onAddToProject(summary);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2000);
  }

  return (
    <div
      className="modal-backdrop doc-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="doc-modal-container">
        {/* BARRE D'ACTIONS DU HAUT (non imprimée) */}
        <header className="doc-toolbar no-print">
          <div className="doc-tabs">
            <button
              className={`doc-tab-button ${activeTab === "both" ? "active" : ""}`}
              onClick={() => setActiveTab("both")}
            >
              Vue Complète
            </button>
            <button
              className={`doc-tab-button ${activeTab === "technical" ? "active" : ""}`}
              onClick={() => setActiveTab("technical")}
            >
              Fiche Technique
            </button>
            <button
              className={`doc-tab-button ${activeTab === "commercial" ? "active" : ""}`}
              onClick={() => setActiveTab("commercial")}
            >
              Fiche Commerciale
            </button>
          </div>
          <div className="doc-toolbar-actions">
            <button className="secondary-button" onClick={handleCopy} title="Copier le contenu">
              <Copy size={15} />
              <span>{copiedNotice ? "Copié !" : "Copier"}</span>
            </button>
            <button className="secondary-button" onClick={handleSaveToJournal} title="Ajouter une note au carnet">
              <FileText size={15} />
              <span>{addedNotice ? "Ajouté !" : "Au journal"}</span>
            </button>
            <button className="primary-button print-button" onClick={() => void handleDownloadPdf()} disabled={pdfBusy} aria-busy={pdfBusy}>
              <Download size={15} />
              <span>{pdfBusy ? "Génération du PDF…" : "Télécharger le PDF"}</span>
            </button>
            <button className="secondary-button" onClick={handlePrint} title="Ouvrir la boîte de dialogue d'impression">
              <Printer size={15} />
              <span>Imprimer</span>
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
        </header>
        {pdfError && <p className="pdf-error no-print" role="alert">{pdfError}</p>}

        {/* DOCUMENT IMPRIMABLE (style A4 soigné) */}
        <div className="doc-paper" id="printable-sheet">
          {/* EN-TÊTE DU DOCUMENT AVEC LOGO DE LA SOCIÉTÉ */}
          <div className="doc-header">
            <div className="doc-header-brand">
              {profile.companyLogoUrl ? (
                <img src={profile.companyLogoUrl} alt={profile.companyName} className="doc-company-logo" />
              ) : (
                <div className="doc-logo-placeholder">
                  <Hammer size={24} />
                  <span>{profile.companyName}</span>
                </div>
              )}
            </div>
            <div className="doc-header-meta">
              <div className="doc-badge">DOCUMENTATION D'ATELIER</div>
              <h2>{product.name}</h2>
              <p className="doc-ref">
                RÉF. <strong>{technical.reference}</strong> · ÉDITÉ LE{" "}
                {new Date(dataSheets.generatedAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>

          <div className="doc-visual-banner">
            {coverImageSrc && (
              <div className="doc-product-image-frame">
                <img src={coverImageSrc} alt={product.name} className="doc-product-image" />
              </div>
            )}
            <div className="doc-quick-specs">
              <div className="spec-item">
                <span className="spec-label">DIMENSIONS</span>
                <strong>{technical.dimensions}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">CATÉGORIE</span>
                <strong>{technical.category}</strong>
              </div>
            </div>
          </div>

          {/* FICHE TECHNIQUE */}
          {(activeTab === "technical" || activeTab === "both") && (
            <section className="doc-section doc-technical-section">
              <div className="doc-section-title">
                <span className="doc-section-number">01</span>
                <h3>FICHE TECHNIQUE & FABRICATION</h3>
              </div>

              <div className="doc-two-cols">
                <div className="doc-col">
                  <h4>Matières & Composants</h4>
                  <ul className="doc-materials-list">
                    {technical.materials.map((mat, idx) => (
                      <li key={idx}>
                        <strong>{mat.name}</strong> : <span>{mat.specs}</span>
                      </li>
                    ))}
                  </ul>

                  <h4>Outils & Machines</h4>
                  <div className="doc-tags-wrap">
                    {technical.toolsRequired.map((tool, idx) => (
                      <span key={idx} className="doc-tag">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="doc-col">
                  <h4>Points de Vigilance Qualité</h4>
                  <ul className="doc-check-list">
                    {technical.qualityPoints.map((pt, idx) => (
                      <li key={idx}>
                        <span className="doc-check-icon">✓</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>

                  <h4>Finition & Entretien</h4>
                  <p className="doc-text-block">{technical.finishingAndCare}</p>
                </div>
              </div>

              <h4>Étapes de fabrication</h4>
              <div className="doc-steps-grid">
                {technical.fabricationSteps.map((step) => (
                  <div key={step.step} className="doc-step-card">
                    <div className="doc-step-num">Étape {step.step}</div>
                    <h5>{step.title}</h5>
                    <p>{step.description}</p>
                    {step.duration && <small className="doc-step-time">⏱ {step.duration}</small>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FICHE COMMERCIALE */}
          {(activeTab === "commercial" || activeTab === "both") && (
            <section className="doc-section doc-commercial-section">
              <div className="doc-section-title">
                <span className="doc-section-number">02</span>
                <h3>FICHE COMMERCIALE & VALORISATION</h3>
              </div>

              <div className="doc-commercial-hero">
                <h4>{commercial.title}</h4>
                <p className="doc-tagline">« {commercial.tagline} »</p>
              </div>

              <div className="doc-two-cols">
                <div className="doc-col">
                  <h4>Histoire & Démarche d'Atelier</h4>
                  <p className="doc-text-block doc-storytelling">{commercial.storytelling}</p>

                  <h4>Arguments de Vente Clés</h4>
                  <ul className="doc-arguments-list">
                    {commercial.keyArguments.map((arg, idx) => (
                      <li key={idx}>
                        <Sparkles size={13} className="sparkle-bullet" />
                        <span>{arg}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="doc-col">
                  <h4>Public & Occasions d'Usage</h4>
                  <p className="doc-text-block">{commercial.targetAudience}</p>

                  <h4>Conseils de Présentation</h4>
                  <p className="doc-text-block">{commercial.presentationTips}</p>

                  <h4>Pitch Commercial</h4>
                  <blockquote className="doc-pitch-quote">{commercial.salesPitch}</blockquote>
                </div>
              </div>
            </section>
          )}

          {/* PIED DE PAGE AVEC INFORMATIONS DE LA SOCIÉTÉ (TEXTEDIT) */}
          <footer className="doc-footer">
            <div className="doc-footer-divider" />
            <div className="doc-footer-content">
              <div className="doc-footer-company">
                <strong>{profile.companyName}</strong>
                <pre className="doc-footer-text">{profile.companyInfo}</pre>
              </div>
              <div className="doc-footer-stamp">
                <div className="doc-stamp-box">
                  <span>ATELIER</span>
                  <strong>CERTIFIÉ</strong>
                  <span>FAIT MAIN</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
