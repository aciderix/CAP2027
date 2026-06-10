# FICHE DE PUBLICATION PLAY STORE — CAP 2027

> Modèle universel rempli pour CAP 2027. Champs prêts à copier dans la Play Console.
> (Textes longs détaillés également dans `store/LISTING.md`.)

---

## Informations générales

**Nom de l'application**
```
CAP 2027
```

**Package Android**
```
fr.cap2027.app
```

**Version**
```
1.0.0
```

**Version Code**
```
1
```
> (premier dépôt = 1 ; à incrémenter à chaque nouvelle release : 2, 3, …)

**Catégorie**
```
Actualités et magazines  (News & Magazines)
```

**Type**
```
Application
```

**Email de contact**
```
introuvablesapps@gmail.com
```

**Site web (optionnel)**
```
https://cap2027.fr
```
> (à renseigner si le domaine est public ; sinon laisser vide)

**Politique de confidentialité**
```
https://cap2027.fr/confidentialite
```
> ⚠️ OBLIGATOIRE. Page à publier (je peux te rédiger le texte — voir note en bas).

---

## Store Listing

**Titre (≤ 30 caractères)**
```
CAP 2027
```

**Description courte (≤ 80 caractères)**
```
S'informer, comparer, choisir pour la présidentielle 2027. Neutre et sans compte.
```

**Description complète (≤ 4000 caractères)**
> Voir le texte complet dans `store/LISTING.md` (section « Description complète »).
> Résumé : agrégateur d'actualités tous bords + fact-checking, boussole politique
> anonyme, fiches candidats à égalité, programmes par thème, comparateur,
> notifications personnalisables, rappels civiques. 100 % neutre, sans compte,
> sans publicité, sans tracking.

---

## Traduction anglaise (optionnelle — recommandée si publication hors France)

**Title**
```
CAP 2027
```

**Short Description**
```
Follow France's 2027 election: balanced news, candidates, political compass.
```

**Full Description**
```
CAP 2027 is the independent civic app to follow the 2027 French presidential
election, neutrally. No account, no ads, no tracking.

DISCLAIMER — CAP 2027 is an INDEPENDENT app. It is not affiliated with, nor
endorsed by, any government or public authority. This is not an official app.
For any procedure, the app links to the official French government websites
(service-public.fr, maprocuration.gouv.fr, elections.interieur.gouv.fr).

• Balanced news feed — articles aggregated from media across the political
  spectrum plus fact-checking sources (full list below), each labelled by
  the orientation of its source and linking back to the original article.
• Political compass — answer questions on the key issues and discover which
  candidates you align with. No candidate names are shown during the test:
  you position yourself on ideas, not on people.
• Candidate profiles, presented equally — biography, party, programme,
  proposals, with the same layout for everyone.
• Follow your favourite candidates — add them to your watchlist and get their
  latest news, posts and videos in a personalised feed, with optional alerts.
• Programmes by topic, with original sources to verify every claim.
• Side-by-side comparison of two candidates.
• The voter toolkit — check your electoral registration, set up or receive a
  proxy vote, and get ready for election day. All procedures link to the
  official government websites (service-public.fr, maprocuration.gouv.fr,
  elections.interieur.gouv.fr), with civic reminders for every key deadline.
• Notifications you control by category, plus civic reminders so you never
  miss a key date.

OUR SOURCES
Press — Left: Blast, L'Humanité, Libération, Mediapart, Politis, Reporterre ·
Centre: France 24, France Info, Le Monde, Le Point · Centre-right: L'Express,
L'Opinion, Le Figaro · Right: Causeur, Le JDD, Valeurs Actuelles · Transverse:
Atlantico, Marianne.
Fact-checking: 20 Minutes (Fake Off), CheckNews (Libération), Les Décodeurs
(Le Monde). Plus the candidates' official public accounts (X, YouTube).
The up-to-date list is available in the app (More → Methodology & sources);
every article links back to its original source.

Our commitments: strict neutrality, privacy (no account, no ad cookies, no
personal data shared), independence (not affiliated with any party, candidate,
media, or government / public authority — this is not an official app), and
100% free.
```

---

## Visuels requis

| Élément | Spéc | Fichier (dans `store/assets/`) | État |
|---|---|---|---|
| Icône | 512×512 PNG 32-bit, fond opaque | `icon-512.png` | ✅ |
| Feature Graphic | 1024×500 PNG/JPG | `feature-graphic.png` | ✅ |
| Captures téléphone | min 2, reco 4–8, ratio ≤ 2:1 | `screenshot-*.png` (×5) ou tes vraies captures | ✅ |
| Captures tablette | optionnel | — | ❌ (non requis) |

---

## App Content

