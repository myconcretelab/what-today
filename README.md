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
- Commentaires Google Sheets mis en cache côté serveur pour un affichage immédiat
  (réponse depuis le cache, puis actualisation en arrière‑plan et mise à jour
  automatique du cache si des changements sont détectés).

## Pré‑requis
- Node.js ≥ 18
- npm

## Installation
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Utilisation
### Lancer le serveur API
```bash
cd backend
npm start
```
Le serveur écoute par défaut sur le port **3001** et charge les fichiers `ics`
une seule fois au démarrage.

Les commentaires de réservations sont exposés via:
- `GET /api/comments-range?start=YYYY-MM-DD&end=YYYY-MM-DD` — renvoie d'abord
  les valeurs du cache, puis déclenche une mise à jour en arrière‑plan depuis
  Google Sheets qui met à jour le cache si nécessaire.
- `GET /api/comments/:giteId/:date` — même logique cache‑d'abord + rafraîchissement.

### Lancer le frontend
```bash
cd frontend
npm run dev
```

Définissez le mot de passe attendu côté frontend via une variable
d'environnement `VITE_PASSWORD` (par défaut : `secret`).

## Tests
Aucun test automatisé n'est encore défini. Les commandes `npm test` dans les
sous‑projets affichent simplement un message.

## Architecture
```
what-today/
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
