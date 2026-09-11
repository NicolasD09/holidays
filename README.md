# Vacances

Application de sondage permettant à un groupe d'amis de décider ensemble de leurs prochaines vacances : destination, dates, budget, logement, activités.

Un lien partagé dans le groupe, un prénom, et chacun se prononce en deux minutes. **Aucun compte à créer.**

## État

Phase de spécification. Le code est encore le template Vite par défaut — voir [`docs/`](./docs/README.md) pour l'ensemble des specs, et [`docs/06-backlog.md`](./docs/06-backlog.md) pour le plan de développement.

## Stack

Vite · React 19 · TypeScript · Tailwind + shadcn/ui · TanStack Query · Supabase (Postgres, auth anonyme, RLS, Realtime)

## Démarrer

```bash
npm install
npm run dev
```

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | typecheck + build de production |
| `npm run lint` | oxlint |
| `npm run format` | oxfmt |

## Documentation

Toutes les specs sont dans [`docs/`](./docs/README.md) : vision, specs fonctionnelles, modèle de données, architecture, UI, backlog, décisions.
