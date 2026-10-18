# Audit du 18/10/2026 — builds, ingest RSS, partenariat Demos Kratos

Constat et plan. Tout a été fait **en lecture seule** sur la prod (Supabase MCP en
`select` uniquement, GitHub en lecture). Aucune donnée de prod n'a été modifiée.

---

## 1. Dernier APK + AAB et branche `main`

| | |
|---|---|
| Dernier build signé réussi | `Android package (signed APK + AAB)` run **#12**, 30/09/2026 |
| Branche / commit | `claude/blissful-cori-88ld94` @ `f161ee6` (« fix(ci): update Android SDK setup action ») |
| `main` | `f57d7dd` = merge de la PR #27 de cette même branche |
| Contenu | **Identique** : `main^{tree}` = `f161ee6^{tree}` = `ea78923` |

→ `main` correspond exactement au code du dernier APK/AAB.

À nettoyer : `.github/workflows/android-release.yml` (ancien AAB seul, remplacé par
`android-package.yml`) échoue **à chaque push** en 0 s (le nom affiché est le chemin du
fichier, signe d'un workflow que GitHub n'arrive pas à démarrer). Il fait doublon : le
supprimer.

---

## 2. « Ingest external RSS sources » en échec

Deux problèmes distincts.

### 2.1 Depuis le 17/10 : les jobs ne démarrent plus (bloquant)

- Les runs échouent en **2-3 s**, `runner_id = 0`, aucun log (HTTP 404) : aucun runner
  n'a été attribué, le script Python ne s'exécute même pas.
- Aucun run du keep-alive (lun/mer/ven) depuis le 30/09.
- Le dépôt est **privé** → les minutes Actions sont décomptées du quota du compte.

C'est la signature d'un blocage **facturation / quota Actions** (« The job was not started
because… spending limit / payment »). À vérifier sur
<https://github.com/settings/billing> → *Actions* (minutes consommées, moyen de paiement,
budget). Les jobs étant facturés à la minute entière, un cron toutes les 30 min revient à
environ 1 min par run.

Options :
1. Régler la facturation / relever le budget (immédiat).
2. Espacer le cron (`4,34 * * * *` → toutes les 2 h) : X/Le Figaro n'ont pas besoin de
   30 min.
3. À terme, sortir l'ingestion de GitHub Actions (voir 2.3).

### 2.2 Depuis le 21/08 : le flux X de Mélenchon est mort (ton intuition était juste)

| Source `fetch_via_github` | URL | État |
|---|---|---|
| `jean-luc-melenchon` (twitter) | `https://nitter.net/JLMelenchon/rss` | **HTTP 410 Gone**, `last_fetch_error = "no items parsed"`, dernier article le 20/08 |
| `lefigaro-politique` | `https://www.lefigaro.fr/rss/figaro_politique.xml` | OK (200), mais plus ingéré depuis le 11/10 faute de runner |

Le script ne sort en erreur que si **toutes** les sources échouent ; Le Figaro masquait
donc la panne X depuis deux mois.

Alternatives testées le 18/10 :

| Option | Résultat | Avis |
|---|---|---|
| `nitter.net` | 410 | mort |
| `xcancel.com` (`rss.xcancel.com`) | 302 → 451 | service RSS suspendu |
| `nitter.poast.org`, `nitter.privacydev.net` | 502 | morts |
| `lightbrd.com`, `nitter.space`, `shitter.thepixora.com` | 403 (anti-bot) | inutilisables |
| **`nitter.meowing.monster`** | **200, posts du 17/10** | marche **aujourd'hui**, mais instance bénévole : fragile |
| Bluesky `melenchon.bsky.social` | compte vide (0 post), ce n'est pas lui | non |
| **API X officielle (pay-per-use)** | ≈ 0,005 $ par post lu | fiable : ~1,5 $/mois pour 1 compte, ~20 $/mois pour 13 candidats |
| **`melenchon.fr/feed/`** (blog) | 200, RSS valide | contenu long, pas des tweets, mais stable |

