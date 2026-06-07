#!/usr/bin/env python3
# Génère les visuels de la fiche Play Store pour CAP 2027.
# Captures "marketing" neutres avec placeholders (Candidat·e 1, silhouettes
# bleue/rouge de l'app, contenus factices) reflétant chaque fonctionnalité.
#
# Sortie: store/assets/*.png
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
OUT = os.path.join(ROOT, "store", "assets")
os.makedirs(OUT, exist_ok=True)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

S = 2  # supersampling pour un rendu net

# ---- palette ----
NAVY = (16, 42, 92)
NAVY2 = (28, 58, 120)
BLUE = (26, 86, 219)
RED = (210, 53, 58)
WHITE = (255, 255, 255)
S50 = (248, 250, 252)
S100 = (241, 245, 249)
S200 = (226, 232, 240)
S300 = (203, 213, 225)
S400 = (148, 163, 184)
S500 = (100, 116, 139)
S600 = (71, 85, 105)
INK = (16, 42, 92)

THEME = {
    "Écologie": (22, 163, 74), "Économie": (245, 158, 11), "Social": (236, 72, 153),
    "Santé": (239, 68, 68), "Sécurité": (30, 64, 175), "Éducation": (124, 58, 237),
    "Europe": (14, 165, 233), "Justice": (15, 118, 110), "Immigration": (147, 51, 234),
    "International": (185, 28, 28), "Institutions": (71, 85, 105), "Sport": (234, 179, 8),
    "Culture": (217, 70, 239), "Transports": (51, 65, 85),
}
ORIENT = {
    "Gauche": (225, 72, 61), "Centre": (100, 116, 139), "Centre-droit": (37, 99, 235),
    "Droite": (30, 58, 138), "Fact-check": (22, 163, 74),
}

def F(sz, bold=True):
    return ImageFont.truetype(FB if bold else FR, sz * S)

def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle([box[0]*S, box[1]*S, box[2]*S, box[3]*S], radius=r*S,
                        fill=fill, outline=outline, width=width*S)

def text(d, xy, s, font, fill, anchor=None, spacing=4):
    d.text((xy[0]*S, xy[1]*S), s, font=font, fill=fill, anchor=anchor, spacing=spacing*S)

# ---- mini icônes vectorielles (coords logiques) ----
def L(d, pts, col, w):
    d.line([(x*S, y*S) for x, y in pts], fill=col, width=max(1, int(w*S)), joint="curve")
def E(d, box, fill=None, outline=None, w=1):
    d.ellipse([box[0]*S, box[1]*S, box[2]*S, box[3]*S], fill=fill, outline=outline, width=max(1, int(w*S)))

def ic_news(d, cx, cy, r, col):
    rr(d, (cx-r, cy-r*0.8, cx+r, cy+r*0.8), 5, outline=col, width=3)
    for i, yy in enumerate([cy-r*0.4, cy, cy+r*0.4]):
        L(d, [(cx-r*0.6, yy), (cx+r*0.6 if i else cx+r*0.1, yy)], col, 3)

def ic_user(d, cx, cy, r, col):
    E(d, (cx-r*0.42, cy-r*0.9, cx+r*0.42, cy-r*0.06), outline=col, w=3)
    d.arc([(cx-r*0.75)*S, (cy+0.05*r)*S, (cx+r*0.75)*S, (cy+r*1.3)*S], 180, 360, fill=col, width=3*S)

def ic_mega(d, cx, cy, r, col):
    d.polygon([((cx-r*0.8)*S,(cy-r*0.35)*S), ((cx+r*0.2)*S,(cy-r*0.7)*S),
               ((cx+r*0.2)*S,(cy+r*0.7)*S), ((cx-r*0.8)*S,(cy+r*0.35)*S)],
              outline=col, width=3*S)
    L(d, [(cx+r*0.45, cy-r*0.3),(cx+r*0.45, cy+r*0.3)], col, 3)

