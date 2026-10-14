# MaxLab

Carnet numérique pour suivre les créations d'un atelier : matières, dimensions, outils, usinage, étapes, photos, fichiers et notes dictées.

## Premier démarrage

Le prototype fonctionne dans le navigateur. Il est préparé pour Android via Capacitor, sur le même socle client que le projet de référence. Pour lancer la version web, avec Node.js 22.12 ou plus récent :

```sh
npm install
npm run dev
```

Ouvrir l'adresse affichée par Vite. Les fiches sont conservées localement dans le navigateur ; les pièces jointes sont stockées séparément dans IndexedDB. Les photos et croquis personnels de démonstration ne sont pas inclus dans ce dépôt.

La prise de vue ouvre la caméra sur les appareils compatibles. Sur Android et iOS, la dictée utilise le service natif de reconnaissance vocale et demande l'autorisation du microphone au premier usage ; sur le web, elle utilise l'API de reconnaissance vocale du navigateur. Les appareils sans service vocal compatible permettent de saisir les notes au clavier.

## État du raccordement cloud

Le backend Express vérifie les ID tokens Google, cloisonne les fiches et le profil (dont la clé Gemini) par compte dans Firestore, et enregistre les blobs dans Cloud Storage privé. Les photos de galerie sont converties en JPEG compatible avant leur stockage ; les croquis et photos sont transférés comme médias séparés, jamais en base64 dans les fiches. Le logo du profil est également stocké dans Cloud Storage privé. Les réglages sont importés vers le cloud lors de la première connexion au compte, puis partagés entre les appareils ; les modifications ultérieures du profil sont synchronisées à l'enregistrement. Sur le web, la connexion est conservée dans un cookie `HttpOnly` persistant, révocable à la déconnexion ; la session reste également enregistrée côté serveur pour permettre sa révocation. Sur Android, le jeton de connexion est conservé localement et restauré au prochain lancement tant qu'il est valide ; s'il a expiré, une nouvelle connexion Google est nécessaire. La connexion Google native Android et la connexion web déclenchent une synchronisation initiale ; les modifications ultérieures des fiches restent locales jusqu'à l'action **Synchroniser**. L'application reste sur le carnet pendant la synchronisation et affiche son résultat en haut de la page. En cas de modifications concurrentes sur la même fiche, l'API renvoie un conflit et la synchronisation suivante récupère la version la plus récente.

Pour un environnement local, créer `.env` à partir de `.env.example`, puis utiliser les identifiants ADC de Google Cloud (`gcloud auth application-default login`) ; ne jamais télécharger de clé JSON de compte de service. La commande `npm run dev` démarre le backend local, vérifie son endpoint de santé, puis lance Vite, qui relaie `/api` sur `localhost:8080`. Pour lancer uniquement le backend, utiliser `npm run dev:server`. Avant le démarrage local, définir dans `.env` les variables du projet, du bucket, du client OAuth et `ALLOWED_ORIGINS=http://localhost:5173`. Dans la console Google Cloud, ajouter `http://localhost` et `http://localhost:5173` aux origines JavaScript autorisées du client OAuth Web utilisé par `VITE_GOOGLE_CLIENT_ID`, faute de quoi le bouton Google renvoie une erreur 403 « origin is not allowed ».

Le backend Cloud Run est accessible. Sur Android, la connexion native utilise le client OAuth Web pour obtenir un ID token ; la console Google Cloud doit aussi contenir un client OAuth Android associé à `com.maxpatissier.maxlab` et à l'empreinte SHA-1 du certificat de signature utilisé. Le backend doit autoriser l'origine Capacitor Android `https://localhost` dans `ALLOWED_ORIGINS`. Les appels Gemini du client utilisent la clé API configurée dans le profil.

## Modèle Gemini

Le test de clé dans **Profil & Atelier** et les appels Gemini de texte et d'analyse
visuelle utilisent `gemini-3.8-flash` avec l'API `generateContent`. Le croquis
utilise le modèle d'image `gemini-3.1-flash-image` avec la photo d'origine et
`generateContent`. La clé est transmise dans l'en-tête `x-goog-api-key`, et non
dans l'URL. Aucun appel réel n'est effectué par les tests automatisés. Une erreur
Gemini est affichée sans bascule vers un moteur local ; la création de croquis
nécessite une clé API Gemini. Les fiches et idées conservent leurs modèles locaux
disponibles lorsqu'aucune clé n'est configurée.

## Android

```sh
npm run build
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```

## Architecture cloud prévue

Le client mobile et le web utiliseront le même compte Google et le même backend, sur le modèle de `VSC_AnalogSynth` : Express/Cloud Run, Firestore Native pour les métadonnées et Cloud Storage privé pour les originaux et les croquis. Les médias ne seront pas placés en base64 dans les documents Firestore ; les clés Gemini resteront uniquement côté serveur.

Le projet Google Cloud, Firestore, le bucket privé, le compte de service et le client OAuth Web sont configurés. Reste à déployer le backend sur Cloud Run, ajouter l'origine du domaine Cloud Run au client OAuth et à la liste CORS, puis créer le client OAuth Android. Ne placez aucune clé secrète dans le client ou l'APK.

Voir [PROJECT_MaxLab.md](./PROJECT_MaxLab.md) pour le périmètre fonctionnel et le schéma de données.
