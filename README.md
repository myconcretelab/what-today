# What Today ?

Application web élégante affichant les arrivées à venir dans plusieurs gîtes.
Le projet est composé d'un backend Node.js chargé de parser des fichiers
`ics` et d'un frontend React (Material‑UI) qui présente les informations
sous forme d'une liste et d'un petit calendrier coloré.

## Fonctionnalités
- Chargement des calendriers iCal (Airbnb, Abritel, etc.) au démarrage du serveur.
- Gestion du cas particulier `Airbnb (Not available)` transformé en "Réservation en direct".
- Endpoint JSON `/api/arrivals` exposant les arrivées des 7 prochains jours.
- Interface React Material‑UI : mot de passe à la première connexion (stocké en
  `localStorage`), loader animé, calendrier 7 jours en ligne avec pastilles
  colorées et icônes selon la plateforme, liste détaillée des arrivées.
- Formatage des dates en français.
- Affichage d'un `?` lorsqu'une source iCal est inaccessible.
- Commentaires et réservations lus/écrits via la base `contrats`.

## Pré‑requis
- Node.js ≥ 18
- npm

## Installation
```bash
# Depuis la racine du dépôt
npm install
```

## Utilisation
### Lancer backend + frontend (recommandé)
```bash
npm run dev
```

### Lancer un seul workspace si besoin
```bash
# Backend seul
npm run dev:backend

# Frontend seul
npm run dev:frontend
```

Le serveur écoute par défaut sur le port **3001** et charge les fichiers `ics`
une seule fois au démarrage.

### Stockage des réservations via `contrats`
Le backend écrit/lit les réservations via l'API du repo `contrats`.

Variables à définir dans `backend/.env` :
- `CONTRATS_API_BASE_URL` (ex: `http://localhost:4000`)
- `CONTRATS_API_TOKEN` (recommandé, token dédié côté `contrats`)
- ou `CONTRATS_API_BASIC_USER` + `CONTRATS_API_BASIC_PASSWORD` (fallback)
- `CONTRATS_GITE_MAP` (optionnel, mapping explicite des gîtes)

Les commentaires de réservations sont exposés via:
- `GET /api/comments-range?start=YYYY-MM-DD&end=YYYY-MM-DD` — lecture directe via `contrats`.
- `GET /api/comments/:giteId/:date` — lecture directe via `contrats`.

Définissez le mot de passe attendu côté frontend via une variable
d'environnement `VITE_PASSWORD` (par défaut : `secret`).

## Tests
Des tests unitaires de base sont disponibles sur les deux sous-projets.

```bash
# Tous les tests (backend + frontend)
npm test

# Ou par workspace
npm run test:backend
npm run test:frontend
```

Une CI GitHub Actions exécute automatiquement:
- les tests backend
- les tests frontend
- le build frontend

## Architecture
```
what-today/
├── package.json         # Racine monorepo (npm workspaces)
├── backend/            # Serveur Node.js (Express)
│   ├── server.js       # Chargement des ics et endpoint JSON
│   └── package.json
├── frontend/           # Interface React + Material‑UI
│   ├── src/
│   │   ├── components/ # Login, calendrier, liste, loader
│   │   ├── services/   # Accès API
│   │   ├── App.js
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

## Sécurité
Un écran de mot de passe est affiché lors de la première visite. Une fois le
mot de passe correct saisi, l'information est mémorisée en `localStorage` et
les visites suivantes accèdent directement à l'application.

## Licence
Projet destiné à démonstration. Utilisation à vos risques.