def ic_vote(d, cx, cy, r, col):
    rr(d, (cx-r*0.8, cy-r*0.2, cx+r*0.8, cy+r*0.8), 5, outline=col, width=3)
    L(d, [(cx-r*0.3, cy-r*0.2),(cx-r*0.3, cy-r*0.55),(cx+r*0.5, cy-r*0.55),(cx+r*0.5, cy-r*0.2)], col, 3)
    L(d, [(cx-r*0.25, cy+r*0.35),(cx-r*0.05, cy+r*0.55),(cx+r*0.35, cy+r*0.12)], col, 4)

def ic_lock(d, cx, cy, r, col):
    rr(d, (cx-r*0.7, cy-r*0.05, cx+r*0.7, cy+r*0.85), 6, fill=col)
    d.arc([(cx-r*0.45)*S, (cy-r*0.75)*S, (cx+r*0.45)*S, (cy+r*0.35)*S], 180, 360, fill=col, width=4*S)

def ic_link(d, cx, cy, r, col):
    d.arc([(cx-r)*S,(cy-r*0.45)*S,(cx)*S,(cy+r*0.45)*S], 40, 250, fill=col, width=3*S)
    d.arc([(cx)*S,(cy-r*0.45)*S,(cx+r)*S,(cy+r*0.45)*S], 220, 70, fill=col, width=3*S)

def tw(d, s, font):
    return d.textlength(s, font=font) / S

def wrap(d, s, font, maxw):
    words = s.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if tw(d, t, font) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def vgrad(w, h, top, bot):
    img = Image.new("RGB", (w, h), top)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bot[i]-top[i])*t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img

# ---------- canvas screenshot avec bandeau caption ----------
# 1080x2160 = ratio 2:1 exact (le Play Store exige max 2:1 pour les
# captures téléphone — au-delà, l'upload est refusé).
W, H = 1080, 2160          # logique (avant supersampling)
CAP_H = 430                # hauteur bandeau marketing

def new_shot(headline, subline):
    img = Image.new("RGB", (W*S, H*S), WHITE)
    # bandeau navy en dégradé
    band = vgrad(W*S, CAP_H*S, NAVY, NAVY2)
    img.paste(band, (0, 0))
    d = ImageDraw.Draw(img)
    # petite barre tricolore
    rr(d, (60, 70, 96, 82), 6, fill=BLUE)
    rr(d, (100, 70, 136, 82), 6, fill=WHITE)
    rr(d, (140, 70, 176, 82), 6, fill=RED)
    text(d, (60, 96), "CAP 2027", F(30), (180, 200, 235))
    # headline (wrap)
    hf = F(58)
    lines = wrap(d, headline, hf, W-120)
    y = 150
    for ln in lines:
        text(d, (60, y), ln, hf, WHITE)
        y += 70
    sf = F(30, bold=False)
    for ln in wrap(d, subline, sf, W-120):
        text(d, (60, y+8), ln, sf, (188, 205, 235))
        y += 42
    return img, d

def finish(img, name):
    out = img.resize((W, H), Image.LANCZOS)
    out.save(os.path.join(OUT, name))
    print("wrote", name)

# zone "écran app" sous le bandeau
SX0, SY0 = 0, CAP_H
def card_img(path, box):
    im = Image.open(path).convert("RGBA")
    tw_, th_ = (box[2]-box[0])*S, (box[3]-box[1])*S
    im = im.resize((tw_, th_), Image.LANCZOS)
    return im

# helper: badge pill
def pill(d, x, y, label, color, fg=WHITE, padx=16, h=40, font=None):
    font = font or F(22)
    w = tw(d, label, font) + padx*2
    rr(d, (x, y, x+w, y+h), h/2, fill=color)
    text(d, (x+w/2, y+h/2), label, font, fg, anchor="mm")
    return w

