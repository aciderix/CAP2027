# CAP 2027 — Guide d'intégration des données réelles

> Document de préparation. Liste exhaustive de ce qu'il faut produire **par candidat**,
> l'état actuel, les médias inclus, et les conseils d'intégration.
> Tout se saisit via le **dashboard admin** (site Netlify séparé, même repo, dossier `admin/`).

---

## 1. Vue d'ensemble — entités à remplir

| Entité | Table | Portée |
|---|---|---|
| Candidat (fiche) | `candidates` | 1 par candidat |
| Parti | `parties` | partagé entre candidats |
| Sections de biographie | `candidate_bio_sections` | N par candidat |
| Programme par thème | `candidate_programs` | 1 par thème abordé |
| Propositions détaillées | `candidate_proposals` | N par candidat |
| Propositions Boussole | `candidate_match_propositions` | N par candidat (comparateur) |
| Affaires judiciaires | `candidate_affairs` | N par candidat (optionnel) |
| Alias (détection presse) | `candidate_aliases` | N par candidat |
| Résultats électoraux | `election_results` | après le scrutin |

---

## 2. FICHE CANDIDAT — `candidates`

À produire pour **chaque** candidat :

| Champ | Obligatoire | Format / valeurs | Notes |
|---|---|---|---|
| `first_name` | ✅ | texte | Prénom |
| `last_name` | ✅ | texte | Nom |
| `slug` | ✅ | texte-sans-accents (ex: `marine-tondelier`) | Identifiant URL, unique |
| `gender` | ⬜ | `M` / `F` | Pour accords ("candidat·e") |
| `photo_url` | ⭐ recommandé | URL image | Portrait. Hébergé où tu veux (URL publique) |
| `birth_date` | ⬜ | `AAAA-MM-JJ` | Date de naissance |
| `birth_place` | ⬜ | texte | Lieu de naissance |
| `party_id` | ⭐ | référence parti | Voir section Partis |
| `status` | ✅ | `declared` / `pressenti` / `withdrawn` | Déclaré / pressenti / retiré |
| `declared_at` | ⬜ | `AAAA-MM-JJ` | Date de déclaration de candidature |
| `sponsorships_count` | auto | entier | Parrainages obtenus (peut être alimenté auto) |
| `sponsorships_target` | défaut 500 | entier | Cible (500 par défaut) |
| `short_bio` | ⭐ | texte court (1-2 phrases) | Affiché sur la carte candidat |
| `website_url` | ⬜ | URL | Site officiel |
| `is_published` | ✅ | oui/non | **Mettre `oui` pour qu'il apparaisse dans l'app** |
| `order_index` | ⬜ | entier | Ordre d'affichage |

**Minimum vital pour publier** : first_name, last_name, slug, status, photo_url, party_id, short_bio, is_published=oui.

---

## 3. BIOGRAPHIE — `candidate_bio_sections`

Sections structurées de la fiche bio (ex: "Parcours", "Carrière politique", "Positions").

