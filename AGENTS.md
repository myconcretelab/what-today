# Guide de contribution pour `what-today`

Ce dépôt est organisé en deux parties :
- **backend** : serveur Node.js/Express qui fournit les données.
- **frontend** : application React qui consomme ces données.

Ce document décrit les règles à suivre pour contribuer au projet.

## Style de code

### JavaScript général
- Utiliser des modules ES (`import`/`export`).
- Indentation de **2 espaces**.
- Toujours terminer les instructions par un **point-virgule**.
- Utiliser `const` par défaut et `let` uniquement si la variable doit être réaffectée.
- Noms de variables, fonctions et fichiers en **anglais**.

### Backend (`backend/`)
- Code exécuté côté serveur avec Express.
- Garder les fonctions **pures** autant que possible et documenter les effets secondaires.
- Structurer les fichiers par domaine fonctionnel.

### Frontend (`frontend/`)
- Application React basée sur des **composants fonctionnels**.
- Préférer les hooks React (`useState`, `useEffect`, etc.) aux composants de classe.
- Regrouper les composants réutilisables dans `src/components`.
- Les assets statiques (images, icônes) vivent dans `src/assets`.

## Tests

Avant toute soumission, exécuter les tests :

```bash
# Dans le dossier backend
npm test

# Dans le dossier frontend (mode non interactif)
CI=true npm test
```

Assurez-vous que toutes les commandes s'exécutent sans erreur.

## Messages de commit
- Rédiger les messages en **anglais** et à l'**impératif** (ex : `Add feature`).
- Un commit doit représenter une modification logique unique.

## Pull Requests
- Fournir une description claire des changements et du contexte.
- Mentionner les tests réalisés et leurs résultats.
- Demander une revue si les changements sont importants.

## Divers
- Version minimale recommandée de Node.js : **18**.
- Nettoyer tous les fichiers temporaires ou artefacts de build avant de committer.
- Respecter la législation et les bonnes pratiques en matière de licences.

Merci de contribuer !
