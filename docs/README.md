# Specs — Vacances (nom de code)

Application de sondage permettant à un groupe d'amis de décider ensemble de leurs prochaines vacances : destination, dates, budget, logement, activités.

## Sommaire

| Doc | Contenu |
|---|---|
| [01 — Vision & périmètre](./01-vision-perimetre.md) | Problème, objectifs, personas, ce qui est dans/hors périmètre |
| [02 — Specs fonctionnelles](./02-specs-fonctionnelles.md) | User stories, parcours, règles métier, algorithmes de dépouillement |
| [03 — Modèle de données](./03-modele-donnees.md) | Schéma Postgres, RLS, RPC, realtime |
| [04 — Architecture technique](./04-architecture-technique.md) | Stack, arborescence, conventions, qualité, déploiement |
| [05 — Specs UI & écrans](./05-specs-ui.md) | Design system, écrans écran par écran, états, responsive, a11y |
| [06 — Backlog & lots](./06-backlog.md) | Découpage en lots livrables, tickets, estimation, definition of done |
| [07 — Décisions & risques](./07-decisions-risques.md) | ADR, arbitrages, risques, questions ouvertes |
| [08 — Sprints](./08-sprints.md) | Ordonnancement du backlog en 10 sprints, scripts de recette, règles de travail |

## Décisions structurantes (verrouillées)

- **Périmètre de vote** : multi-catégories extensible — destination, dates, budget, logement, activités, + catégories libres.
- **Backend** : Supabase (Postgres + Auth anonyme + Realtime + RLS). Pas de serveur applicatif maison.
- **Identité** : lien de partage secret + pseudo, **sans création de compte**. Auth anonyme Supabase en arrière-plan pour l'attribution des votes et la RLS.
- **Front** : Vite + React 19 + TypeScript (base déjà en place dans le repo).

## Statut

Phase de spécification. Aucun code métier écrit à ce jour — le repo contient le template Vite/React par défaut.