# bottom nav bar commun
def bottom_nav(d, active=0):
    ny = H - 120
    rr(d, (0, ny, W, H), 0, fill=WHITE)
    d.line([(0, ny*S), (W*S, ny*S)], fill=S200, width=2*S)
    tabs = ["Accueil", "Explorer", "Mon fil", "Actus", "Candidats"]
    n = len(tabs)
    for i, t in enumerate(tabs):
        cx = (i+0.5) * (W/n)
        col = NAVY if i == active else S400
        # pastille icône
        rr(d, (cx-16, ny+26, cx+16, ny+58), 9, fill=(col if i==active else None),
           outline=(None if i==active else col), width=3)
        text(d, (cx, ny+86), t, F(18, bold=i==active), col, anchor="mm")

# ============ ÉCRAN 1 : ACTUALITÉS ============
def shot_actus():
    img, d = new_shot("Toute l'actu politique,\ntous les bords réunis",
                      "Agrégateur neutre : presse de gauche, centre, droite et fact-checking.")
    y = SY0 + 40
    text(d, (60, y), "Actualités", F(44), INK)
    y += 86
    # chips filtres orientation
    x = 60
    for lab, col in [("Tous", NAVY)] + list(ORIENT.items()):
        active = lab == "Tous"
        if active:
            x += pill(d, x, y, lab, NAVY) + 14
        else:
            w = tw(d, lab, F(22)) + 32
            rr(d, (x, y, x+w, y+40), 20, outline=S300, width=2)
            text(d, (x+w/2, y+20), lab, F(22, bold=False), S600, anchor="mm")
            x += w + 14
        if x > W-160:
            break
    y += 78
    # cartes articles
    samples = [
        ("Gauche", "Réforme des retraites : ce que prévoit la nouvelle proposition", "Il y a 2 h"),
        ("Centre", "Budget 2027 : les arbitrages attendus cette semaine", "Il y a 3 h"),
        ("Droite", "Sécurité : le débat relancé après les annonces", "Il y a 5 h"),
        ("Fact-check", "Vérifié : non, ce chiffre sur l'emploi est trompeur", "Hier"),
    ]
    for orient, title, when in samples:
        rr(d, (40, y, W-40, y+220), 24, fill=WHITE, outline=S200, width=2)
        # vignette
        rr(d, (64, y+28, 244, y+192), 16, fill=S100)
        text(d, (154, y+110), "IMG", F(24, bold=False), S400, anchor="mm")
        col = ORIENT[orient]
        pill(d, 272, y+28, orient, col)
        text(d, (272+tw(d,orient,F(22))+60, y+48), when, F(20, bold=False), S400, anchor="lm")
        tf = F(28)
        ty = y+86
        for ln in wrap(d, title, tf, W-340)[:3]:
            text(d, (272, ty), ln, tf, INK)
            ty += 40
        y += 244
    bottom_nav(d, active=3)
    finish(img, "screenshot-1-actus.png")

