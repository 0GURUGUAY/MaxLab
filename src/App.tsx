import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Cloud,
  FilePlus2,
  Hammer,
  ImagePlus,
  Leaf,
  LogOut,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { addEntry, categoryLabels, collectEquipmentOptions, createProduct, EntryWorkDetails, formatDate, formatDurationMinutes, insertEntry, isStarterProduct, mergeProductVersions, moveEntry, statusLabels, summarizeEntryWork, updateNoteEntry } from "./catalog";
import { clearDeletedProductId, clearPendingSync, deleteMedia, hasStoredProducts, loadDeletedProductIds, loadPendingSyncTags, loadProducts, markPendingSync, markProductDeleted, readMedia, saveProducts, storeMedia } from "./storage";
import { deleteCloudProduct, fetchCloudMedia, listCloudProducts, putCloudMedia, verifyCloudSession, writeCloudProduct, GOOGLE_CLIENT_ID } from "./cloud";
import { compressPhoto } from "./image";
import { loadProfileSettings } from "./profile";
import type { ProfileSettings } from "./profile";
import { ProfileModal } from "./ProfileModal";
import { AiStudioModal } from "./AiStudioModal";
import { DocumentationModal } from "./DocumentationModal";
import type { CraftingIdea, DataSheetsResult } from "./ai";
import type { CloudIdentity } from "./cloud";
import type { EntryWorkMethod, GeneratedDocument, Product, ProductCategory, ProductStatus, WorkshopEntry } from "./types";

type SpeechAlternative = { transcript: string };
type SpeechResult = { 0: SpeechAlternative; isFinal: boolean };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognitionLike = {
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function LoginScreen({
  busy,
  notice,
  noticeError,
  onGoogleSuccess,
  onGoogleError,
  onNativeSignIn,
}: {
  busy: boolean;
  notice: string;
  noticeError: boolean;
  onGoogleSuccess: (credential?: string) => void;
  onGoogleError: () => void;
  onNativeSignIn: () => void;
}) {
  return (
    <main className="login-page">
      <section className="login-showcase">
        <a className="login-brand" href="#" aria-label="MaxLab accueil">
          <span className="login-brand-mark"><Hammer size={19} /></span>
          <span>max<span>lab</span></span>
        </a>
        <div className="login-showcase-copy">
          <span className="login-eyebrow"><i />LE CARNET DES GENS QUI FONT</span>
          <h1>Une idée prend vie<br />quand on la <em>façonne.</em></h1>
          <p>Gardez vos idées, vos gestes et chaque étape de vos créations au même endroit.</p>
        </div>
        <div className="login-studio-card" aria-hidden="true">
          <div className="studio-sun" />
          <div className="studio-plant"><span /><i /><b /></div>
          <div className="studio-workbench"><span /><i /><b /></div>
          <div className="studio-tools"><span /><i /><b /></div>
          <div className="studio-caption"><span>FAIT MAIN · FAIT AVEC SOIN</span><Hammer size={15} /></div>
        </div>
        <span className="login-showcase-foot">VOTRE ATELIER, À PORTÉE DE MAIN</span>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-mark"><Leaf size={21} /></div>
          <span className="login-card-overline">BIENVENUE CHEZ MAXLAB</span>
          <h2>Votre atelier<br />vous attend.</h2>
          <p>Connectez-vous pour retrouver votre carnet et continuer là où vos mains se sont arrêtées.</p>
          <div className="login-action">
            {Capacitor.isNativePlatform()
              ? <button className="login-native-button" onClick={onNativeSignIn} disabled={busy}>
                <GoogleIcon size={19} /><span>{busy ? "Connexion en cours…" : "Continuer avec Google"}</span>
              </button>
              : <div className="login-google-button">
                <GoogleLogin onSuccess={(response) => onGoogleSuccess(response.credential)} onError={onGoogleError} text="continue_with" shape="rectangular" size="large" />
              </div>}
          </div>
          {busy && <p className="login-progress" role="status">Préparation de votre carnet…</p>}
          {notice && <p className={`login-notice ${noticeError ? "error" : ""}`} role={noticeError ? "alert" : "status"}>{notice}</p>}
          <div className="login-divider"><span>VOTRE ESPACE, EN SÉCURITÉ</span></div>
          <p className="login-privacy"><span><Check size={13} /></span>Vos créations restent privées et synchronisées sur vos appareils.</p>
        </div>
        <footer className="login-panel-footer"><span>MAXLAB <i>·</i> LE CARNET D'ATELIER</span><span>IMAGINER. FABRIQUER. SE SOUVENIR.</span></footer>
      </section>
    </main>
  );
}

const categoryFilters: Array<ProductCategory | "all"> = ["all", "bois", "cuir", "tissu", "photos"];
const productCategories: ProductCategory[] = ["bois", "cuir", "tissu", "photos"];
const blankForm = { name: "", category: "bois" as ProductCategory, subcategory: "", materials: "", dimensions: "" };

function ProductImage({
  entry,
  productId,
  cloudToken,
  className = "",
}: {
  entry: WorkshopEntry;
  productId: string;
  cloudToken: string;
  className?: string;
}) {
  const [url, setUrl] = useState(entry.mediaPath ?? "");
  const [loadError, setLoadError] = useState("");
  const imageRef = useRef<HTMLImageElement | HTMLDivElement>(null);

  useEffect(() => {
    const mediaId = entry.mediaId;
    if (entry.mediaPath || !mediaId) {
      setUrl(entry.mediaPath ?? "");
      setLoadError("");
      return;
    }
    let objectUrl = "";
    let active = true;
    let requested = false;
    setUrl("");
    setLoadError("");
    const load = async () => {
      if (requested) return;
      requested = true;
      try {
        let blob = await readMedia(mediaId);
        if (!blob && cloudToken) {
          blob = await fetchCloudMedia(cloudToken, productId, mediaId);
          await storeMedia(mediaId, blob);
        }
        if (!active) return;
        if (!blob) {
          setLoadError("Photo indisponible sur cet appareil.");
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Impossible de charger la photo.");
        }
      }
    };

    const element = imageRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      void load();
    } else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((visible) => visible.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      }, { rootMargin: "250px" });
      observer.observe(element);
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cloudToken, entry.mediaId, entry.mediaPath, productId]);

  return url
    ? <img ref={(element) => { imageRef.current = element; }} className={className} src={url} alt={entry.text || "Photo du projet"} loading="lazy" decoding="async" />
    : <div ref={imageRef} className={`${className} media-placeholder`} role={loadError ? "status" : undefined} title={loadError || undefined}><ImagePlus size={22} />{loadError && <span>{loadError}</span>}</div>;
}