### Politique de confidentialité
```
https://cap2027.fr/confidentialite
```

### Sécurité des données (Data Safety)

**L'application collecte-t-elle des données ?**
```
Oui — uniquement un identifiant technique de notification (token push)
```

**L'application partage-t-elle des données ?**
```
Non (le token transite par Google Firebase Cloud Messaging, prestataire
technique nécessaire à l'envoi des notifications — pas un partage commercial)
```

**Types de données collectées**
```
- Identifiants de l'appareil : token de notification push (anonyme), uniquement
  pour envoyer les notifications si l'utilisateur les active.
Aucune autre donnée : pas de compte, pas de nom, pas d'email, pas de
localisation, pas de contacts, pas de données financières ni de santé.
```

**Données supprimables par l'utilisateur**
```
Oui — le token est supprimé automatiquement à la désinstallation de l'app
ou à la désactivation des notifications.
```

**Chiffrement des données**
```
Oui (HTTPS / TLS en transit)
```

> Détail des réponses dans `store/LISTING.md` (section Data safety).

### Publicité
**L'application contient-elle des publicités ?**
```
Non
```

**Audience cible**
```
18 ans et plus
```
> Recommandé : contenu d'actualité politique. Cibler 18+ évite les contraintes
> de la politique « Familles » de Google. (Tu peux aussi cocher 16-17 si tu veux
> élargir, mais 18+ est le plus simple pour une app politique.)

---

## Questionnaire IARC (classification du contenu)

**Email**
```
introuvablesapps@gmail.com
```

**Catégorie**
```
Other  (ou « News » si proposé)
```

| Question | Réponse |
|---|---|
| Violence | Non |
| Nudité / Sexualité | Non |
| Langage grossier | Non |
| Drogues / Alcool / Tabac | Non |
| Jeux d'argent | Non |
| Horreur / Contenu effrayant | Non |
| Chat ou interaction utilisateurs | Non |
| Partage de localisation | Non |
| Achats intégrés | Non |
| Contenu généré par les utilisateurs | Non |

> Note : l'app diffuse des actualités issues de la presse (contenu éditorial
> tiers). Il n'y a ni contenu généré par les utilisateurs, ni interaction
> sociale, ni messagerie. Classification attendue : tout public / PEGI 3,
> mais l'audience cible 18+ est choisie pour le thème politique.

---

## Tarification

**Type**
```
Gratuite
```

**Prix**
```
0,00 €
```

**Régions de publication**
```
France (puis Europe / Monde si tu veux élargir)
```

---

## Informations techniques

**Format de livraison**
```
Android App Bundle (.aab)  — produit par le workflow GitHub android-package.yml
```

**Signature**
```
Play App Signing activé (recommandé) + keystore d'upload (secrets GitHub)
```

**SDK**
```
minSdkVersion 24 (Android 7.0)   •   targetSdkVersion 36
```

**Permissions utilisées**
```
INTERNET                 — récupérer actualités, candidats, programmes
POST_NOTIFICATIONS       — afficher les notifications (Android 13+)
WAKE_LOCK                — vérification périodique des nouveaux articles
RECEIVE_BOOT_COMPLETED   — relancer la vérification après redémarrage
FOREGROUND_SERVICE       — tâche de fond du background-runner
```

**Justification des permissions sensibles**
```
Aucune permission sensible (pas de caméra, localisation, micro, contacts,
stockage). Les permissions ci-dessus servent uniquement à récupérer le contenu
et à envoyer/afficher les notifications. Aucune donnée personnelle n'est
collectée ni envoyée hors de l'envoi des notifications.
```

---

## Checklist finale

- [ ] AAB signé (workflow `android-package.yml`)
- [ ] Version Code incrémenté
- [ ] Politique de confidentialité publiée (URL) ⚠️ à faire
- [ ] Data Safety complété
- [ ] Questionnaire IARC rempli
- [ ] Audience cible définie (18+)
- [ ] Publicité déclarée (Non)
- [ ] Captures d'écran ajoutées
- [ ] Icône ajoutée
- [ ] Feature Graphic ajoutée
- [ ] Pays sélectionnés
- [ ] Test interne effectué
- [ ] Release créée
- [ ] Validation Play Store reçue

---

## ⚠️ Seul élément bloquant restant : la politique de confidentialité

Google **refuse** la publication sans une **URL publique** de politique de
confidentialité. Comme l'app ne collecte qu'un token de notification anonyme,
une page simple suffit. Je peux te rédiger le **texte complet prêt à publier**
(cohérent avec les réponses Data Safety ci-dessus) — il te restera juste à
l'héberger (sur cap2027.fr, ou une page gratuite type GitHub Pages / Notion).
