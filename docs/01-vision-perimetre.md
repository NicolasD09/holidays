# 01 — Vision & périmètre

## 1.1 Le problème

Organiser des vacances à 6-10 potes se passe aujourd'hui dans un fil de discussion WhatsApp. Symptômes systématiques :

- Les propositions se noient dans le fil, personne ne sait ce qui reste sur la table.
- Trois personnes répondent, les autres « voient ça ce week-end » et ne répondent jamais.
- Les dispos de chacun se croisent mal et personne ne tient le tableau.
- Le budget n'est jamais dit à voix haute : celui pour qui c'est trop cher n'ose pas le dire devant le groupe.
- Le premier avis exprimé influence tous les suivants (effet de meute).
- Au bout de trois semaines, il ne reste plus de dispo sur les logements intéressants.

## 1.2 La proposition de valeur

Un lien unique qu'on balance dans le groupe. Chacun clique, met son prénom, et en 2 minutes se prononce sur tout ce qui compte. L'app tient le tableau, montre qui n'a pas encore répondu, et sort une décision par catégorie.

**Promesse en une phrase** : *décider des vacances du groupe en une soirée, sans compte à créer et sans remonter 400 messages.*

Quatre partis pris qui différencient de Doodle / Framadate :

1. **Multi-catégories** — un sondage couvre toute la décision (où, quand, combien, où dormir, quoi faire), pas une seule question.
2. **Zéro friction** — pas de compte, pas d'email, pas d'app à installer. Le lien suffit.
3. **Vote à l'aveugle optionnel** — on ne voit les votes des autres qu'après avoir donné le sien, pour un avis sincère.
4. **Aucune pression** — pas de date limite, pas de compte à rebours. Un sondage reste ouvert tant que le groupe n'a pas tranché. On se fait confiance.

## 1.3 Objectifs

### Objectifs produit

| # | Objectif | Indicateur de succès |
|---|---|---|
| O1 | Faire participer **tout** le groupe | ≥ 80 % des participants invités ont voté sur ≥ 1 catégorie sous 72 h |
| O2 | Rendre la décision rapide | Un sondage passe de « créé » à « toutes catégories clôturées » en ≤ 7 jours |
| O3 | Entrée sans friction | ≥ 90 % des personnes qui ouvrent le lien deviennent participantes (rejoignent) |
| O4 | Vote complet | ≥ 60 % des participants se prononcent sur *toutes* les catégories ouvertes |

### Objectifs techniques

- Application 100 % statique + Supabase : hébergement gratuit, aucune maintenance serveur.
- Mobile-first : 90 % des usages se feront depuis un téléphone, dans le canapé, en 2 minutes.
- Temps de chargement utile < 2 s en 4G ; bundle JS initial < 200 Ko gzip.
- Coût d'exploitation ≈ 0 € (tier gratuit Supabase + hébergement statique).

## 1.4 Personas

**Marie — l'organisatrice** (persona principale)
Crée le sondage, choisit les catégories, ajoute les premières propositions, relance les traînards, clôture les votes. Elle a besoin de *voir qui n'a pas répondu* et de *pouvoir trancher* quand le vote est serré. C'est elle qui installe l'outil dans le groupe : si elle galère, le projet meurt.

**Thomas — le pote motivé**
Ouvre le lien dans les 10 minutes, vote sur tout, ajoute deux propositions, commente. Il veut voir les résultats en direct et débattre.

**Julien — le pote fantôme** (persona critique)
Ouvre le lien 4 jours plus tard, depuis les toilettes, avec 12 % de batterie. Il votera **si et seulement si** ça prend moins de 90 secondes et qu'il n'a rien à installer ni à créer. Toute friction ajoutée le perd — c'est lui qui arbitre les décisions de design.

**Sarah — la pote serrée financièrement**
Ne dira jamais devant le groupe que 1200 € c'est hors de portée. Le vote budget doit lui permettre de peser sans se dénoncer : les montants individuels ne sont **jamais** attribués nominativement.

## 1.5 Périmètre

### Dans le périmètre (v1)

- Création d'un sondage de vacances avec catégories configurables.
- Partage par lien secret ; participation par pseudo, sans compte.
- Catégories natives : **destination**, **dates**, **budget**, **logement**, **activités**, + **catégorie libre**.
- Propositions ajoutées par l'organisateur, et par les participants si autorisé.
- Modes de vote : approbation (oui / peut-être / non), choix unique, choix multiple, grille de disponibilité, montant numérique.
- Dépouillement en direct, avec mode « vote à l'aveugle » optionnel.
- Clôture d'une catégorie par l'organisateur, avec option gagnante figée en décision.
- Commentaires par proposition.
- Suivi de participation : qui a voté, qui manque.
- Page de récapitulatif final partageable.
- Mises à jour temps réel (les votes des autres apparaissent sans rafraîchir).

### Hors périmètre (explicitement)

- **Réservation ou paiement** — l'app décide, elle ne réserve pas.
- **Gestion des dépenses / partage des frais** — c'est Tricount, pas nous.
- **Messagerie de groupe** — les commentaires sont attachés aux propositions, ce n'est pas un chat.
- **Comptes utilisateurs, profils persistants, historique inter-voyages** en v1.
- **Notifications push / email** en v1 (la relance se fait via le lien, dans le groupe WhatsApp existant).
- **Dates limites, comptes à rebours, rappels automatiques et tout autre mécanisme d'échéance** — décision de conception, pas un manque : voir ADR-009.
- **Application mobile native** — PWA au mieux.
- **Import automatique d'offres** (Airbnb, Booking, Skyscanner) — une proposition est saisie à la main, avec une URL facultative.
- **Multilingue** — FR uniquement en v1, mais le code est préparé pour l'i18n.

### Envisagé en v2 (documenté, non spécifié)

Vote par classement (Borda / Condorcet), notifications, aperçu enrichi des liens collés, exports (ICS pour les dates, PDF du récap), sondages récurrents pour un même groupe, mode « budget par poste ».

## 1.6 Contraintes

- **Techniques** : le repo est déjà un Vite + React 19 + TypeScript ; on part de là. Supabase imposé comme backend.
- **Sécurité** : le lien de partage *est* le secret. Modèle d'accès « capability-based », assumé et documenté (voir doc 07).
- **RGPD** : aucune donnée personnelle obligatoire (pseudo librement choisi, pas d'email). Purge automatique des sondages inactifs.
- **Équipe** : un seul développeur, en temps libre. Le découpage en lots (doc 06) doit livrer de la valeur dès le lot 1.