# ============ ÉCRAN 2 : BOUSSOLE ============
def shot_boussole():
    img, d = new_shot("Trouvez les candidats\nqui vous ressemblent",
                      "Positionnez-vous sur les grandes questions, obtenez votre affinité.")
    cx = W/2
    y = SY0 + 70
    text(d, (cx, y), "Boussole", F(44), INK, anchor="mm")
    text(d, (cx, y+58), "Question 7 / 20", F(24, bold=False), S500, anchor="mm")
    # barre progression
    rr(d, (120, y+96, W-120, y+112), 8, fill=S200)
    rr(d, (120, y+96, 120+(W-240)*0.35, y+112), 8, fill=BLUE)
    # cartes empilées (effet pile) derrière
    cy = y+170
    rr(d, (140, cy-26, W-140, cy+10), 32, fill=S100)
    rr(d, (115, cy-14, W-115, cy+20), 32, fill=S200)
    # carte proposition principale
    CH = 900
    rr(d, (90, cy, W-90, cy+CH), 32, fill=WHITE, outline=S200, width=2)
    pill(d, 130, cy+44, "Écologie", THEME["Écologie"])
    qf = F(44)
    qy = cy+150
    quote = "« Investir massivement dans les transports en commun, même au prix d'une hausse d'impôts. »"
    for ln in wrap(d, quote, qf, W-260):
        text(d, (130, qy), ln, qf, INK)
        qy += 62
    # silhouette candidat (placeholder)
    sil = card_img(os.path.join(PUB, "card_blue.png"), (0,0, 220, 300))
    img.paste(sil, (int((cx-110)*S), int((cy+440)*S)), sil)
    text(d, (cx, cy+770), "Candidat·e 1", F(28, bold=False), S500, anchor="mm")
    text(d, (cx, cy+820), "Glissez la carte ou choisissez ci-dessous", F(22, bold=False), S400, anchor="mm")
    # boutons d'accord / pas d'accord
    by = cy+CH+50
    rr(d, (90, by, cx-20, by+110), 26, fill=S100)
    text(d, ((90+cx-20)/2, by+55), "Pas d'accord", F(30), S600, anchor="mm")
    rr(d, (cx+20, by, W-90, by+110), 26, fill=BLUE)
    text(d, ((cx+20+W-90)/2, by+55), "D'accord", F(30), WHITE, anchor="mm")
    finish(img, "screenshot-2-boussole.png")

# ============ ÉCRAN 3 : CANDIDATS ============
def shot_candidats():
    img, d = new_shot("Tous les candidats,\nà égalité",
                      "Fiches neutres, mêmes informations pour chacun. Aucun parti pris.")
    y = SY0 + 40
    text(d, (60, y), "Candidats", F(44), INK)
    y += 90
    cards = [("Candidat 1","Parti A","blue"),("Candidate 2","Parti B","red"),
             ("Candidat 3","Parti C","blue"),("Candidate 4","Parti D","red"),
             ("Candidate 5","Parti E","red"),("Candidat 6","Parti F","blue")]
    cw = (W-40*2-30)/2
    ch = 420
    for i,(name,party,kind) in enumerate(cards):
        col = i % 2
        row = i // 2
        x0 = 40 + col*(cw+30)
        y0 = y + row*(ch+30)
        rr(d, (x0, y0, x0+cw, y0+ch), 24, fill=WHITE, outline=S200, width=2)
        path = os.path.join(PUB, "card_blue.png" if kind=="blue" else "card_red.png")
        ph = card_img(path, (0,0, int(cw-48), 250))
        img.paste(ph, (int((x0+24)*S), int((y0+24)*S)), ph)
        text(d, (x0+cw/2, y0+300), name, F(28), INK, anchor="mm")
        pill(d, x0+cw/2 - (tw(d,party,F(20))+32)/2, y0+330, party, S100, fg=S600)
    bottom_nav(d, active=4)
    finish(img, "screenshot-3-candidats.png")

