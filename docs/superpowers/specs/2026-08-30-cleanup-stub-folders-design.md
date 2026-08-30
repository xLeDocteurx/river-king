# Nettoyage des dossiers stubs vides

Date: 2026-08-30
Status: Draft
Linked issue: #22

## Problem

Trois dossiers ne contiennent que leur `README.md` (aucun code) :

- `src/app/core/guards/`
- `src/app/shared/directives/`
- `src/app/shared/pipes/`

Aucun fichier source ne les importe (`shared/directives`, `shared/pipes`, `core/guards` sont absents de tout import). Le seul route guard réel de l'application vit déjà dans `features/project/project.guard.ts`. Ces dossiers donnent une fausse indication de fonctionnalités inexistantes et alourdissent la navigation dans l'arborescence.

## Solution

Supprimer les trois dossiers stubs et harmoniser la documentation qui les référence :

1. Supprimer `src/app/core/guards/` (avec son `README.md`)
2. Supprimer `src/app/shared/directives/` (avec son `README.md`)
3. Supprimer `src/app/shared/pipes/` (avec son `README.md`)
4. Retirer les lignes qui listent ces dossiers dans les README parents :
   - `src/app/core/README.md` → supprimer la ligne `guards/` du tableau « Sous-dossiers »
   - `src/app/shared/README.md` → supprimer les lignes `directives/` et `pipes/` du tableau « Sous-dossiers »
5. Mettre à jour la section « Folder architecture » de `AGENTS.md` :
   - ligne 70 : retirer la mention `pipes, directives` → `Reusable UI, models (NO services here)`
   - lignes 73-74 : retirer les arborescences `directives/` et `pipes/`

## Design decisions (finalized 2026-08-30)

- **Périmètre complet** validé par l'utilisateur : suppression des dossiers + nettoyage des README parents + `AGENTS.md`.
- **Refactor cosmétique sans impact runtime** : aucun changement de comportement, aucune logique touchée.
- **Vérification** : pas de test unitaire (aucune logique). Valider `npm run build` et `npm run lint` après suppression.

## Architecture

Aucun changement d'architecture. Le guard reste dans `features/project/project.guard.ts` (son emplacement actuel n'est pas modifié).

## UI·UX details

Sans objet (aucun impact visuel ou fonctionnel).

## Data model changes

Aucun.

## Testing

Aucun test unitaire nécessaire. Vérification : `npm run build` et `npm run lint` doivent passer inchangés.

## Performance considerations

Aucun impact.

## Out of scope

- Déplacer ou réorganiser le guard existant (`features/project/project.guard.ts` reste en place).
- Créer de véritables directives ou pipes partagés.
