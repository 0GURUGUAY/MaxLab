# MaxLab — Project Architecture

## Architecture cible

Le client est prévu en React/Vite pour le web et Capacitor pour Android, sur le modèle de `VSC_AnalogSynth`. Le backend cible est Express sur Cloud Run, avec Google Sign-In vérifié côté serveur, Firestore Native pour les métadonnées et Cloud Storage privé pour les fichiers. À terme, la clé Gemini devra rester côté serveur et les appels IA passer par l'API. Dans le prototype actuel, la clé personnelle est synchronisée dans le profil Firestore du compte puis utilisée côté client pour les appels Gemini.

### Schéma logique

```text
users/{googleSub}
  settings/profile
    geminiApiKey, companyName, companyInfo, companyLogoUrl
  products/{productId}
    name, category, subcategory, status, createdAt, updatedAt
    materials, dimensions, techniques, tools, duration, description
    entries/{entryId}
      kind, createdAt, text, mediaId?, fileName?, mimeType?
```

Les médias seront placés sous un chemin propre au compte et au produit dans Cloud Storage. Le logo du profil est aussi conservé dans Cloud Storage ; le reste du profil, dont la clé Gemini, est enregistré dans le document Firestore du compte et servi uniquement par l'API authentifiée. Les règles cloud devront refuser tout accès public/direct aux données.

## Avancement du prototype

- Interface web responsive, catégories bois/cuir/tissu/photos, recherche, état des créations, fiche technique et journal chronologique.
- Ajout local de photos, de fichiers et de notes ; dictée vocale via les fonctions du navigateur.
- Photos/croquis d'exemple issus du répertoire fourni.
- Backend préparé : Express vérifie le jeton Google, stocke les fiches isolées par compte dans Firestore et les médias privés dans Cloud Storage.
- Le client web propose une synchronisation manuelle, fusionne les fiches par date de modification, propage les suppressions locales et signale les conflits.
- Reste à déployer la première révision Cloud Run, ajouter son URL aux origines OAuth/CORS et vérifier la synchronisation avec le compte test. La génération Gemini reste à développer.
- Le dossier de travail n'est pas encore relié à GitHub. Le dépôt visé est `0GURUGU/MaxLab`.

La connexion native Android (client OAuth Android et empreinte SHA-1 de signature) reste à configurer. Pour activer les croquis Gemini, la clé API sera configurée côté serveur/Secret Manager ; elle ne doit jamais être intégrée à l'application.

### Environnement MaxLab choisi

- Project ID : `maxlab-511422`
- Région Cloud Run et Cloud Storage : `us-central1`
- Firestore Native `(default)` : créé en `nam5`, mode production (règles directes vérifiées en refus).
- Bucket privé : `maxlab-511422-media`, `us-central1`, stockage Standard, accès uniforme et prévention d’accès public activée.
- Compte de service Cloud Run : `maxlab-runner@maxlab-511422.iam.gserviceaccount.com`, sans clé JSON ; rôle Cloud Datastore User au niveau du projet et Storage Object Admin limité au bucket MaxLab.
- Client OAuth Web : `644788841502-j9aj9mpchrpng8ure0bfhoalmd0fscjs.apps.googleusercontent.com`, origine de développement `http://localhost:5173`, application en mode test.
- Application Android installée sur l'appareil via `adb` et lancée avec succès (`com.maxpatissier.maxlab`).
- Configuration `CLOUD_URL` native pointant sur le service Cloud Run `maxlab` du projet `maxlab-511422`.
- Secret Gemini : non configuré ; à ajouter dans Secret Manager au moment d’implémenter le relais IA.

je voudrais construire une application pour m'aider à gérer mes créations dans mon atelier de menuiserie et de confection. 

Mon besoin est assez simple : je crée des nouveaux produits, très artisanaux, généralement en bois et en cuir. Je veux pouvoir profiter de mon caméra sur mon téléphone pour prendre des photos tout au long du process de création / fabrication et stocker dans une base de donnée les photos et des commentaires qui seront dictés et convertis en texte par IA.

La base de données sera structurée comme telle : 
- nom du produit
- catégorie (bois / cuir / tissu / photos)
- sous catégorie (par exemple bois / bougies)
- date / photo / fichier / commentaire / données typique comme type de bois ou de cuir, dimension, usinage, durée, outils (tout ce qui est relatif à un atelier d'artisan)

J'ai demandé à GEMINI de créer des dessins type main levé à partir de photo et le résultat est excellent (voir photo1 + dessin1  et photo0+dessin0 dans le répertoire photo) donc ca serait bien que les photos puissent être, à la demande, modifiée en croquis industriel. 

Je veux avoir une application mobile solide pour android et une version web synchronisées. Exactement la même structure, base, cloud, etc que le projet déjà réalisé dans downloads/VSC_AnalogSynth - dis moi quand tu as besoin des API Gemini et des informations pour google run. 


Il y a un projet GITHUB sur mon compte 0GURUGUAY/MaxLab sur lequel tu pourras déposer ton code. 

Est ce clair pour toi ? 