# ============ ÉCRAN 4 : FICHE / PROGRAMME ============
def shot_programme():
    img, d = new_shot("Programmes détaillés,\nsources vérifiables",
                      "Le programme thème par thème, avec les sources d'origine.")
    y = SY0 + 30
    # header candidat
    rr(d, (40, y, W-40, y+250), 24, fill=S50, outline=S200, width=2)
    ph = card_img(os.path.join(PUB, "card_red.png"), (0,0, 150, 210))
    img.paste(ph, (int(70*S), int((y+20)*S)), ph)
    text(d, (250, y+50), "Candidate 2", F(40), INK)
    pill(d, 250, y+110, "Parti B", S100, fg=S600)
    text(d, (250, y+180), "Déclarée · 142 parrainages", F(24, bold=False), S500)
    y += 290
    # onglets thèmes
    x = 50
    for lab in ["Économie","Écologie","Social","Santé"]:
        active = lab=="Écologie"
        col = THEME[lab]
        w = tw(d, lab, F(24)) + 36
        if active:
            rr(d, (x, y, x+w, y+50), 25, fill=col)
            text(d, (x+w/2, y+25), lab, F(24), WHITE, anchor="mm")
        else:
            rr(d, (x, y, x+w, y+50), 25, outline=S300, width=2)
            text(d, (x+w/2, y+25), lab, F(24, bold=False), S600, anchor="mm")
        x += w + 16
    y += 80
    # blocs programme
    blocks = [
        ("Transition énergétique", "Objectif neutralité carbone : plan d'investissement, rénovation thermique et sortie progressive des énergies fossiles."),
        ("Biodiversité", "Protection des espaces naturels, réduction des pesticides et création de nouvelles aires protégées."),
        ("Mobilités durables", "Développement du ferroviaire et des transports en commun, soutien au vélo et aux véhicules propres."),
    ]
    for title, body in blocks:
        rr(d, (40, y, W-40, y+300), 24, fill=WHITE, outline=S200, width=2)
        rr(d, (64, y+30, 76, y+90), 6, fill=THEME["Écologie"])
        text(d, (96, y+34), title, F(30), INK)
        by = y+96
        for ln in wrap(d, body, F(25, bold=False), W-160)[:4]:
            text(d, (96, by), ln, F(25, bold=False), S600)
            by += 38
        # lien source
        ic_link(d, 108, y+262, 18, BLUE)
        text(d, (140, y+250), "Source : programme officiel", F(22, bold=False), BLUE)
        y += 324
    finish(img, "screenshot-4-programme.png")

# ============ ÉCRAN 5 : COMPARATEUR ============
def shot_comparateur():
    img, d = new_shot("Comparez les programmes\ncôte à côte",
                      "Deux candidats, thème par thème, d'un coup d'œil.")
    y = SY0 + 40
    text(d, (W/2, y), "Comparateur", F(44), INK, anchor="mm")
    y += 80
    # deux têtes
    colw = (W-40*2-30)/2
    for i,(name,kind) in enumerate([("Candidat 1","blue"),("Candidate 2","red")]):
        x0 = 40 + i*(colw+30)
        rr(d, (x0, y, x0+colw, y+230), 24, fill=S50, outline=S200, width=2)
        ph = card_img(os.path.join(PUB, "card_blue.png" if kind=="blue" else "card_red.png"), (0,0,120,168))
        img.paste(ph, (int((x0+colw/2-60)*S), int((y+20)*S)), ph)
        text(d, (x0+colw/2, y+205), name, F(26), INK, anchor="mm")
    y += 270
    rows = [("Économie", "Baisse des impôts", "Hausse ISF"),
            ("Écologie", "Nucléaire", "Renouvelables"),
            ("Social", "Retraite 64 ans", "Retraite 60 ans"),
            ("Sécurité", "+ d'effectifs", "Prévention"),
            ("Europe", "Souveraineté", "Fédéralisme")]
    for theme, a, b in rows:
        rr(d, (40, y, W-40, y+150), 20, fill=WHITE, outline=S200, width=2)
        col = THEME[theme]
        pill(d, 64, y+22, theme, col)
        text(d, (64+colw/2, y+105), a, F(24, bold=False), S600, anchor="mm")
        d.line([((W/2)*S, (y+20)*S), ((W/2)*S,(y+130)*S)], fill=S200, width=2*S)
        text(d, (W/2+colw/2, y+105), b, F(24, bold=False), S600, anchor="mm")
        y += 170
    bottom_nav(d, active=1)
    finish(img, "screenshot-5-comparateur.png")