Recommandation :
- **Court terme** (1 ligne en base, via l'admin) : `rss_url` → 
  `https://nitter.meowing.monster/JLMelenchon/rss`.
- **Robustesse** : fait, voir 2.3 (miroirs de repli, et le job échoue dès qu'une source
  échoue).
- **Durable** : API X pay-per-use avec `since_id` (seuls les nouveaux posts sont
  facturés) quand il y aura plusieurs candidats à suivre. Ajouter aussi le blog
  `melenchon.fr/feed/` et `lafranceinsoumise.fr/feed/` en sources `press` / candidat.

### 2.3 `nitter.meowing.monster` validé de bout en bout (en local)

Test du 18/10 : le flux meowing passe par le vrai code du workflow (`fetch_rss`) puis par
la vraie fonction `ingest-from-xml` (servie par Deno sur la base Supabase locale).

- 18 posts insérés, tous rattachés au candidat (`article_candidates`), 32 tags thème,
  13 images, 7 RT. Au 2e passage : 0 inséré (la déduplication par guid fonctionne).
- **Sortie identique à l'ancien nitter.net** : guid = id du post, `/status/<id>#m`,
  auteur `@handle`, images `/pic/media%2F…`, préfixe `RT by @…:`. Seule différence : des
  liens en `http://`.
- Côté app, `rewriteNitterUrl` / `rewriteNitterImage` (`src/lib/twitter.ts`) donnent
  bien `https://x.com/JLMelenchon/status/…` et `https://pbs.twimg.com/media/…` (testé).
  **Aucune mise à jour de l'APK n'est nécessaire.**
- `scripts/ingest_external_rss.py` :
  - **repli automatique** pour les sources `kind=twitter` : `rss_url`, puis
    `NITTER_MIRRORS` (meowing en premier). Une réponse sans `<item>`/`<entry>` (page
    anti-bot, suspension) compte comme un échec. Les miroirs doivent garder « nitter. »
    dans le nom d'hôte, sinon la regex de l'app ne réécrit pas les liens.
  - **le run échoue dès qu'une source échoue**, et non plus seulement si toutes
    échouent. Les autres sources sont quand même ingérées.
  - Tests en local : `nitter.net` (410) bascule sur meowing → exit 0 ; compte
    inexistant → les 4 miroirs échouent → exit 1.

### 2.4 Faire tourner les runners sur le dépôt public `cap2027-privacy` ?

Techniquement oui : sur un dépôt **public**, les runners GitHub standard sont gratuits et
sans quota. Points à connaître :

1. **Logs publics** : n'importe qui peut lire les logs des runs. Les secrets sont
   masqués automatiquement, mais tout ce que le script affiche est visible (slugs, URLs
   RSS, compteurs : rien de sensible ici). Pour Demos Kratos, n'afficher que des
   compteurs et le hash, jamais le contenu du listing FTP.
2. **Secrets** : à recréer dans ce dépôt (`INGEST_FROM_XML_TOKEN`, `DK_FTP_*`). Ne
   déclencher que sur `schedule` / `workflow_dispatch` : les PR de forks ne reçoivent
   pas les secrets.
3. **Désactivation après 60 jours sans activité** du dépôt public : prévoir un job
   mensuel qui réactive les workflows via l'API (`PUT
   /repos/{owner}/{repo}/actions/workflows/{id}/enable`), sinon l'ingestion s'arrêtera
   en silence.
4. **Conditions GitHub** : les CGU d'Actions excluent les usages « sans rapport avec le
   logiciel du dépôt ». Faire tourner le pipeline de CAP 2027 depuis le dépôt de la page
   de confidentialité est une zone grise, et l'ingestion actuelle depuis le dépôt privé
   l'est aussi. Risque faible à ce volume. Le plus propre : présenter ce dépôt public
   comme la **partie publique du projet CAP 2027** (page de confidentialité + scripts de
   collecte), README à l'appui.
5. Le code (`ingest_external_rss.py`, futur import DK) devient public : il ne contient
   aucun secret, la clé publishable Supabase étant publique par nature.

### 2.5 Autres sources en erreur (hors GitHub)

- `politis` : `https://www.politis.fr/feed/` renvoie un 301 vers la page d'accueil, le
  flux a disparu. Trouver la nouvelle URL ou désactiver la source.
- `lepoint-24h` : 403 DataDome (anti-bot), y compris depuis notre IP. Candidat à
  `fetch_via_github`, sans garantie.

---

## 3. Supabase en local

Installé dans la session (CLI 2.121.0 + Docker) :

```sh
supabase start          # Studio http://127.0.0.1:54323 · API http://127.0.0.1:54321
                        # DB postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

- `supabase/config.toml` ajouté (`supabase init` ; analytics désactivé, inutile en local).
- Les **71 migrations** du dépôt s'appliquent de bout en bout.
- **Dérive schéma corrigée** : `public.decode_html_entities(text)` existait en prod sans
  aucune migration (création manuelle), et le rejeu cassait sur
  `20260530000000_harden_function_search_path.sql`. Ajout de
  `20260529235959_create_decode_html_entities.sql` : définition identique à la prod, en
  `create or replace`, donc sans effet si elle est appliquée en prod.
- ⚠️ Les migrations contiennent l'URL de **prod** en dur (cron `ingest-rss`,
  `notify-after-ingest`, `fetch-parrainages`, triggers `push-broadcast`). En local, après
  un `supabase db reset`, lancer :
  ```sql
  select cron.unschedule(jobid) from cron.job;
  ```
  (Les secrets Vault sont absents en local, donc la prod répondrait de toute façon 401.
  À terme : lire l'URL des fonctions depuis `app_config` ou Vault plutôt qu'en dur.)
- Données : la base locale ne contient que les seeds des migrations (4 candidats contre
  13 en prod). Pour un miroir des tables de référence :
  `supabase db dump --data-only` avec le mot de passe DB (Settings → Database), à ne
  pas committer.

---

## 4. Partenariat Demos Kratos

### 4.1 Accès FTPS

- `filou.o2switch.net:21`, FTPS explicite. **Non joignable depuis mon conteneur** : le
  proxy sortant ne laisse passer que du HTTPS. L'analyse ci-dessous porte sur le zip
  envoyé (export du 16/10/2026 08:15 UTC).
- Identifiants : **non committés**, même dans un dépôt privé (ils resteraient dans
  l'historique git, les forks et les clones). À créer en secrets :
  - GitHub → Settings → Secrets → Actions : `DK_FTP_HOST`, `DK_FTP_USER`, `DK_FTP_PASSWORD`
  - et/ou `supabase secrets set DK_FTP_…` si l'import tourne dans une Edge Function.

### 4.2 Format de l'export (très propre)

Le dossier contient un `README.md` qui décrit le format, et deux JSON horodatés en UTC
(nom trié = ordre chronologique, ignorer les `.part`) :

| Fichier | Contenu (export du 16/10) |
|---|---|
| `demos-kratos-programmes-<ts>.json` (5 Mo) | 27 thèmes, 23 candidats, **4 116 mesures**, 277 synthèses, 883 affinités |
| `demos-kratos-match-<ts>.json` (55 Ko) | 41 affirmations, 13 candidats, 315 positions (`FOR` / `RATHER_FOR` / `RATHER_AGAINST` / `AGAINST`) |

- `meta.contentHash` (SHA-256) : **c'est le checksum demandé**. Un nouveau fichier n'est
  déposé que si les données changent ; on compare le hash à celui du dernier import.
  (Je n'ai pas réussi à le recalculer de mon côté, la canonicalisation n'est pas
  documentée, mais le README demande juste de le comparer.)
- Chaque fichier est **complet** (pas un différentiel) : remplacer intégralement.
- `id` UUID **stables** entre exports, à utiliser comme clés. Les `slug` peuvent changer.
- **Chaque objet porte une `url`** vers sa page sur demos-kratos.fr. Une mesure pointe
  par exemple vers
  `…/candidats/jean-luc-melenchon/themes/institutions/#mesure-<id>` : le lien « propulsé
  par » vers la page exacte se fait sans calcul.
- Qualité vérifiée : 0 mesure sans citation exacte, sans source ou sans description.
  274 mesures sont multi-thèmes (3 thèmes au plus) ; 1 786 sources sont des PDF.
- **Licence CC BY-NC 4.0** : attribution obligatoire (`meta.attribution`), **pas d'usage
  commercial**. Aucune pub ni achat intégré dans CAP 2027 aujourd'hui, donc compatible.
  À reconfirmer avec lui si l'app se monétise un jour, dons compris.

### 4.3 Correspondance avec notre base

**Candidats** (clé : `slug` au 1er import, puis `dk_id` stocké) :
- 12 en commun : philippe, retailleau, lisnard, melenchon, dupont-aignan, asselineau,
  philippot, ruffin, guedj, tondelier, batho, arthaud.
- Seulement chez nous : `clementine-autain`.
- Seulement chez DK (11) : roussel (231 mesures), branco (708), le-pen (106), attal
  (37), becht (44), egger (14), zemmour, bertrand, bouamrane, mikolajczak, dubuisson
  (0 mesure pour ces cinq derniers).
  → les créer en `is_published = false`, à valider dans l'admin.
- Note : en prod, **les 13 candidats sont actuellement `is_published = false`**.

**Thèmes** : 27 chez DK, 15 chez nous, sans « Europe » côté DK. Proposition :
- garder **la taxonomie DK** pour tout ce qui vient de DK (mesures, synthèses,
  comparateur, Match) ;
- **table de correspondance** `dk_theme → theme` pour relier programmes et actualités
  (les 15 thèmes restent pour le tagging presse) :

| Nos thèmes | Thèmes DK |
|---|---|
| economie | economie, fiscalite, industrie, agriculture* |
| social | travail, retraites, logement, politique-familiale, protection-sociale |
| ecologie | environnement, energie, protection-animale (agriculture*) |
| sante / education / securite / justice / immigration / sport | identiques |
| institutions | institutions, outre-mer |
| international | international, defense (europe : pas d'équivalent DK) |
| technologie | numerique, science |
| culture | culture |
| transports | transport |
| — | non-classe (ignoré) |

\* à trancher.

**Ce que l'export remplace ou enrichit :**

| Export DK | Chez nous aujourd'hui | Proposition |
|---|---|---|
| `measures[]` | `candidate_proposals` (5 lignes en seed, 0 en prod) | tables `dk_*` (titre, description, **citation exacte**, source, lien DK) |
| `syntheses[]` (global + par thème, chiffres clés) | `candidate_programs` (1 ligne en prod) | synthèses DK affichées dans la fiche programme |
| `affinities[]` (paires × thème, barre vert/jaune/rouge, commentaire, points) | rien | nouveau comparateur (4.5) |
| `match` (41 affirmations communes + 4 niveaux de position) | `candidate_match_propositions` (20 affirmations propres à Mélenchon, pas de positions) | Boussole v2 : affirmations communes × positions, bien plus juste |

### 4.4 Architecture d'import proposée

```
FTPS DK ──(job planifié)──► liste du dossier ─► dernier *.json (hors .part)
                                 │ nom ≠ dernier importé ?
                                 ▼
                     téléchargement + meta.contentHash ≠ dernier hash ?
                                 ▼
                 validation : format, version == 1, counts == longueur des tableaux
                                 ▼
          RPC dk_import(payload jsonb) : UNE transaction, remplacement complet
                                 ▼
                 dk_imports (fichier, hash, generatedAt, counts, statut)
```

- **Schéma** : tables miroir préfixées `dk_` (`dk_themes`, `dk_candidates`, `dk_measures`
  + `dk_measure_themes`, `dk_syntheses`, `dk_affinities` avec `points jsonb`,
  `dk_match_statements`, `dk_match_stances`, `dk_imports`) ; `candidates.dk_id uuid unique`
  et `dk_theme_map`. Le miroir reste séparé des tables éditées à la main dans l'admin :
  un import n'écrase jamais une saisie manuelle.
- **Où faire tourner le job** :
  1. **GitHub Actions + Python** (`ftplib.FTP_TLS` gère le FTPS explicite nativement),
     1 fois par jour : environ 30 min/mois. Recommandé, **une fois la facturation Actions
     réglée**. Le job POSTe le JSON vers une Edge Function `ingest-demos-kratos`
     (même modèle que `ingest-from-xml`, avec token).
  2. Edge Function Supabase + pg_cron : FTP en TCP depuis Deno (seuls les ports 25/587
     sont bloqués), sans dépendance à GitHub, mais FTPS moins éprouvé en Deno. Limites :
     2 s de CPU par requête, 150 s de durée en plan gratuit. Il faut donc laisser le gros
     du travail à la RPC SQL.
  3. Le plus simple pour tout le monde : demander à DK d'exposer le même dossier en
     **HTTPS** (répertoire protégé par mot de passe sur son hébergement o2switch).
     Lisible alors depuis une Edge Function, un script ou un navigateur.
- RLS : lecture `anon` sur les `dk_*` publiés, écriture via le service role uniquement.
- Notifs : éventuellement « Programme de X mis à jour » quand ses mesures changent (diff
  par candidat entre deux imports).

### 4.5 Comparateur : analyse du code de demos-kratos.fr/comparateur

Page Next.js (composant client `ComparateurClient`, graphiques Recharts). Les données
sont injectées dans la page : pas d'API, ce sont exactement les tableaux de l'export.

1. **Sélection** : grille de cartes candidat (case à cocher, avatar, parti), **3
   candidats maximum**. Les candidats sans programme sont grisés (« Programme non
   disponible »). La sélection est dans l'URL (`?c=slug,slug`), donc partageable.
2. **« Proximité — Ces candidats sont-ils proches ? »** : une carte par paire
   (« A ↔ B »), barre tricolore (vert convergentes / jaune différentes / rouge
   opposées, détail en % au toucher), commentaire global, puis une barre par thème triée
   par convergence décroissante (badge du thème → ancre vers le détail).
3. **« Vue d'ensemble — Répartition des mesures par thème (%) »** : barres horizontales,
   une couleur par candidat, triables par candidat, avec le nombre de mesures en
   infobulle.
4. **« Le face-à-face — Thème par thème, qui vous convainc ? »** : carrousel par thème
   (swipe, flèches clavier, pastilles, barre de progression « x thèmes tranchés »). Pour
   chaque thème : commentaire de la paire, sujets avec pictogramme de verdict (✓
   convergents, ≈ plutôt convergents, ≠ divergents, ✗ opposés), et pour chaque candidat
   la synthèse + 3 mesures phares + « Tout voir → ». Boutons « Le plus convaincant » /
   « Sans préférence » ; à la fin, **« Votre verdict »** (ou « Égalité »), décompte des
   thèmes et récap « Vos choix, thème par thème ». Rien n'est enregistré côté serveur.

Notre `Comparateur.tsx` actuel affiche seulement les `candidate_match_propositions` par
thème (vue cartes/colonnes). Les données DK permettent de reprendre les blocs 1, 2 et 4
presque tels quels. Le 4 est déjà pensé pour le mobile (swipe), donc il colle à l'app
Capacitor.

### 4.6 Le Match : ce que l'export DK apporte

**Aujourd'hui** (`PoliticalMatchGame.tsx`) : chaque carte est une proposition **d'un
seul candidat** (`candidate_match_propositions.candidate_id`). Le score d'un candidat est
+1 / −1 sur **ses seules** cartes. Conséquences :
- un « pour » sur une carte Mélenchon ne dit rien des autres candidats, même s'ils ont
  une position sur le sujet ;
- le résultat dépend du nombre de cartes par candidat (seul Mélenchon en a, 20) : la
  comparaison n'est pas équitable ;
- le score est un total brut (« +7 »), pas un pourcentage.

**Chez DK** (`demos-kratos-match-*.json` + méthode publiée sur
<https://demos-kratos.fr/swipe/methode/>) :
- **41 affirmations communes**, neutres et clivantes (3 par thème au plus), sur
  lesquelles **chaque candidat est positionné** : `FOR` / `RATHER_FOR` /
  `RATHER_AGAINST` / `AGAINST`, ou rien s'il n'aborde pas le sujet (13 candidats, 315
  positions, de 9 à 35 affirmations couvertes selon le candidat). Chaque position
  s'appuie sur un passage du programme ; en cas de doute, « non abordé ».
- L'utilisateur répond **pour / contre / passer**, exactement **nos trois gestes de
  swipe** (droite / gauche / haut). L'interface actuelle se garde telle quelle.
- Accord par affirmation :

  | Réponse \ candidat | pour | plutôt pour | plutôt contre | contre |
  |---|---|---|---|---|
  | Pour | 100 % | 75 % | 25 % | 0 % |
  | Contre | 0 % | 25 % | 75 % | 100 % |

- Score = (somme des accords + 3 × 0,5) ÷ (nb d'affirmations comparées + 3) : trois
  affirmations « fantômes » à 50 % évitent qu'un candidat à 2/2 affiche 100 %. Sont
  exclues les affirmations passées ou que le candidat n'aborde pas. En dessous de 5
  comparaisons : mention « peu de données ». Tri par score, puis par nombre de
  comparaisons.

**Verdict : oui, c'est exactement ce qui manque au Match.** Plan :
1. Tables `dk_match_statements` / `dk_match_stances` alimentées par l'import (fichier
   `match`, indépendant du fichier `programmes`).
2. `PoliticalMatchGame` : les cartes deviennent les affirmations, le calcul devient
   celui de DK, avec un affichage en % et la couverture « x/41 » par candidat. Bonus :
   le candidat le plus proche **par thème** (`statement.theme`).
3. Nouvelle clé de stockage des réponses (`cap2027.matchAnswers.v3`) : les réponses
   v2 portent sur les anciens id, on repart de zéro (l'app n'est pas encore publiée).
4. Adapter l'image de partage (`shareBoussoleResults`) au score en %.
5. Mentions : « Affirmations et positions : Demos Kratos » + lien `meta.url`, et lien
   « Comment est calculé le score ? » vers `meta.methodologyUrl`.
6. **À demander à DK** : ajouter dans `stances[]` la citation ou les `measureIds` qui
   justifient chaque position (leur méthode les a déjà). On pourrait alors afficher
   « Pourquoi ? » sous chaque résultat, avec la citation du programme.

`candidate_match_propositions` devient inutile pour le Match. Le `Comparateur.tsx`
actuel, qui s'en sert aussi, passera sur les mesures, synthèses et affinités DK (4.5).

### 4.7 Attribution « Propulsé par Demos Kratos »

- Sur chaque bloc issu de DK (mesure, synthèse, paire du comparateur, Match) : mention
  « Propulsé par Demos Kratos » qui ouvre **l'`url` de l'objet** (page exacte sur
  demos-kratos.fr), via `openLink` (navigateur in-app).
- Sur chaque mesure : **citation exacte + lien vers la source officielle**
  (`exactQuote`, `sourceUrl`), comme le demande le README.
- Écran « À propos / Sources » : texte `meta.attribution`, licence CC BY-NC 4.0 avec
  lien, date du dernier import (`generatedAt`).
- Bouton « Signaler une erreur » → page de la mesure sur DK (son lien « Signaler »).

---

## 5. Prochaines étapes proposées (dans l'ordre)

1. **Toi** : choisir où tournent les runners (dépôt public `cap2027-privacy`, cf. 2.4,
   ou facturation du dépôt privé) ; y créer les secrets `INGEST_FROM_XML_TOKEN` et
   `DK_FTP_*` ; dans l'admin, passer la source X sur
   `https://nitter.meowing.monster/JLMelenchon/rss`.
2. Supprimer `android-release.yml` et espacer le cron RSS. (Repli multi-instances
   nitter et échec visible : faits, cf. 2.3.)
3. Migration `dk_*` + RPC `dk_import`, testée **en local** avec le zip du 16/10.
4. Job d'import (GitHub Actions + `ftplib`), d'abord en *dry-run* (lecture FTP + rapport,
   sans écriture).
5. UI : fiches programme (mesures + citations + attribution), comparateur v2, Boussole v2.
6. Mise en prod : migration, puis premier import, puis publication des candidats.
