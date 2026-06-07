# Dossier fiche Play Store — CAP 2027

Tout le nécessaire pour publier la fiche de l'application sur le Google Play Store.

```
store/
├── LISTING.md              ← tous les textes (titre, descriptions, data safety…)
├── README.md               ← ce fichier (specs + checklist)
└── assets/
    ├── icon-512.png        ← icône app (512×512)
    ├── feature-graphic.png ← bannière Play Store (1024×500)
    ├── poster.png          ← affiche promo verticale (1200×1800) — réseaux/presse/web
    ├── screenshot-1-actus.png      ← Actualités tous bords
    ├── screenshot-2-boussole.png   ← Boussole / Match politique
    ├── screenshot-3-fiche.png      ← Fiche candidat (bio, onglets)
    ├── screenshot-4-candidats.png  ← Liste des candidats
    └── screenshot-5-notifs.png     ← Notifications personnalisables
```

Esthétique : mockups de téléphone encadrés (ombres douces) sur fond bleu clair
dégradé, logo réutilisé depuis `public/logo1.png` (jamais recréé).

> ⚠️ **Visuels = PLACEHOLDERS NEUTRES.** Les captures utilisent des candidats
> fictifs (« Candidat·e 1 », silhouettes bleue/rouge de l'app, partis « A/B/C »)
> et des contenus factices, volontairement, pour rester neutre tant que les
> candidats réels ne sont pas confirmés. À regénérer avec de vraies captures
> quand les données seront intégrées (voir plus bas).
>
> 📌 `poster.png` n'est PAS un emplacement Play Store (le Store n'a pas de slot
> « affiche »). C'est un visuel promo bonus pour les réseaux sociaux, la presse
> ou une page web.

---

## Spécifications Google Play (rappel)

| Élément | Format requis | Fourni |
|---|---|---|
| Icône appli | 512×512 PNG 32-bit | ✅ 512×512 |
| Bannière (feature graphic) | **1024×500** PNG/JPEG | ✅ 1024×500 |
| Captures téléphone | 320–3840 px/côté, **ratio max 2:1**, min 2 captures | ✅ 1080×2160 (2:1), ×5 |
| Captures 7" / 10" (tablette) | optionnel | ❌ (non requis) |

Captures fournies : **6** (Google demande au minimum 2, recommande 4–8).

---

## Checklist de publication

- [ ] Créer l'app dans la Play Console (nom : CAP 2027)
- [ ] Copier le **titre** et la **description courte** depuis `LISTING.md`
- [ ] Copier la **description complète**
- [ ] Uploader **icône** + **feature graphic** + **6 captures** (`assets/`)
- [ ] Renseigner **catégorie** (Actualités et magazines)
- [ ] Renseigner l'**e-mail** de contact
- [ ] Mettre en ligne une **politique de confidentialité** (URL obligatoire) et la renseigner
- [ ] Remplir le questionnaire **Data safety** (réponses dans `LISTING.md`)
- [ ] Remplir le questionnaire de **classification du contenu**
- [ ] Uploader l'**AAB signé** (workflow GitHub `android-package.yml`)
- [ ] Renseigner les **notes de version** (`LISTING.md`)
- [ ] Soumettre pour examen

---

## Regénérer les visuels

Les visuels sont produits par un script Pillow :

```bash
pip install Pillow
python3 scripts/gen_store_assets.py
```

Le script lit les assets de marque dans `public/` (logo, silhouettes
`card_blue.png` / `card_red.png`, `icon-512.png`) et écrit dans `store/assets/`.

**Pour passer aux vraies captures** (quand les candidats seront intégrés), deux options :
1. Remplacer manuellement les fichiers `assets/screenshot-*.png` par de vraies
   captures d'écran de l'app (au format 1080×2160 ou tout ratio ≤ 2:1).
2. Adapter `scripts/gen_store_assets.py` avec les vrais noms/données.