function ProductCard({ product, cloudToken, pendingSync, onOpen }: { product: Product; cloudToken: string; pendingSync: boolean; onOpen: () => void }) {
  const cover = product.entries.find((entry) => entry.kind === "photo" || entry.kind === "sketch");
  const photos = product.entries.filter((entry) => entry.kind === "photo" || entry.kind === "sketch").length;
  return (
    <button className="product-card" onClick={onOpen}>
      <div className="product-cover">
        {cover ? <ProductImage entry={cover} productId={product.id} cloudToken={cloudToken} className="cover-image" /> : <div className={`cover-placeholder cover-${product.category}`}><Hammer size={31} strokeWidth={1.35} /><span>Pas encore de photo</span></div>}
        <span className={`status-pill status-${product.status}`}><i />{statusLabels[product.status]}</span>
        {pendingSync && <span className="sync-pending-pill">À synchroniser</span>}
        <span className="cover-open"><ArrowUpRight size={17} /></span>
      </div>
      <div className="product-card-content">
        <div className="product-card-top">
          <span className="category-name">{categoryLabels[product.category]} <span>/</span> {product.subcategory || "Sans sous-catégorie"}</span>
          <MoreHorizontal size={19} />
        </div>
        <h3>{product.name}</h3>
        <p className="product-summary">{product.materials || product.description || "Ajouter les détails de cette création…"}</p>
        <div className="product-card-footer">
          <span><ImagePlus size={14} />{photos} {photos > 1 ? "images" : "image"}</span>
          <span><Clock3 size={13} />{formatDate(product.updatedAt, { day: "numeric", month: "short" })}</span>
        </div>
      </div>
    </button>
  );
}

type NoteWorkDraft = {
  hours: string;
  minutes: string;
  method: EntryWorkMethod;
  machineName: string;
  toolNames: string[];
  toolDraft: string;
};

const blankNoteWorkDraft: NoteWorkDraft = { hours: "", minutes: "", method: "manual", machineName: "", toolNames: [], toolDraft: "" };

function noteWorkDraft(entry?: WorkshopEntry): NoteWorkDraft {
  const durationMinutes = entry?.durationMinutes ?? 0;
  return {
    hours: durationMinutes ? String(Math.floor(durationMinutes / 60)) : "",
    minutes: durationMinutes ? String(durationMinutes % 60) : "",
    method: entry?.workMethod ?? "manual",
    machineName: entry?.machineName ?? "",
    toolNames: entry?.toolNames ? [...entry.toolNames] : [],
    toolDraft: "",
  };
}

function entryWorkDetails(draft: NoteWorkDraft): EntryWorkDetails {
  const durationMinutes = (Number(draft.hours) || 0) * 60 + (Number(draft.minutes) || 0);
  const toolNames = [...new Map([...draft.toolNames, draft.toolDraft]
    .map((tool) => tool.trim())
    .filter(Boolean)
    .map((tool) => [tool.toLocaleLowerCase("fr"), tool])).values()];
  if (!durationMinutes) return toolNames.length ? { toolNames } : {};
  return {
    durationMinutes,
    workMethod: draft.method,
    ...(draft.method === "machine" && draft.machineName.trim()
      ? { machineName: draft.machineName.trim() }
      : {}),
    ...(toolNames.length ? { toolNames } : {}),
  };
}