| Champ | Obligatoire | Format |
|---|---|---|
| `title` | ✅ | texte (titre de section) |
| `content` | ✅ | texte (paragraphe, peut être long) |
| `order_index` | ✅ | entier (ordre d'affichage) |

➡️ **Produire ~3 sections par candidat** (c'est le standard déjà en place pour les fiches remplies).

---

## 4. PROGRAMME PAR THÈME — `candidate_programs`

Synthèse du programme du candidat, **un bloc par thème** (parmi les 15 thèmes de l'app).

| Champ | Obligatoire | Format |
|---|---|---|
| `theme_id` | ✅ | un des 15 thèmes (Écologie, Économie, …) |
| `intro` | ⬜ | texte court d'introduction |
| `content` | ✅ | texte (le programme sur ce thème) |
| `order_index` | ✅ | entier |

➡️ **Idéalement 1 bloc par thème pertinent** (un candidat n'a pas forcément les 15). Vise les thèmes phares de chaque candidat.

**Les 15 thèmes** : Écologie · Économie · Social · Santé · Sécurité · Éducation · Europe · Justice · Immigration · Institutions & Politique · International · Technologie & Numérique · Culture & Loisirs · Sport · Transports & Mobilité.

---

## 5. PROPOSITIONS DÉTAILLÉES — `candidate_proposals`

Mesures concrètes, plus granulaires que le programme.

| Champ | Obligatoire | Format |
|---|---|---|
| `theme_id` | ✅ | un des 15 thèmes |
| `title` | ✅ | texte (intitulé de la mesure) |
| `content` | ⬜ | texte (détail) |
| `source_url` | ⭐ | URL | Source vérifiable (programme officiel…) |
| `order_index` | ✅ | entier |

➡️ Quantité libre. Plus il y en a, plus la fiche est riche. **Mettre une source à chaque fois** (l'app se veut factuelle/vérifiable).

---

## 6. PROPOSITIONS BOUSSOLE — `candidate_match_propositions`

⚠️ **Le plus important pour le comparateur (Boussole).** Ce sont les affirmations sur lesquelles l'utilisateur se positionne (d'accord / pas d'accord), puis l'app calcule son affinité avec chaque candidat.

| Champ | Obligatoire | Format |
|---|---|---|
| `theme_id` | ✅ | un des 15 thèmes |
| `text` | ✅ | texte (une affirmation claire, ex: « Instaurer un ISF climatique ») |
| `is_active` | ✅ | oui/non (oui pour entrer dans la Boussole) |
| `order_index` | ✅ | entier |

➡️ **Pour que la Boussole soit pertinente, il faut le MÊME jeu de thématiques couvert par tous les candidats.** Référence actuelle : **Mélenchon a 20 propositions**. Vise un nombre comparable et cohérent entre candidats (ex: 15–20 chacun, répartis sur les thèmes), sinon la comparaison est biaisée.

**💡 Conseil méthodo** : définis d'abord une liste de ~15-20 "sujets" transverses (un par grande question), puis pour chaque candidat écris sa position sur CHAQUE sujet. Ça garantit une comparaison équitable.

---

## 7. AFFAIRES JUDICIAIRES — `candidate_affairs` (optionnel)

| Champ | Obligatoire | Format / valeurs |
|---|---|---|
| `title` | ✅ | texte |
| `description` | ⬜ | texte |
| `status` | ✅ | `mis_en_examen` / `en_cours` / `classee` / `condamnation` / `relaxe` |
| `date` | ⬜ | `AAAA-MM-JJ` |
| `source_urls` | ✅ | liste d'URL (sources vérifiables — **obligatoire**) |
| `order_index` | ✅ | entier |

➡️ Sujet sensible : **toujours des sources solides et multiples**. Neutralité = factuel uniquement.

---

## 8. ALIAS DE DÉTECTION — `candidate_aliases`

Variantes de nom pour que le système de tagging presse rattache automatiquement les articles au candidat.

| Champ | Obligatoire | Format |
|---|---|---|
| `alias` | ✅ | texte (ex: `Mélenchon`, `JLM`, `Jean-Luc Mélenchon`) |

➡️ **Produire 3-7 alias par candidat** : nom seul, prénom+nom, initiales connues, handles. Accent-insensible (pas besoin de doubler avec/sans accent).
**Référence : Mélenchon en a 7.** C'est le seul candidat équipé actuellement — **tous les autres ont 0 alias**, donc aucun article ne leur est rattaché. C'est une priorité.

---

## 9. PARTIS — `parties` (entité partagée)

11 partis déjà créés. À compléter :

| Champ | Obligatoire | Format |
|---|---|---|
| `name` | ✅ | texte |
| `abbreviation` | ⭐ | texte (LFI, RN, PS…) |
| `color` | ⭐ | hex (#RRGGBB) |
| `logo_url` | ⭐ | URL image |

**État actuel** : 11 partis ont nom + abréviation + couleur, mais **seul LFI a un logo**. → **10 logos de partis à fournir.**

Partis existants : La France Insoumise (LFI), Horizons (HOR), Les Républicains (LR), Debout la France (DLF), Union Populaire Républicaine (UPR), Les Patriotes (PAT), Parti Socialiste (PS), Les Écologistes (EELV), Génération Écologie (GE), Lutte Ouvrière (LO), Picardie Debout (PD).
⚠️ Il manquera notamment **Renaissance, Rassemblement National, Reconquête** si tu ajoutes les candidats correspondants.

---

## 10. RÉSULTATS ÉLECTORAUX — `election_results` (après le scrutin)

| Champ | Format |
|---|---|
| `round` | 1 ou 2 |
| `candidate_id` | référence candidat |
| `percentage` | numérique (ex: 23.45) |
| `votes` | entier |
| `is_qualified` | oui/non (qualifié 2e tour) |
| `is_winner` | oui/non |
| `rank` | entier (classement) |

➡️ À remplir le soir des résultats. Le push « Résultats du tour » est déjà câblé.

---

## 11. MÉDIAS INCLUS (sources presse par bord)

Pour info — base de l'agrégation d'actualités, classée par orientation :

### 🟥 Gauche (presse)
Blast · L'Humanité · Libération · Mediapart · Politis · Reporterre

### ⚪ Centre (presse)
France 24 · France Info Politique · Le Monde Politique · Le Point

### 🟦 Centre-droit (presse)
L'Express Politique · L'Opinion · Le Figaro Politique · Les Échos Politique

### 🟫 Droite (presse)
Causeur · Le JDD · Valeurs Actuelles

### 🟪 Transverse
Atlantico · Marianne

### ✅ Fact-checking
20 Minutes (Fake Off) · AFP Factuel · CheckNews (Libération) · Les Décodeurs (Le Monde)

### 📱 Réseaux / vidéo (lié à un candidat)
Mélenchon : compte X (via Nitter), YouTube

**Déséquilibre à corriger** : la droite/centre-droit a moins de sources que la gauche, et seul Mélenchon a des sources réseaux. Pour l'équité, prévoir d'ajouter des comptes X/YouTube **pour chaque candidat** (table `news_sources`, `kind` = twitter/youtube, `candidate_id` renseigné, `orientation` cohérente).

---

## 12. ÉTAT ACTUEL PAR CANDIDAT

| Candidat | Publié | Photo | Bio | Parti | Bio-sect. | Prog. | Propos. | Boussole | Affaires | Alias |
|---|---|---|---|---|---|---|---|---|---|---|
| Édouard Philippe | ✅ | ✅ | ✅ | ✅ | 3 | 1 | 0 | 0 | 0 | 0 |
| Jean-Luc Mélenchon | ✅ | ✅ | ✅ | ✅ | 3 | 0 | 0 | **20** | 0 | **7** |
| Bruno Retailleau | ❌ | ✅ | ✅ | ✅ | 3 | 0 | 0 | 0 | 0 | 0 |
| David Lisnard | ❌ | ✅ | ✅ | ✅ | 3 | 0 | 0 | 0 | 0 | 0 |
| Nicolas Dupont-Aignan | ❌ | ✅ | ❌ | ✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| François Asselineau | ❌ | ✅ | ✅ | ✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| Florian Philippot | ❌ | ✅ | ✅ | ✅ | 3 | 0 | 0 | 0 | 0 | 0 |
| François Ruffin | ❌ | ✅ | ✅ | ✅ | 3 | 0 | 0 | 0 | 0 | 0 |
| Clémentine Autain | ❌ | ✅ | ✅ | ❌ | 3 | 0 | 0 | 0 | 0 | 0 |
| Jérôme Guedj | ❌ | ✅ | ✅ | ✅ | 3 | 0 | 0 | 0 | 0 | 0 |
| Marine Tondelier | ❌ | ✅ | ✅ | ✅ | 3 | 0 | 0 | 0 | 0 | 0 |
| Delphine Batho | ❌ | ✅ | ✅ | ✅ | 3 | 0 | 0 | 0 | 0 | 0 |
| Nathalie Arthaud | ❌ | ✅ | ❌ | ✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| *Tzdr Test / Gesye Tesy* | (tests) | — | — | — | — | — | — | — | — | — |

➡️ **2 candidats de test à supprimer** (Tzdr Test, Gesye Tesy).

---

## 13. CHECKLIST PAR CANDIDAT (à dupliquer pour chacun)

```
[ ] Fiche : slug, gender, naissance, parti, statut, declared_at, short_bio, website, photo
[ ] 3 sections de biographie
[ ] Programme : 1 bloc par thème pertinent (avec intro)
[ ] Propositions détaillées (avec source_url chacune)
[ ] Boussole : 15-20 propositions (mêmes thèmes que les autres candidats !)
[ ] Affaires judiciaires (si pertinent, sources multiples obligatoires)
[ ] 3-7 alias de détection presse
[ ] Sources réseaux : compte X + YouTube (table news_sources)
[ ] Passer is_published = oui
```

---

## 14. ORDRE D'INTÉGRATION RECOMMANDÉ

1. **Nettoyer** : supprimer les 2 candidats de test.
2. **Partis** : compléter les 10 logos manquants + créer Renaissance/RN/Reconquête si besoin.
3. **Alias** (rapide, gros impact) : 3-7 alias pour CHAQUE candidat → débloque le rattachement automatique des articles. Priorité car aujourd'hui seul Mélenchon en a.
4. **Boussole** : définir le jeu commun de ~15-20 sujets, puis remplir pour chaque candidat (cœur de la valeur de l'app).
5. **Fiches** : compléter bio courte + sections + programme par candidat.
6. **Propositions détaillées** : enrichissement progressif.
7. **Publier** : passer `is_published=oui` candidat par candidat une fois prêt.
8. **Sources réseaux** par candidat (équité de couverture presse).

---

## 15. POINTS DE VIGILANCE

- **Neutralité** : présentation identique pour tous, sources vérifiables systématiques.
- **Boussole équitable** : même grille de thèmes/sujets pour tous, sinon le calcul d'affinité est biaisé.
- **Cohérence orientation** : pour les sources réseaux par candidat, mettre l'orientation cohérente (sert au filtre de notifs par bord).
- **Photos/logos** : URLs publiques stables (éviter les liens qui expirent).
- **Chaque modification déclenche une notif** (`candidate_updated`, `new_programme`…) → si tu fais une grosse session de saisie, garde en tête que ça peut générer des pushs (ou fais-le avant publication).