# ============ ÉCRAN 6 : NOTIFS / NEUTRALITÉ ============
def shot_notifs():
    img, d = new_shot("Vous choisissez\nce que vous recevez",
                      "Notifications par catégorie. Rappels civiques pour ne rien manquer.")
    y = SY0 + 50
    text(d, (60, y), "Notifications", F(44), INK)
    y += 100
    rows = [("Actualités presse", "Nouveaux articles des médias", True, ic_news),
            ("Candidats suivis", "Publications des candidats", True, ic_user),
            ("Mises à jour candidats", "Programmes, propositions", False, ic_mega),
            ("Rappels électoraux", "Inscription, procuration, vote", None, ic_vote)]
    for title, desc, state, icfn in rows:
        rr(d, (40, y, W-40, y+150), 24, fill=WHITE, outline=S200, width=2)
        rr(d, (66, y+38, 140, y+112), 18, fill=S100)
        icfn(d, 103, y+75, 26, NAVY)
        text(d, (170, y+44), title, F(30), INK)
        text(d, (170, y+92), desc, F(23, bold=False), S500)
        # toggle
        tx0 = W-180
        if state is None:
            pill(d, tx0-20, y+58, "Toujours", S100, fg=S500, font=F(20))
        else:
            col = NAVY if state else S300
            rr(d, (tx0, y+58, tx0+96, y+106), 24, fill=col)
            knob = tx0+58 if state else tx0+10
            d.ellipse([knob*S, (y+64)*S, (knob+36)*S, (y+100)*S], fill=WHITE)
        y += 174
    # bandeau neutralité
    rr(d, (40, y+10, W-40, y+180), 24, fill=(240,247,255), outline=(199,222,255), width=2)
    ic_lock(d, 80, y+52, 22, NAVY)
    text(d, (116, y+38), "100 % neutre & sans compte", F(28), NAVY)
    for i, ln in enumerate(["Aucune inscription, aucun tracking publicitaire.",
                            "Tous les candidats traités à égalité."]):
        text(d, (72, y+96+i*38), ln, F(23, bold=False), S600)
    finish(img, "screenshot-6-notifs.png")

# ============ FEATURE GRAPHIC 1024x500 ============
def feature_graphic():
    w, h = 1024, 500
    img = vgrad(w*S, h*S, NAVY, (24, 54, 110))
    d = ImageDraw.Draw(img)
    # logo app
    logo = Image.open(os.path.join(PUB, "logo-cap2027.png")).convert("RGBA").resize((150*S,150*S), Image.LANCZOS)
    img.paste(logo, (70*S, 80*S), logo)
    # tricolore
    d.rounded_rectangle([250*S,110*S,290*S,128*S], radius=6*S, fill=BLUE)
    d.rounded_rectangle([298*S,110*S,338*S,128*S], radius=6*S, fill=WHITE)
    d.rounded_rectangle([346*S,110*S,386*S,128*S], radius=6*S, fill=RED)
    d.text((250*S,150*S), "CAP 2027", font=F(72), fill=WHITE)
    d.text((252*S,240*S), "Présidentielle 2027 — informez-vous,", font=F(34, bold=False), fill=(190,208,238))
    d.text((252*S,288*S), "comparez, trouvez votre boussole.", font=F(34, bold=False), fill=(190,208,238))
    # puces
    feats = ["Actualités tous bords", "Boussole politique", "Programmes & comparateur"]
    yy = 366
    for fz in feats:
        d.ellipse([252*S, (yy+8)*S, (252+16)*S, (yy+24)*S], fill=BLUE)
        d.text((282*S, yy*S), fz, font=F(28), fill=WHITE)
        yy += 44
    out = img.resize((w, h), Image.LANCZOS)
    out.save(os.path.join(OUT, "feature-graphic.png"))
    print("wrote feature-graphic.png")

# icône 512 (copie)
def icon():
    Image.open(os.path.join(PUB, "icon-512.png")).convert("RGBA").save(os.path.join(OUT, "icon-512.png"))
    print("wrote icon-512.png")

if __name__ == "__main__":
    shot_actus()
    shot_boussole()
    shot_candidats()
    shot_programme()
    shot_comparateur()
    shot_notifs()
    feature_graphic()
    icon()
    print("done ->", OUT)