function NoteWorkFields({ value, onChange, machineSuggestions, toolSuggestions }: {
  value: NoteWorkDraft;
  onChange: (value: NoteWorkDraft) => void;
  machineSuggestions: string[];
  toolSuggestions: string[];
}) {
  const id = useId();
  const hasDuration = (Number(value.hours) || 0) * 60 + (Number(value.minutes) || 0) > 0;
  function addTool() {
    const tool = value.toolDraft.trim();
    if (!tool) return;
    const exists = value.toolNames.some((saved) => saved.toLocaleLowerCase("fr") === tool.toLocaleLowerCase("fr"));
    onChange({
      ...value,
      toolNames: exists ? value.toolNames : [...value.toolNames, tool],
      toolDraft: "",
    });
  }
  return (
    <div className="note-work-fields">
      <label className="note-work-duration">
        <span>Temps passé</span>
        <span className="note-work-inputs">
          <input type="number" min="0" step="1" inputMode="numeric" value={value.hours} onChange={(event) => onChange({ ...value, hours: event.target.value })} aria-label="Heures passées" />
          <span>h</span>
          <input type="number" min="0" max="59" step="1" inputMode="numeric" value={value.minutes} onChange={(event) => onChange({ ...value, minutes: event.target.value })} aria-label="Minutes passées" />
          <span>min</span>
        </span>
      </label>
      <label className="note-work-method">
        <span>Type de travail</span>
        <select value={value.method} onChange={(event) => onChange({ ...value, method: event.target.value as EntryWorkMethod })}>
          <option value="manual">Manuel</option>
          <option value="machine">Machine</option>
        </select>
      </label>
      {value.method === "machine" && (
        <label className="note-work-machine">
          <span>Machine utilisée</span>
            <input value={value.machineName} maxLength={120} required={hasDuration} list={`${id}-machine-options`} placeholder="Ex. tour à bois" onChange={(event) => onChange({ ...value, machineName: event.target.value })} />
            <datalist id={`${id}-machine-options`}>{machineSuggestions.map((machine) => <option value={machine} key={machine} />)}</datalist>
          </label>
      )}
      <div className="note-work-tools">
          <label htmlFor={`${id}-tool-input`}>Outils utilisés</label>
          <div className="note-tool-entry">
            <input
              id={`${id}-tool-input`}
              value={value.toolDraft}
              maxLength={120}
              list={`${id}-tool-options`}
              placeholder="Choisir ou saisir un outil"
              onChange={(event) => onChange({ ...value, toolDraft: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTool();
                }
              }}
            />
            <datalist id={`${id}-tool-options`}>{toolSuggestions.map((tool) => <option value={tool} key={tool} />)}</datalist>
            <button type="button" className="note-tool-add" onClick={addTool} disabled={!value.toolDraft.trim()}><Plus size={13} />Ajouter</button>
          </div>
          {value.toolNames.length > 0 && (
            <div className="note-tool-list">
              {value.toolNames.map((tool) => (
                <span className="note-tool-chip" key={tool}>
                  {tool}
                  <button type="button" onClick={() => onChange({ ...value, toolNames: value.toolNames.filter((saved) => saved !== tool) })} aria-label={`Retirer l'outil ${tool}`}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

function ProductDetails({
  product,
  cloudToken,
  machineSuggestions,
  toolSuggestions,
  onClose,
  onUpdate,
  onEntry,
  onEditEntry,
  onMoveEntry,
  onUpload,
  onDelete,
  onOpenAiStudio,
}: {
  product: Product;
  cloudToken: string;
  machineSuggestions: string[];
  toolSuggestions: string[];
  onClose: () => void;
  onUpdate: (changes: Partial<Product>) => void;
  onEntry: (text: string, workDetails: EntryWorkDetails, index?: number) => void;
  onEditEntry: (entryId: string, text: string, workDetails: EntryWorkDetails) => void;
  onMoveEntry: (fromIndex: number, toIndex: number) => void;
  onUpload: (file: File, kind: "photo" | "file", index?: number) => Promise<void>;
  onDelete: () => void;
  onOpenAiStudio: (tab: "sketch" | "sheets" | "ideas") => void;
}) {
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  const [insertDraft, setInsertDraft] = useState("");
  const [draftWork, setDraftWork] = useState(blankNoteWorkDraft);
  const [insertWork, setInsertWork] = useState(blankNoteWorkDraft);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editWork, setEditWork] = useState(blankNoteWorkDraft);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const insertAtRef = useRef<number | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const imageEntries = product.entries.filter((entry) => entry.kind === "photo" || entry.kind === "sketch");
  const workSummary = summarizeEntryWork(product.entries);

  function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    onEntry(draft.trim(), entryWorkDetails(draftWork));
    setDraft("");
    setDraftWork(blankNoteWorkDraft);
  }

  function toggleDictation() {
    if (recording) {
      speechRef.current?.stop();
      setRecording(false);
      return;
    }
    const SpeechRecognition = (window as WindowWithSpeech).SpeechRecognition ?? (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice("La dictée n'est pas prise en charge par ce navigateur. Vous pouvez saisir votre note au clavier.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onresult = (event) => {
      const text = Array.from({ length: event.results.length }, (_, index) => event.results[index][0].transcript).join(" ");
      setDraft((current) => `${current}${current ? " " : ""}${text}`.trim());
    };
    recognition.onerror = () => {
      setNotice("La dictée n'a pas pu démarrer. Vérifiez l'autorisation du microphone.");
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    speechRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de démarrer la dictée.");
    }
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>, kind: "photo" | "file") {
    const file = event.target.files?.[0];
    const insertionIndex = insertAtRef.current;
    insertAtRef.current = null;
    event.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setNotice("Le fichier dépasse la limite de 20 Mo.");
      return;
    }
    try {
      await onUpload(file, kind, insertionIndex ?? undefined);
      if (insertionIndex !== null) setInsertPosition(null);
      setNotice(kind === "photo" ? "Photo ajoutée au carnet." : "Fichier ajouté au carnet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible d'enregistrer le fichier.");
    }
  }

  function addInsertedNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (insertPosition === null || !insertDraft.trim()) return;
    onEntry(insertDraft.trim(), entryWorkDetails(insertWork), insertPosition);
    setInsertDraft("");
    setInsertWork(blankNoteWorkDraft);
    setInsertPosition(null);
  }

  function saveEditedNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingNoteId || !editDraft.trim()) return;
    onEditEntry(editingNoteId, editDraft.trim(), entryWorkDetails(editWork));
    setEditingNoteId(null);
    setEditDraft("");
    setEditWork(blankNoteWorkDraft);
  }

  function cancelEditingNote() {
    setEditingNoteId(null);
    setEditDraft("");
    setEditWork(blankNoteWorkDraft);
  }

  function openPhotoPickerAt(index: number) {
    insertAtRef.current = index;
    galleryRef.current?.click();
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="detail-drawer" role="dialog" aria-modal="true" aria-label={`Détails de ${product.name}`}>
        <header className="drawer-header">
          <button className="back-button" onClick={onClose} aria-label="Fermer les détails"><ArrowLeft size={19} /><span>Atelier</span></button>
          <span className="local-status"><i />Enregistré sur cet appareil</span>
          <button className="icon-button" onClick={onDelete} aria-label="Supprimer ce projet"><MoreHorizontal size={21} /></button>
        </header>
        <div className="drawer-body">
          <div className="detail-main">
            <div className="detail-heading">
              <div className="eyebrow"><span className="eyebrow-line" />CARNET DE FABRICATION</div>
              <select className={`status-select status-${product.status}`} value={product.status} aria-label="État du projet" onChange={(event) => onUpdate({ status: event.target.value as ProductStatus })}>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input className="detail-title-input" value={product.name} onChange={(event) => onUpdate({ name: event.target.value })} aria-label="Nom du projet" />
              <p className="detail-subtitle">{categoryLabels[product.category]}{product.subcategory ? ` · ${product.subcategory}` : ""} <span>—</span> commencé le {formatDate(product.createdAt)}</p>
            </div>

            <div className="detail-photo-grid">
              {imageEntries.slice(0, 2).map((entry, index) => (
                <div key={entry.id} className={`detail-photo ${index === 0 ? "photo-large" : ""}`}>
                  <ProductImage entry={entry} productId={product.id} cloudToken={cloudToken} className="detail-photo-image" />
                  <span className={`photo-label ${entry.kind === "sketch" ? "sketch-label" : ""}`}>{entry.kind === "sketch" ? <><Sparkles size={12} /> CROQUIS</> : <><Camera size={12} /> ATELIER</>}</span>
                </div>
              ))}
              {imageEntries.length === 0 && <div className="photo-empty"><ImagePlus size={26} /><span>Votre première photo donnera vie à ce carnet.</span></div>}
              <button className="add-photo-tile" onClick={() => cameraRef.current?.click()}><span className="add-photo-icon"><Plus size={18} /></span><span>Ajouter une photo</span></button>
            </div>

            <section className="workshop-details">
              <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />FICHE TECHNIQUE</div><h2>Les détails de l'atelier</h2></div><Settings2 size={18} /></div>
              <div className="detail-fields">
                <label><span>Matières</span><input value={product.materials} placeholder="Ex. chêne massif, cuir tanné…" onChange={(event) => onUpdate({ materials: event.target.value })} /></label>
                <label><span>Dimensions</span><input value={product.dimensions} placeholder="Ex. 200 × 120 × 40 mm" onChange={(event) => onUpdate({ dimensions: event.target.value })} /></label>
                <label><span>Techniques & usinage</span><input value={product.techniques} placeholder="Ex. couture sellier, tenon-mortaise…" onChange={(event) => onUpdate({ techniques: event.target.value })} /></label>
                <label><span>Outils</span><input value={product.tools} placeholder="Les outils utilisés" onChange={(event) => onUpdate({ tools: event.target.value })} /></label>
                <label><span>Temps passé</span><input value={product.duration} placeholder="Ex. 3 h 30" onChange={(event) => onUpdate({ duration: event.target.value })} /></label>
                <label><span>Sous-catégorie</span><input value={product.subcategory} placeholder="Ex. boîtes, bougies…" onChange={(event) => onUpdate({ subcategory: event.target.value })} /></label>
              </div>
              <label className="description-field"><span>À propos de cette pièce</span><textarea rows={3} value={product.description} placeholder="L'idée, l'histoire, les particularités…" onChange={(event) => onUpdate({ description: event.target.value })} /></label>
            </section>

            <section className="timeline-section">
              <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />AU FIL DU TEMPS</div><h2>Journal de fabrication <span>{product.entries.length}</span></h2></div><button className="icon-button" onClick={() => { insertAtRef.current = null; fileRef.current?.click(); }} aria-label="Ajouter un fichier"><FilePlus2 size={18} /></button></div>
              <form className="note-composer" onSubmit={addNote}>
                <div className="note-avatar"><Leaf size={18} /></div>
                <div className="note-input-area">
                  <textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Une étape, une idée, une note…" aria-label="Nouvelle note d'atelier" />
                  <NoteWorkFields value={draftWork} onChange={setDraftWork} machineSuggestions={machineSuggestions} toolSuggestions={toolSuggestions} />
                  <div className="composer-actions">
                    <div className="composer-left">
                      <button type="button" className={`dictation-button ${recording ? "recording" : ""}`} onClick={toggleDictation}><Mic size={15} />{recording ? "Écoute en cours" : "Dicter"}</button>
                      <button type="button" className="composer-attach" onClick={() => { insertAtRef.current = null; galleryRef.current?.click(); }} aria-label="Ajouter une photo"><ImagePlus size={16} /></button>
                    </div>
                    <button className="send-note" type="submit" disabled={!draft.trim()}>Ajouter la note <ArrowUpRight size={14} /></button>
                  </div>
                </div>
              </form>
              {notice && <p className="inline-notice" role="status">{notice}</p>}

              <div className="timeline">
                {product.entries.map((entry, index) => (
                  <div className="timeline-group" key={entry.id}>
                    <article className="timeline-entry">
                      <div className={`timeline-dot dot-${entry.kind}`}>{entry.kind === "photo" ? <Camera size={13} /> : entry.kind === "sketch" ? <Sparkles size={13} /> : entry.kind === "file" ? <FilePlus2 size={13} /> : <AudioLines size={13} />}</div>
                      <div className="timeline-content">
                        <div className="timeline-meta">
                          <strong>{entry.kind === "photo" ? "Photo d'atelier" : entry.kind === "sketch" ? "Croquis de référence" : entry.kind === "file" ? "Fichier ajouté" : "Note d'atelier"}</strong>
                          <span className="timeline-meta-actions">
                            <span className="timeline-reorder" aria-label="Déplacer cet élément dans le journal">
                              <button type="button" className="timeline-move-button" onClick={() => onMoveEntry(index, index - 1)} disabled={index === 0 || insertPosition !== null} aria-label="Déplacer vers le haut" title="Déplacer vers le haut"><ChevronUp size={13} /></button>
                              <button type="button" className="timeline-move-button" onClick={() => onMoveEntry(index, index + 1)} disabled={index === product.entries.length - 1 || insertPosition !== null} aria-label="Déplacer vers le bas" title="Déplacer vers le bas"><ChevronDown size={13} /></button>
                            </span>
                            {entry.kind === "note" && (
                              <button type="button" className="timeline-edit-button" onClick={() => {
                                setEditingNoteId(entry.id);
                                setEditDraft(entry.text);
                                setEditWork(noteWorkDraft(entry));
                              }} disabled={editingNoteId !== null} aria-label="Modifier cette note"><Pencil size={12} /><span>Modifier</span></button>
                            )}
                            <time>{formatDate(entry.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                          </span>
                        </div>
                        {editingNoteId === entry.id ? (
                          <form className="timeline-edit-form" onSubmit={saveEditedNote}>
                            <textarea autoFocus rows={2} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} aria-label="Modifier le texte de la note" />
                            <NoteWorkFields value={editWork} onChange={setEditWork} machineSuggestions={machineSuggestions} toolSuggestions={toolSuggestions} />
                            <div className="timeline-insert-actions">
                              <span />
                              <span>
                                <button type="button" className="dictation-button" onClick={cancelEditingNote}>Annuler</button>
                                <button className="send-note" type="submit" disabled={!editDraft.trim()}>Enregistrer <Check size={13} /></button>
                              </span>
                            </div>
                          </form>
                        ) : (
                          <>
                            {entry.text && <p className={entry.kind === "note" ? "timeline-note-text" : undefined}>{entry.text}</p>}
                            {entry.kind === "note" && entry.durationMinutes && entry.workMethod && (
                              <p className="note-work-summary">
                                <Clock3 size={12} /> {formatDurationMinutes(entry.durationMinutes)} · {entry.workMethod === "manual" ? "manuel" : `machine${entry.machineName ? ` : ${entry.machineName}` : ""}`}
                              </p>
                            )}
                            {entry.kind === "note" && entry.toolNames?.length ? <p className="note-work-summary">Outils : {entry.toolNames.join(", ")}</p> : null}
                          </>
                        )}
                        {entry.kind === "file" && <span className="file-chip"><FilePlus2 size={13} />{entry.fileName}</span>}
                        {(entry.kind === "photo" || entry.kind === "sketch") && <ProductImage entry={entry} productId={product.id} cloudToken={cloudToken} className="timeline-photo" />}
                      </div>
                    </article>
                    {index < product.entries.length - 1 && (
                      <div className="timeline-insertion">
                        {insertPosition === index + 1 ? (
                          <form className="timeline-insert-form" onSubmit={addInsertedNote}>
                            <textarea autoFocus rows={2} value={insertDraft} onChange={(event) => setInsertDraft(event.target.value)} placeholder="Ajouter une note à cet endroit…" aria-label="Note à insérer dans le journal" />
                            <NoteWorkFields value={insertWork} onChange={setInsertWork} machineSuggestions={machineSuggestions} toolSuggestions={toolSuggestions} />
                            <div className="timeline-insert-actions">
                              <button type="button" className="dictation-button" onClick={() => openPhotoPickerAt(index + 1)}><ImagePlus size={14} />Ajouter une photo</button>
                              <span>
                                <button type="button" className="dictation-button" onClick={() => { insertAtRef.current = null; setInsertPosition(null); setInsertDraft(""); setInsertWork(blankNoteWorkDraft); }}>Annuler</button>
                                <button className="send-note" type="submit" disabled={!insertDraft.trim()}>Insérer la note <ArrowUpRight size={13} /></button>
                              </span>
                            </div>
                          </form>
                        ) : (
                          <button className="timeline-insert-button" onClick={() => { insertAtRef.current = null; setInsertDraft(""); setInsertWork(blankNoteWorkDraft); setInsertPosition(index + 1); }}><Plus size={13} /><span>Insérer ici</span></button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {product.entries.length === 0 && <p className="empty-timeline">Votre histoire commence ici. Ajoutez une photo ou votre première note.</p>}
              </div>
            </section>
          </div>
          <aside className="detail-rail">
            <div className="rail-card"><div className="rail-label"><Clock3 size={14} />CRÉÉ LE</div><strong>{formatDate(product.createdAt)}</strong><small>Mis à jour le {formatDate(product.updatedAt)}</small></div>
            <div className="rail-card"><div className="rail-label"><ImagePlus size={14} />MÉMOIRE VISUELLE</div><strong>{imageEntries.length} image{imageEntries.length > 1 ? "s" : ""}</strong><small>Photos & croquis réunis</small></div>
            <div className="rail-card"><div className="rail-label"><Clock3 size={14} />TEMPS PASSÉ</div><strong>{formatDurationMinutes(workSummary.totalMinutes)}</strong><small>{formatDurationMinutes(workSummary.manualMinutes)} manuel · {formatDurationMinutes(workSummary.machineMinutes)} machine</small>{workSummary.machines.length > 0 && <small className="rail-machines">Machines : {workSummary.machines.join(", ")}</small>}{workSummary.tools.length > 0 && <small className="rail-machines">Outils : {workSummary.tools.join(", ")}</small>}</div>
            <div className="rail-section-title">INTELLIGENCE D'ATELIER</div>
            <button className="ai-sketch-button" onClick={() => onOpenAiStudio("sketch")}>
              <span><Sparkles size={16} /></span>
              <span><strong>1. Transformer en croquis</strong><small>Dessin d'atelier & cotes</small></span>
              <ChevronDown size={15} />
            </button>
            <button className="ai-sketch-button" onClick={() => onOpenAiStudio("sheets")}>
              <span><FilePlus2 size={16} /></span>
              <span><strong>2. Fiches Tech & Com</strong><small>Avec votre logo d'entreprise</small></span>
              <ChevronDown size={15} />
            </button>
            <button className="ai-sketch-button" onClick={() => onOpenAiStudio("ideas")}>
              <span><Leaf size={16} /></span>
              <span><strong>3. Idées de création</strong><small>Variantes, gammes & chutes</small></span>
              <ChevronDown size={15} />
            </button>
            {product.generatedDocuments?.length ? (
              <button className="ai-sketch-button saved-documents-link" onClick={() => onOpenAiStudio("sheets")}>
                <span><FilePlus2 size={16} /></span>
                <span><strong>Documents enregistrés ({product.generatedDocuments.length})</strong><small>Rouvrir sans relancer Gemini</small></span>
                <ChevronDown size={15} />
              </button>
            ) : null}
          </aside>
        </div>
        <input ref={cameraRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onClick={() => { insertAtRef.current = null; }} onChange={(event) => void onFileChange(event, "photo")} />
        <input ref={galleryRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => void onFileChange(event, "photo")} />
        <input ref={fileRef} className="visually-hidden" type="file" onChange={(event) => void onFileChange(event, "file")} />
      </section>
    </div>
  );
}

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [storageError, setStorageError] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [cloudIdentity, setCloudIdentity] = useState<CloudIdentity | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [pendingSyncIds, setPendingSyncIds] = useState<string[]>([]);
  const [cloudNotice, setCloudNotice] = useState("");
  const [cloudNoticeError, setCloudNoticeError] = useState(false);
  const nativeGoogleReady = useRef(false);

  // État du profil, logo, API Gemini et pied de page
  const [profile, setProfile] = useState<ProfileSettings>(() => loadProfileSettings());
  const [profileOpen, setProfileOpen] = useState(false);

  // État des outils d'IA (les 3 chemins)
  const [aiStudioOpen, setAiStudioOpen] = useState(false);
  const [aiStudioTab, setAiStudioTab] = useState<"sketch" | "sheets" | "ideas">("sketch");
  const [aiStudioProduct, setAiStudioProduct] = useState<Product | undefined>(undefined);
  const [docModal, setDocModal] = useState<{
    product: Product;
    result: DataSheetsResult;
    coverUrl?: string;
  } | null>(null);
  const nativeBackHandler = useRef<() => void>(() => {});
  nativeBackHandler.current = () => {
    if (docModal) {
      setDocModal(null);
    } else if (aiStudioOpen) {
      setAiStudioOpen(false);
    } else if (profileOpen) {
      setProfileOpen(false);
    } else if (createOpen) {
      setCreateOpen(false);
    } else if (selectedId) {
      setSelectedId("");
    } else {
      void CapacitorApp.exitApp();
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener("backButton", () => nativeBackHandler.current())
      .then((listener) => {
        if (!active) {
          void listener.remove();
          return;
        }
        removeListener = () => listener.remove();
      })
      .catch((error: unknown) => {
        setCloudNotice(error instanceof Error ? error.message : "Impossible d'activer le bouton Retour.");
        setCloudNoticeError(true);
      });
    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, []);

  useEffect(() => {
    try {
      const stored = loadProducts();
      try {
        setPendingSyncIds(Object.keys(loadPendingSyncTags()));
      } catch (error) {
        setCloudNotice(error instanceof Error ? error.message : "Impossible de lire les créations à synchroniser.");
        setCloudNoticeError(true);
      }
      const initial = stored.filter((product) => !isStarterProduct(product));
      const starterMediaIds = stored.filter(isStarterProduct).flatMap((product) =>
        product.entries.flatMap((entry) => entry.mediaId ? [entry.mediaId] : []));
      setProducts(initial);
      setSelectedId("");
      if (initial.length !== stored.length) {
        saveProducts(initial);
        void deleteMedia(starterMediaIds).catch((error: unknown) => {
          setStorageError(error instanceof Error ? error.message : "Impossible de supprimer les fichiers du projet de démarrage.");
        });
      } else if (!hasStoredProducts()) {
        saveProducts(initial);
      }
      setProductsLoaded(true);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Impossible d'ouvrir le carnet enregistré.");
    }
  }, []);

  useEffect(() => {
    if (!productsLoaded) return;
    try {
      saveProducts(products);
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Impossible d'enregistrer les modifications.");
    }
  }, [products, productsLoaded]);

  const selected = products.find((product) => product.id === selectedId);
  const equipmentOptions = useMemo(() => collectEquipmentOptions(products), [products]);
  const pendingSyncSet = useMemo(() => new Set(pendingSyncIds), [pendingSyncIds]);
  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = activeCategory === "all" || product.category === activeCategory;
    const term = search.trim().toLocaleLowerCase("fr");
    const searchableValues = [
      product.name,
      product.subcategory,
      product.materials,
      product.description,
      product.tools,
      ...product.entries.flatMap((entry) => [entry.machineName ?? "", ...(entry.toolNames ?? [])]),
    ];
    const matchesSearch = !term || searchableValues
      .some((value) => value.toLocaleLowerCase("fr").includes(term));
    return matchesCategory && matchesSearch;
  }).sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt)), [activeCategory, products, search]);
  const activeCount = products.filter((product) => product.status === "in-progress").length;
  const photoCount = products.reduce((count, product) => count + product.entries.filter((entry) => entry.kind === "photo" || entry.kind === "sketch").length, 0);

  function markProductsForSync(ids: string[]) {
    if (!ids.length) return;
    try {
      setPendingSyncIds(Object.keys(markPendingSync(ids)));
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "Impossible d'enregistrer les créations à synchroniser.");
      setCloudNoticeError(true);
    }
  }

  async function synchronize(token: string, localProducts: Product[]) {
    setCloudBusy(true);
    setCloudNotice("Synchronisation en cours…");
    setCloudNoticeError(false);
    try {
      const pendingTagsAtStart = loadPendingSyncTags();
      const identity = await verifyCloudSession(token);
      setCloudIdentity(identity);
      setCloudToken(token);
      const remoteProducts = await listCloudProducts(token);
      const starterProducts = remoteProducts.filter(isStarterProduct);
      const userRemoteProducts = remoteProducts.filter((product) => !isStarterProduct(product));
      const deletedIds = loadDeletedProductIds();
      const deletedSet = new Set(deletedIds);
      const remoteById = new Map(userRemoteProducts.filter((product) => !deletedSet.has(product.id)).map((product) => [product.id, product]));
      const remoteDeletedIds = deletedIds.filter((id) => userRemoteProducts.some((product) => product.id === id));
      const localById = new Map(localProducts.map((product) => [product.id, product]));
      const mergedById = new Map(remoteById);
      for (const local of localProducts) {
        if (deletedSet.has(local.id)) continue;
        const remote = remoteById.get(local.id);
        if (!remote || Date.parse(local.updatedAt) > Date.parse(remote.updatedAt)) {
          mergedById.set(local.id, local);
        } else {
          mergedById.set(local.id, mergeProductVersions(local, remote));
        }
      }
      const merged = [...mergedById.values()].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
      const initialMergedById = new Map(mergedById);
      setProducts((currentProducts) => {
        const latestMergedById = new Map(mergedById);
        const deletedNow = new Set(loadDeletedProductIds());
        for (const current of currentProducts) {
          if (deletedNow.has(current.id)) {
            latestMergedById.delete(current.id);
            continue;
          }
          const baseline = localById.get(current.id);
          if (!baseline || current.updatedAt !== baseline.updatedAt) {
            latestMergedById.set(current.id, current);
          }
        }
        return [...latestMergedById.values()].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
      });

      await Promise.all(starterProducts.map((product) => deleteCloudProduct(token, product.id)));
      await Promise.all(remoteDeletedIds.map((id) => deleteCloudProduct(token, id)));

      const successfullySyncedTags: Record<string, string> = {};
      for (const product of merged) {
        const local = localById.get(product.id);
        const remote = remoteById.get(product.id);
        const pendingTag = pendingTagsAtStart[product.id];
        const remoteEntryIds = new Set(remote?.entries.map((entry) => entry.id) ?? []);
        const hasLocalOnlyEntries = local?.entries.some((entry) => !remoteEntryIds.has(entry.id)) ?? false;
        const shouldWrite = local !== undefined
          && (!remote || Boolean(pendingTag) || Date.parse(local.updatedAt) > Date.parse(remote.updatedAt) || hasLocalOnlyEntries);
        const saved = shouldWrite ? await writeCloudProduct(token, product) : product;
        for (const entry of saved.entries) {
          if (!entry.mediaId || !shouldWrite) continue;
          const localBlob = await readMedia(entry.mediaId);
          if (localBlob) {
            await putCloudMedia(token, saved.id, entry.mediaId, localBlob);
          } else if (!remote || (local?.entries.some((localEntry) => localEntry.id === entry.id) && !remoteEntryIds.has(entry.id))) {
            if (remote) {
              await fetchCloudMedia(token, saved.id, entry.mediaId);
            } else {
              throw new Error(`Fichier local introuvable : ${entry.fileName ?? entry.mediaId}`);
            }
          }
        }
        if (shouldWrite) {
          mergedById.set(saved.id, saved);
          if (pendingTag) successfullySyncedTags[product.id] = pendingTag;
        }
      }
      const synchronizedProducts = [...mergedById.values()].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
      if (Object.keys(successfullySyncedTags).length) {
        setPendingSyncIds(Object.keys(clearPendingSync(Object.keys(successfullySyncedTags), successfullySyncedTags)));
      }
      deletedIds.forEach(clearDeletedProductId);
      setProducts((currentProducts) => {
        const deletedNow = new Set(loadDeletedProductIds());
        const synchronizedById = new Map(synchronizedProducts
          .filter((product) => !deletedNow.has(product.id))
          .map((product) => [product.id, product]));
        for (const current of currentProducts) {
          if (deletedNow.has(current.id)) continue;
          const baseline = initialMergedById.get(current.id);
          if (!baseline || current.updatedAt !== baseline.updatedAt) {
            synchronizedById.set(current.id, current);
          }
        }
        return [...synchronizedById.values()].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
      });
      setCloudNotice(`Synchronisé avec ${identity.email ?? "Google"} · ${synchronizedProducts.length} création${synchronizedProducts.length === 1 ? "" : "s"}`);
      setCloudNoticeError(false);
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "La synchronisation a échoué.");
      setCloudNoticeError(true);
    } finally {
      setCloudBusy(false);
    }
  }

  function onGoogleLogin(credential?: string) {
    if (cloudBusy) return;
    if (!credential) {
      setCloudNotice("Google n'a pas renvoyé de jeton de connexion.");
      setCloudNoticeError(true);
      return;
    }
    void synchronize(credential, products);
  }

  async function signInNative() {
    if (cloudBusy) return;
    try {
      const { GoogleSignIn } = await import("@capawesome/capacitor-google-sign-in");
      if (!nativeGoogleReady.current) {
        await GoogleSignIn.initialize({ clientId: GOOGLE_CLIENT_ID });
        nativeGoogleReady.current = true;
      }
      const result = await GoogleSignIn.signIn();
      onGoogleLogin(result.idToken);
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "La connexion Google Android a échoué.");
      setCloudNoticeError(true);
    }
  }

  async function signOut() {
    if (Capacitor.isNativePlatform()) {
      try {
        const { GoogleSignIn } = await import("@capawesome/capacitor-google-sign-in");
        await GoogleSignIn.signOut();
      } catch (error) {
        setCloudNotice(error instanceof Error ? error.message : "La déconnexion Google a échoué.");
        setCloudNoticeError(true);
        return;
      }
    }
    setCloudToken("");
    setCloudIdentity(null);
    setCloudNotice("Déconnecté de Google ; les fiches locales restent disponibles.");
    setCloudNoticeError(false);
  }

  if (!cloudToken) {
    return <LoginScreen
      busy={cloudBusy}
      notice={cloudNotice}
      noticeError={cloudNoticeError}
      onGoogleSuccess={onGoogleLogin}
      onGoogleError={() => {
        setCloudNotice("La connexion Google a échoué.");
        setCloudNoticeError(true);
      }}
      onNativeSignIn={() => void signInNative()}
    />;
  }

  function updateSelected(changes: Partial<Product>) {
    markProductsForSync([selectedId]);
    setProducts((current) => current.map((product) => product.id === selectedId
      ? { ...product, ...changes, updatedAt: new Date().toISOString() }
      : product));
  }

  function moveSelectedEntry(fromIndex: number, toIndex: number) {
    markProductsForSync([selectedId]);
    setProducts((current) => current.map((product) => product.id === selectedId
      ? moveEntry(product, fromIndex, toIndex)
      : product));
  }

  function addNote(text: string, workDetails: EntryWorkDetails, index?: number) {
    markProductsForSync([selectedId]);
    setProducts((current) => current.map((product) => product.id === selectedId
      ? index === undefined
        ? addEntry(product, { kind: "note", text, ...workDetails })
        : insertEntry(product, { kind: "note", text, ...workDetails }, index)
      : product));
  }

  function editNote(entryId: string, text: string, workDetails: EntryWorkDetails) {
    markProductsForSync([selectedId]);
    setProducts((current) => current.map((product) => product.id === selectedId
      ? updateNoteEntry(product, entryId, text, workDetails)
      : product));
  }

  async function uploadEntry(file: File, kind: "photo" | "file", index?: number) {
    const mediaFile = kind === "photo" ? await compressPhoto(file) : file;
    const mediaId = crypto.randomUUID();
    await storeMedia(mediaId, mediaFile);
    const newEntry: Omit<WorkshopEntry, "id" | "createdAt"> = {
      kind,
      text: kind === "photo" ? "Nouvelle étape de fabrication" : "",
      mediaId,
      fileName: mediaFile.name,
      mimeType: mediaFile.type || "application/octet-stream",
    };
    markProductsForSync([selectedId]);
    setProducts((current) => current.map((product) => product.id === selectedId
      ? index === undefined ? addEntry(product, newEntry) : insertEntry(product, newEntry, index)
      : product));
  }

  function createNewProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const product = createProduct(form);
    markProductsForSync([product.id]);
    setProducts((current) => [product, ...current]);
    setSelectedId(product.id);
    setCreateOpen(false);
    setForm(blankForm);
  }

  async function removeSelected() {
    if (!selected || !window.confirm(`Supprimer « ${selected.name} » et son historique de cet appareil ?`)) return;
    try {
      markProductDeleted(selected.id);
      if (cloudToken) await deleteCloudProduct(cloudToken, selected.id);
      await deleteMedia(selected.entries.flatMap((entry) => entry.mediaId ? [entry.mediaId] : []));
      if (cloudToken) clearDeletedProductId(selected.id);
      setPendingSyncIds(Object.keys(clearPendingSync([selected.id])));
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Impossible de supprimer les fichiers du projet.");
      return;
    }
    const remaining = products.filter((product) => product.id !== selected.id);
    setProducts(remaining);
    setSelectedId("");
  }

  function openAiStudio(tab: "sketch" | "sheets" | "ideas" = "sketch", targetProduct?: Product) {
    setAiStudioTab(tab);
    setAiStudioProduct(targetProduct ?? selected ?? products[0]);
    setAiStudioOpen(true);
  }

  function handleAddSketchEntry(productId: string, mediaId: string, dataUrl: string) {
    const newEntry: Omit<WorkshopEntry, "id" | "createdAt"> = {
      kind: "sketch",
      text: "Croquis d'atelier de référence (cotations & style crayon)",
      mediaId,
      mediaPath: dataUrl,
      fileName: "croquis-atelier.jpg",
      mimeType: "image/jpeg",
    };
    markProductsForSync([productId]);
    setProducts((current) => current.map((p) => p.id === productId ? addEntry(p, newEntry) : p));
  }

  function handleCreateProductFromIdea(idea: CraftingIdea) {
    const newProduct = createProduct({
      name: idea.title,
      category: (idea.category as ProductCategory) || "bois",
      materials: idea.materialsNeeded,
      description: `${idea.description}\n\nAstuces d'atelier :\n${idea.craftingTips.map((t) => `• ${t}`).join("\n")}`,
    });
    markProductsForSync([newProduct.id]);
    setProducts((current) => [newProduct, ...current]);
    setSelectedId(newProduct.id);
    setAiStudioOpen(false);
  }

  function openGeneratedDocumentation(product: Product, result: DataSheetsResult, coverUrl?: string) {
    const generatedDocument: GeneratedDocument = { id: crypto.randomUUID(), dataSheets: result };
    const updatedAt = new Date().toISOString();
    const updatedProduct = {
      ...product,
      generatedDocuments: [...(product.generatedDocuments ?? []), generatedDocument],
      updatedAt,
    };
    markProductsForSync([product.id]);
    setProducts((current) => current.map((existing) => existing.id === product.id
      ? {
          ...existing,
          generatedDocuments: [...(existing.generatedDocuments ?? []), generatedDocument],
          updatedAt,
        }
      : existing));
    setAiStudioOpen(false);
    setDocModal({ product: updatedProduct, result, coverUrl });
  }

  function openSavedDocumentation(product: Product, document: GeneratedDocument, coverUrl?: string) {
    setAiStudioOpen(false);
    setDocModal({ product, result: document.dataSheets, coverUrl });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="MaxLab accueil"><span className="brand-mark"><Hammer size={18} /></span><span className="brand-word">max<span>lab</span><small>LE CARNET D'ATELIER</small></span></a>
        <div className="topbar-center"><span className="sync-indicator"><i />{cloudIdentity ? "Compte Google" : "Carnet local"}</span><span className="topbar-divider" />{cloudIdentity ? cloudIdentity.email ?? "Synchronisation disponible" : "Sauvegarde locale"}</div>
        <div className={`topbar-right ${cloudToken ? "is-authenticated" : ""}`}>
          <button className="topbar-ai-button" onClick={() => openAiStudio("sketch")} title="Ouvrir le Studio IA MaxLab">
            <Sparkles size={14} />
            <span>Studio IA</span>
          </button>
          {cloudToken ? <>
            <button className="cloud-sync-button" onClick={() => void synchronize(cloudToken, products)} disabled={cloudBusy}><RefreshCw size={14} className={cloudBusy ? "spin" : ""} /><span>{cloudBusy ? "Sync…" : "Synchroniser"}</span></button>
            <button className="topbar-icon" onClick={() => void signOut()} aria-label="Déconnexion Google"><LogOut size={16} /></button>
          </> : Capacitor.isNativePlatform()
            ? <button className="native-google-login" onClick={() => void signInNative()} disabled={cloudBusy} aria-label="Connexion avec Google"><GoogleIcon size={16} /><span>{cloudBusy ? "Connexion…" : "Connexion Google"}</span></button>
            : <div className="google-login"><GoogleLogin onSuccess={(response) => onGoogleLogin(response.credential)} onError={() => { setCloudNotice("La connexion Google a échoué."); setCloudNoticeError(true); }} text="signin" shape="rectangular" size="medium" /></div>}
          <button className="topbar-icon settings-button" aria-label="Paramètres & Profil" onClick={() => setProfileOpen(true)} title="Profil, Clé Gemini & Logo"><Settings2 size={18} /></button>
          <div className="profile-avatar" onClick={() => setProfileOpen(true)} title="Profil & Société" style={{ cursor: "pointer", overflow: "hidden" }}>
            {profile.companyLogoUrl ? <img src={profile.companyLogoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (cloudIdentity?.name?.slice(0, 1).toUpperCase() ?? "M")}
          </div>
        </div>
      </header>
      <div className="app-layout">
        <aside className="sidebar">
          <span className="sidebar-overline">ESPACE DE TRAVAIL</span>
          <button className="nav-link active"><span className="nav-icon"><Hammer size={17} /></span>Mes créations<span className="nav-number">{products.length.toString().padStart(2, "0")}</span></button>
          <button className="nav-link" onClick={() => setActiveCategory("all")}><span className="nav-icon"><Leaf size={17} /></span>Tout l'atelier</button>
          <button className="nav-link" onClick={() => openAiStudio("sketch")}><span className="nav-icon"><Sparkles size={17} /></span>Studio IA</button>
          <button className="nav-link" onClick={() => setProfileOpen(true)}><span className="nav-icon"><Settings2 size={17} /></span>Profil & Atelier</button>
          <div className="sidebar-separator" />
          <div className="sidebar-section-head"><span>MATIÈRES</span><button className="small-add" onClick={() => setCreateOpen(true)} aria-label="Créer un projet"><Plus size={14} /></button></div>
          {productCategories.map((category) => (
            <button className={`nav-link category-link ${activeCategory === category ? "selected" : ""}`} key={category} onClick={() => setActiveCategory(activeCategory === category ? "all" : category)}>
              <span className={`material-dot dot-${category}`} />{categoryLabels[category]}<span className="nav-number">{products.filter((product) => product.category === category).length}</span>
            </button>
          ))}
          <div className="sidebar-bottom">
            <div className="workshop-card"><span className="workshop-icon"><Leaf size={16} /></span><strong>Un atelier vivant</strong><p>Chaque pièce a une histoire. Gardez-en la trace.</p><span className="workshop-foot">FAIT MAIN · FAIT AVEC SOIN</span></div>
            <div className="local-note"><span className="local-note-dot" /><span>{cloudIdentity ? <>Connecté à Google<br />synchronisation manuelle</> : <>Données conservées<br />sur cet appareil</>}</span></div>
          </div>
        </aside>

        <main className="main-content">
          <div className="welcome-line"><span className="welcome-sparkle">✳</span><span>VOTRE ATELIER, À PORTÉE DE MAIN</span><span className="welcome-date">{formatDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</span></div>
          <div className="page-heading"><div><h1>Les mains dans<br className="mobile-break" /> la matière<span className="heading-period">.</span></h1><p>Vos idées, vos gestes, vos créations — tout au même endroit.</p></div><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17} /><span>Nouvelle création</span></button></div>

          {cloudNotice && <p className={`cloud-notice ${cloudNoticeError ? "error" : ""}`} role={cloudNoticeError ? "alert" : "status"}><Cloud size={14} />{cloudNotice}</p>}
          <div className="overview-strip">
            <div className="overview-item"><span className="overview-icon icon-projects"><Hammer size={17} /></span><span><strong>{products.length.toString().padStart(2, "0")}</strong><small>PROJETS AU CARNET</small></span></div>
            <span className="overview-divider" />
            <div className="overview-item"><span className="overview-icon icon-active"><AudioLines size={17} /></span><span><strong>{activeCount.toString().padStart(2, "0")}</strong><small>EN COURS À L'ATELIER</small></span></div>
            <span className="overview-divider" />
            <div className="overview-item"><span className="overview-icon icon-photos"><ImagePlus size={17} /></span><span><strong>{photoCount.toString().padStart(2, "0")}</strong><small>SOUVENIRS VISUELS</small></span></div>
          </div>

          <div className="collection-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" />LE CARNET</div><h2>Vos créations <span>{visibleProducts.length}</span></h2></div>
            <div className="collection-tools">
              <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Création, outil, machine…" aria-label="Chercher une création, un outil ou une machine" />{search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={14} /></button>}</label>
              <button className="sort-button" aria-label="Trié par modification récente"><ArrowDownUp size={15} /><span>Récent</span></button>
            </div>
          </div>
          <div className="filter-row" aria-label="Filtrer par matière">
            {categoryFilters.map((category) => <button key={category} className={activeCategory === category ? "filter-chip active" : "filter-chip"} onClick={() => setActiveCategory(category)}>{category === "all" ? "Tout" : categoryLabels[category]}{category !== "all" && <span>{products.filter((product) => product.category === category).length}</span>}</button>)}
          </div>

          {storageError && <p className="storage-warning" role="alert">{storageError}</p>}
          {visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} cloudToken={cloudToken} pendingSync={pendingSyncSet.has(product.id)} onOpen={() => setSelectedId(product.id)} />)}
            <button className="new-product-card" onClick={() => setCreateOpen(true)}><span className="new-card-plus"><Plus size={19} /></span><strong>Une nouvelle idée ?</strong><span>Commencez son carnet ici.</span><span className="new-card-link">Créer une fiche <ArrowUpRight size={14} /></span></button>
          </div> : <div className="empty-state"><span className="empty-state-icon"><Hammer size={25} /></span><h3>{search ? "Aucune création trouvée" : "Le carnet est prêt pour vos idées"}</h3><p>{search ? "Essayez un autre nom, une matière, un outil ou une machine." : "Créez votre première fiche et gardez chaque étape en mémoire."}</p><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} />Créer une fiche</button></div>}
          <footer className="page-footer"><span>FAIT À LA MAIN, GARDÉ EN MÉMOIRE.</span><span>MAXLAB <i>·</i> 2026</span></footer>
        </main>
      </div>

      {selected && (
        <ProductDetails
          product={selected}
          cloudToken={cloudToken}
          machineSuggestions={equipmentOptions.machines}
          toolSuggestions={equipmentOptions.tools}
          onClose={() => setSelectedId("")}
          onUpdate={updateSelected}
          onEntry={addNote}
          onEditEntry={editNote}
          onMoveEntry={moveSelectedEntry}
          onUpload={uploadEntry}
          onDelete={removeSelected}
          onOpenAiStudio={(tab) => openAiStudio(tab, selected)}
        />
      )}
      {createOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
        <form className="create-modal" onSubmit={createNewProduct}>
          <div className="modal-topline"><div><div className="eyebrow"><span className="eyebrow-line" />UNE NOUVELLE HISTOIRE</div><h2>Créer une fiche</h2></div><button type="button" className="modal-close" onClick={() => setCreateOpen(false)} aria-label="Fermer"><X size={19} /></button></div>
          <p>Posez les premières bases. Vous pourrez compléter les détails au fil de la fabrication.</p>
          <label className="modal-label">Nom de la création<input required autoFocus maxLength={120} placeholder="Ex. Tabouret en chêne" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <div className="modal-fields"><label className="modal-label">Matière principale<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductCategory })}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="modal-label">Sous-catégorie<input maxLength={100} placeholder="Ex. assise, maroquinerie…" value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })} /></label></div>
          <label className="modal-label">Matières à prévoir <span className="optional-label">FACULTATIF</span><input maxLength={200} placeholder="Ex. noyer, cuir naturel…" value={form.materials} onChange={(event) => setForm({ ...form, materials: event.target.value })} /></label>
          <label className="modal-label">Dimensions envisagées <span className="optional-label">FACULTATIF</span><input maxLength={100} placeholder="Ex. 30 × 20 cm" value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Annuler</button><button type="submit" className="primary-button"><Check size={16} />Créer le carnet</button></div>
        </form>
      </div>}

      {profileOpen && (
        <ProfileModal
          settings={profile}
          onSave={(newSettings) => setProfile(newSettings)}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {aiStudioOpen && (
        <AiStudioModal
          initialTab={aiStudioTab}
          initialProduct={aiStudioProduct}
          products={products}
          profile={profile}
          cloudToken={cloudToken}
          onClose={() => setAiStudioOpen(false)}
          onOpenProfile={() => {
            setAiStudioOpen(false);
            setProfileOpen(true);
          }}
          onAddSketchEntry={handleAddSketchEntry}
          onOpenDocumentation={openGeneratedDocumentation}
          onOpenSavedDocumentation={openSavedDocumentation}
          onCreateProductFromIdea={handleCreateProductFromIdea}
        />
      )}

      {docModal && (
        <DocumentationModal
          product={docModal.product}
          dataSheets={docModal.result}
          profile={profile}
          coverImageSrc={docModal.coverUrl}
          onClose={() => setDocModal(null)}
          onAddToProject={(text) => {
            addNote(text, {});
          }}
        />
      )}

      <nav className="mobile-nav" aria-label="Navigation principale">
        <button className="mobile-nav-active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Hammer size={18} /><span>Carnet</span></button>
        <button onClick={() => setCreateOpen(true)}><Plus size={19} /><span>Créer</span></button>
        <button onClick={() => openAiStudio("sketch")}><Sparkles size={18} /><span>Studio IA</span></button>
        <button onClick={() => setProfileOpen(true)}><Settings2 size={18} /><span>Profil</span></button>
        {cloudToken ? (
          <button onClick={() => void synchronize(cloudToken, products)} disabled={cloudBusy}>
            <RefreshCw size={17} className={cloudBusy ? "spin" : ""} />
            <span>Sync</span>
          </button>
        ) : Capacitor.isNativePlatform() ? (
          <button onClick={() => void signInNative()} aria-label="Connexion avec Google" className="mobile-nav-google">
            <GoogleIcon size={17} />
            <span>Google</span>
          </button>
        ) : (
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Connexion avec Google" className="mobile-nav-google">
            <GoogleIcon size={17} />
            <span>Google</span>
          </button>
        )}
      </nav>
    </div>
  );
}
