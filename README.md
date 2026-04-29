# Municipal Truck Job Tracker (Google Sheets)

Application mobile-friendly en Next.js + React + Tailwind pour suivre les jobs des camions municipaux à partir de photos de cahier, avec stockage dans Google Sheets.

## Setup

1. Installer les dépendances:
   ```bash
   npm install
   ```
2. Copier les variables d'environnement:
   ```bash
   cp .env.example .env.local
   ```
3. Ajouter l'URL du Web App Google Apps Script dans `.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_SHEETS_API_URL=...
   ```
4. Lancer l'app:
   ```bash
   npm run dev
   ```

## Structure Google Sheets
Créer une feuille avec les colonnes:
- `id`
- `created_at`
- `truck_number`
- `job_description`
- `status`
- `completion_date`
- `employee_name`
- `comments`
- `photo_data_url`

## Google Apps Script (exemple)
Publier en tant que Web App (accès adapté à votre besoin) et implémenter les actions:
- `listJobs`
- `createJob`
- `markDone`

Le front envoie des requêtes POST JSON:
```json
{ "action": "listJobs" }
```
```json
{ "action": "createJob", "truck_number": "12", "job_description": "..." }
```
```json
{ "action": "markDone", "id": "...", "completion_date": "2026-04-29" }
```

## Fonctionnalités
- Capture / upload de photo de cahier.
- Ajout de plusieurs jobs liés à une photo.
- Date de création automatique côté backend Google Apps Script.
- Dashboard avec filtres par camion, statut et date.
- Bouton “Mark done”.
- Export CSV (compatible Excel).


## Backend Google Apps Script prêt à l'emploi
Le fichier `apps-script/Code.gs` contient une implémentation complète de `listJobs`, `createJob` et `markDone`.
- Ouvrir Google Sheets > Extensions > Apps Script
- Coller le contenu de `apps-script/Code.gs`
- Déployer en Web App (accès selon votre besoin)
- Copier l'URL du Web App dans `NEXT_PUBLIC_GOOGLE_SHEETS_API_URL`
