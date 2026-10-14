import { useState } from "react";
import { Check, Eye, EyeOff, Key, Sparkles, Trash2, Upload, X } from "lucide-react";
import { defaultProfileSettings, saveProfileSettings, testGeminiApiKey } from "./profile";
import type { ProfileSettings } from "./profile";

type ProfileModalProps = {
  settings: ProfileSettings;
  onSave: (settings: ProfileSettings) => void | Promise<void>;
  onClose: () => void;
};

export function ProfileModal({ settings, onSave, onClose }: ProfileModalProps) {
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [showKey, setShowKey] = useState(false);
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [companyLogoUrl, setCompanyLogoUrl] = useState(settings.companyLogoUrl);
  const [companyInfo, setCompanyInfo] = useState(settings.companyInfo);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleTestKey() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testGeminiApiKey(apiKey);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Le logo ne doit pas dépasser 5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCompanyLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    const newSettings: ProfileSettings = {
      geminiApiKey: apiKey.trim(),
      companyName: companyName.trim() || defaultProfileSettings.companyName,
      companyLogoUrl,
      companyInfo,
    };
    try {
      saveProfileSettings(newSettings);
      await onSave(newSettings);
      setSavedNotice(true);
      setTimeout(() => {
        setSavedNotice(false);
        onClose();
      }, 600);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Impossible de synchroniser les réglages du compte.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="profile-modal" onSubmit={handleSubmit}>
        <div className="modal-topline">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              CONFIGURATION & ATELIER
            </div>
            <h2>Profil & Intelligence Artificielle</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            <X size={19} />
          </button>
        </div>

        <p className="profile-modal-desc">
          Configurez votre clé API Google Gemini pour activer la génération de croquis, les fiches techniques et les idées d'atelier. Personnalisez votre logo et vos informations de pied de page pour toutes vos documentations.
        </p>

        {/* SECTION 1 : CLÉ API GEMINI */}
        <fieldset className="profile-section">
          <legend>
            <Key size={15} /> Clé API Google Gemini
          </legend>
          <div className="profile-input-group">
            <div className="api-key-wrapper">
              <input
                type={showKey ? "text" : "password"}
                placeholder="Ex. AIzaSy..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                className="profile-input api-key-input"
              />
              <button
                type="button"
                className="icon-button key-toggle"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? "Masquer la clé" : "Afficher la clé"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="button"
              className="secondary-button test-key-button"
              onClick={handleTestKey}
              disabled={testing || !apiKey.trim()}
            >
              <Sparkles size={14} />
              <span>{testing ? "Test en cours…" : "Tester la clé"}</span>
            </button>
          </div>

          {testResult && (
            <p className={`profile-test-result ${testResult.ok ? "success" : "error"}`}>
              {testResult.ok ? <Check size={14} /> : <X size={14} />}
              <span>{testResult.message}</span>
            </p>
          )}

          <p className="profile-hint">
            Obtenez votre clé gratuitement en quelques secondes sur{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
              Google AI Studio (aistudio.google.com)
            </a>
            . La clé est synchronisée sur votre compte Google pour être disponible sur vos appareils.
          </p>
        </fieldset>

        {saveError && <p className="profile-test-result error" role="alert">{saveError}</p>}

        {/* SECTION 2 : LOGO DE LA SOCIÉTÉ */}
        <fieldset className="profile-section">
          <legend>
            <Upload size={15} /> Logo de la société / atelier
          </legend>
          <div className="logo-upload-container">
            {companyLogoUrl ? (
              <div className="logo-preview-box">
                <img src={companyLogoUrl} alt="Logo de l'entreprise" className="company-logo-preview" />
                <button
                  type="button"
                  className="icon-button remove-logo-button"
                  onClick={() => setCompanyLogoUrl("")}
                  title="Supprimer le logo"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <label className="logo-dropzone">
                <Upload size={22} />
                <span>Charger un logo (PNG, JPG, SVG, WebP)</span>
                <small>Affiché en en-tête des fiches techniques et commerciales</small>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={handleLogoUpload} className="visually-hidden" />
              </label>
            )}
          </div>
        </fieldset>

        {/* SECTION 3 : INFORMATIONS PIED DE PAGE */}
        <fieldset className="profile-section">
          <legend>
            Nom de l'atelier & informations de bas de page
          </legend>
          <label className="profile-field-label">
            <span>Nom de l'atelier / société</span>
            <input
              type="text"
              value={companyName}
              placeholder="Ex. MaxLab Atelier"
              onChange={(e) => setCompanyName(e.target.value)}
              className="profile-input"
            />
          </label>

          <label className="profile-field-label">
            <span>Informations de l'entreprise en bas de page (Pied de page)</span>
            <textarea
              rows={4}
              value={companyInfo}
              placeholder="Coordonnées, adresse, SIRET, téléphone, email, mentions légales..."
              onChange={(e) => setCompanyInfo(e.target.value)}
              className="profile-textarea"
            />
          </label>
          <small className="profile-hint">
            Ce texte apparaîtra dans le pied de page de chaque fiche technique et commerciale imprimée ou exportée.
          </small>
        </fieldset>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {savedNotice ? <Check size={16} /> : null}
            <span>{saving ? "Synchronisation…" : savedNotice ? "Enregistré !" : "Enregistrer les réglages"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
