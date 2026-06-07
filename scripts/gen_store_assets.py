#!/usr/bin/env python3
# Visuels Play Store CAP 2027 — style premium : mockups de téléphone
# encadrés, ombres douces, fond bleu clair dégradé, tuiles d'icônes.
# Contenu = placeholders NEUTRES (Candidat·e 1, silhouettes de l'app).
# Le logo n'est PAS recréé : on réutilise public/logo1.png (wordmark).
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
OUT = os.path.join(ROOT, "store", "assets")
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
S = 2

# palette
NAVY=(16,42,92); NAVY2=(28,58,120); BLUE=(26,86,219); RED=(214,55,60)
WHITE=(255,255,255); S50=(248,250,252); S100=(241,245,249); S200=(226,232,240)
S300=(203,213,225); S400=(148,163,184); S500=(100,116,139); S600=(71,85,105)
GOLD=(245,184,30)
THEME={"Écologie":(22,163,74),"Économie":(245,158,11),"Social":(236,72,153),
 "Société":(124,58,237),"Sécurité":(30,64,175),"Europe":(14,165,233)}
ORI={"Gauche":(225,72,61),"Centre":(100,116,139),"C.-droit":(37,99,235),"Droite":(30,58,138)}

def f(sz,bold=True): return ImageFont.truetype(FB if bold else FR, int(sz*S))
def RR(d,b,r,fill=None,outline=None,w=1):
    d.rounded_rectangle([b[0]*S,b[1]*S,b[2]*S,b[3]*S],radius=r*S,fill=fill,outline=outline,width=max(1,int(w*S)))
def T(d,xy,s,font,fill,anchor=None,sp=4):
    d.text((xy[0]*S,xy[1]*S),s,font=font,fill=fill,anchor=anchor,spacing=sp*S)
def TW(d,s,font): return d.textlength(s,font=font)/S
def wrap(d,s,font,mw):
    out,cur=[],""
    for w in s.split():
        t=(cur+" "+w).strip()
        if TW(d,t,font)<=mw: cur=t
        else:
            if cur: out.append(cur)
            cur=w
    if cur: out.append(cur)
    return out
def L(d,pts,col,w): d.line([(x*S,y*S) for x,y in pts],fill=col,width=max(1,int(w*S)),joint="curve")
def E(d,b,fill=None,outline=None,w=1): d.ellipse([b[0]*S,b[1]*S,b[2]*S,b[3]*S],fill=fill,outline=outline,width=max(1,int(w*S)))

def load(path,w=None,h=None):
    im=Image.open(path).convert("RGBA")
    if w and not h: h=int(im.height*w/im.width)
    if w: im=im.resize((int(w*S),int(h*S)),Image.LANCZOS)
    return im
def fade(im,a):
    r,g,b,al=im.split(); al=al.point(lambda p:int(p*a)); return Image.merge("RGBA",(r,g,b,al))

# ---- icônes ----
def i_news(d,cx,cy,r,col):
    RR(d,(cx-r,cy-r*.8,cx+r,cy+r*.8),5,outline=col,w=3)
    for i,yy in enumerate([cy-r*.4,cy,cy+r*.4]): L(d,[(cx-r*.6,yy),(cx+(r*.6 if i else r*.1),yy)],col,3)
def i_heart(d,cx,cy,r,col):
    E(d,(cx-r*.5,cy-r*.85,cx+r*.1,cy-r*.2),outline=col,w=3)  # tête
    d.arc([(cx-r*.8)*S,(cy-r*.1)*S,(cx+r*.4)*S,(cy+r*1.1)*S],180,360,fill=col,width=3*S)
    # petit cœur
    hx,hy=cx+r*.45,cy-r*.1
    E(d,(hx-r*.32,hy-r*.18,hx,hy+r*.05),fill=col); E(d,(hx,hy-r*.18,hx+r*.32,hy+r*.05),fill=col)
    d.polygon([((hx-r*.3)*S,(hy)*S),((hx+r*.3)*S,(hy)*S),(hx*S,(hy+r*.45)*S)],fill=col)
def i_scale(d,cx,cy,r,col):
    L(d,[(cx,cy-r*.8),(cx,cy+r*.7)],col,3); L(d,[(cx-r*.7,cy-r*.5),(cx+r*.7,cy-r*.5)],col,3)
    for sx in (cx-r*.7,cx+r*.7):
        d.arc([(sx-r*.35)*S,(cy-r*.5)*S,(sx+r*.35)*S,(cy+r*.2)*S],0,180,fill=col,width=3*S)
    L(d,[(cx-r*.4,cy+r*.7),(cx+r*.4,cy+r*.7)],col,3)
def i_check(d,cx,cy,r,col):
    E(d,(cx-r*.85,cy-r*.85,cx+r*.85,cy+r*.85),outline=col,w=3)
    L(d,[(cx-r*.4,cy),(cx-r*.1,cy+r*.35),(cx+r*.45,cy-r*.35)],col,4)
def i_bell(d,cx,cy,r,col):
    d.arc([(cx-r*.6)*S,(cy-r*.7)*S,(cx+r*.6)*S,(cy+r*.5)*S],180,360,fill=col,width=3*S)
    L(d,[(cx-r*.6,cy-r*.1),(cx-r*.6,cy+r*.3)],col,3); L(d,[(cx+r*.6,cy-r*.1),(cx+r*.6,cy+r*.3)],col,3)
    L(d,[(cx-r*.75,cy+r*.3),(cx+r*.75,cy+r*.3)],col,3); E(d,(cx-r*.12,cy+r*.4,cx+r*.12,cy+r*.62),fill=col)
def i_gear(d,cx,cy,r,col):
    E(d,(cx-r*.7,cy-r*.7,cx+r*.7,cy+r*.7),outline=col,w=3); E(d,(cx-r*.25,cy-r*.25,cx+r*.25,cy+r*.25),fill=col)
def star(d,cx,cy,r,col):
    import math
    pts=[]
    for k in range(10):
        ang=-math.pi/2+k*math.pi/5; rr=r if k%2==0 else r*.45
        pts.append(((cx+rr*math.cos(ang))*S,(cy+rr*math.sin(ang))*S))
    d.polygon(pts,fill=col)

# ---- device frame + shadow ----
def frame(screen,tilt=0):
    bez=int(16*S); rs=int(46*S); rb=int(60*S)
    sw,sh=screen.size; bw,bh=sw+2*bez,sh+2*bez
    body=Image.new("RGBA",(bw,bh),(0,0,0,0)); bd=ImageDraw.Draw(body)
    bd.rounded_rectangle([0,0,bw,bh],radius=rb,fill=(15,21,38,255))
    mask=Image.new("L",(sw,sh),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,sw,sh],radius=rs,fill=255)
    body.paste(screen,(bez,bez),mask)
    nw,nh=int(150*S),int(30*S)
    bd.rounded_rectangle([(bw-nw)//2,bez+int(10*S),(bw+nw)//2,bez+int(10*S)+nh],radius=nh//2,fill=(15,21,38,255))
    if tilt: body=body.rotate(tilt,expand=True,resample=Image.BICUBIC)
    return body
def shadow(canvas,obj,x,y,blur=34,alpha=95,dy=22):
    sh=Image.new("RGBA",canvas.size,(0,0,0,0))
    col=Image.new("RGBA",obj.size,(18,38,78,alpha))
    sil=Image.composite(col,Image.new("RGBA",obj.size,(0,0,0,0)),obj.split()[3])
    sh.paste(sil,(x,y+int(dy*S)),sil); sh=sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh)

# ---- backgrounds ----
def grad(w,h,top,bot):
    im=Image.new("RGB",(w,h),top); px=im.load()
    for yy in range(h):
        t=yy/max(1,h-1); c=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3))
        for xx in range(w): px[xx,yy]=c
    return im.convert("RGBA")

# ===================== APP SCREEN RENDERERS =====================
SW,SH=720,1560
def screen_base(countdown=True):
    im=Image.new("RGBA",(SW*S,SH*S),(255,255,255,255)); d=ImageDraw.Draw(im)
    # app bar
    lg=load(os.path.join(PUB,"logo1.png"),w=120); im.alpha_composite(lg,(int(28*S),int(34*S)))
    i_bell(d,SW-92,62,16,NAVY); i_gear(d,SW-44,62,16,NAVY)
    if countdown:
        RR(d,(28,104,SW-28,150),12,fill=S100)
        T(d,(46,116),"⏱",f(20),NAVY)  # may box; replaced by clock icon
        d.ellipse([(44)*S,(118)*S,(60)*S,(134)*S],outline=NAVY,width=2*S); L(d,[(52,121),(52,126),(56,128)],NAVY,2)
        T(d,(74,116),"-9 mois avant le 1er tour",f(22,False),S600)
    return im,d
def nav(d,active=0):
    ny=SH-104; RR(d,(0,ny,SW,SH),0,fill=WHITE); d.line([(0,ny*S),(SW*S,ny*S)],fill=S200,width=2*S)
    tabs=[("Accueil",i_check),("Explorer",i_gear),("Mon fil",i_news),("Actus",i_news),("Plus",None)]
    labels=["Accueil","Explorer","Mon fil","Actus","Plus"]; n=5
    for i,lab in enumerate(labels):
        cx=(i+.5)*(SW/n); col=BLUE if i==active else S400
        if i==active:
            E(d,(cx-26,ny+18,cx+26,ny+70),fill=BLUE)
        # simple glyph
        gcol=WHITE if i==active else col
        if i==2: i_news(d,cx,ny+44,13,gcol)
        else: E(d,(cx-11,ny+33,cx+11,ny+55),outline=gcol,w=3)
        T(d,(cx,ny+84),lab,f(16,i==active),NAVY if i==active else S400,anchor="mm")

def s_actus():
    im,d=screen_base();
    # hero card bleu
    RR(d,(28,168,SW-28,360),20,fill=NAVY)
    T(d,(52,190),"FIL D'ACTUALITÉ",f(18),(150,178,228))
    T(d,(52,220),"Toute l'actualité présidentielle",f(30),WHITE)
    for i,ln in enumerate(["200 articles agrégés des principaux","titres de la presse française."]):
        T(d,(52,266+i*30),ln,f(21,False),(196,212,240))
    # search
    RR(d,(28,384,SW-28,440),14,outline=S300,w=2); E(d,(50,402,74,426),outline=S400,w=3)
    T(d,(92,400),"Rechercher dans le fil...",f(21,False),S400)
    # chips orientations
    T(d,(30,462),"ORIENTATIONS SUIVIES",f(16),S400)
    x=28
    for k,(lab,_) in enumerate([("Toutes",0)]+list(ORI.items())):
        active=lab=="Toutes"; w=TW(d,lab,f(19))+30
        if active: RR(d,(x,490,x+w,530),20,fill=NAVY); T(d,(x+w/2,510),lab,f(19),WHITE,anchor="mm")
        else: RR(d,(x,490,x+w,530),20,outline=S300,w=2); T(d,(x+w/2,510),lab,f(19,False),S600,anchor="mm")
        x+=w+12
    T(d,(30,548),"THÈMES",f(16),S400)
    x=28
    for k,lab in enumerate(["Tous","Écologie","Économie","Social","Société"]):
        active=lab=="Tous"; w=TW(d,lab,f(19))+30
        col=THEME.get(lab,NAVY)
        if active: RR(d,(x,576,x+w,616),20,fill=NAVY); T(d,(x+w/2,596),lab,f(19),WHITE,anchor="mm")
        else: RR(d,(x,576,x+w,616),20,outline=S300,w=2); T(d,(x+w/2,596),lab,f(19,False),S600,anchor="mm")
        x+=w+12
    # article card
    ay=648; RR(d,(28,ay,SW-28,ay+760),20,fill=WHITE,outline=S200,w=2)
    img=grad(int((SW-56)*S),int(420*S),(210,222,240),(150,170,205))
    m=Image.new("L",img.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,img.size[0],img.size[1]],radius=int(18*S),fill=255)
    im.paste(img,(int(28*S),int(ay*S)),m)
    E(d,(SW/2-26,ay+184,SW/2+26,ay+236),fill=(255,255,255)); d.polygon([((SW/2-8)*S,(ay+196)*S),((SW/2-8)*S,(ay+224)*S),((SW/2+14)*S,(ay+210)*S)],fill=NAVY)
    # tag orientation
    RR(d,(52,ay+44,52+TW(d,"GAUCHE",f(17))+28,ay+82),8,fill=ORI["Gauche"]); T(d,(66,ay+52),"GAUCHE",f(17),WHITE)
    ty=ay+470
    for ln in wrap(d,"Présidentielle 2027 : temps fort de campagne attendu ce week-end",f(28),SW-110):
        T(d,(52,ty),ln,f(28),NAVY); ty+=38
    T(d,(52,ay+700),"il y a 1 h",f(20,False),S400)
    nav(d,active=2)
    return im
def s_match():
    im,d=screen_base(countdown=False)
    # tabs
    x=28
    for lab in ["Candidats","Programmes","Boussole"]:
        active=lab=="Boussole"; w=TW(d,lab,f(21))+36
        if active: RR(d,(x,168,x+w,220),26,fill=NAVY); T(d,(x+w/2,194),lab,f(21),WHITE,anchor="mm")
        else: RR(d,(x,168,x+w,220),26,fill=S100); T(d,(x+w/2,194),lab,f(21,False),S600,anchor="mm")
        x+=w+14
    RR(d,(28,252,SW-28,560),22,fill=S50,outline=S200,w=2)
    T(d,(52,280),"Match politique",f(32),NAVY)
    for i,ln in enumerate(["Répondez à des propositions anonymes","et découvrez avec quels candidats","vous êtes le plus compatible."]):
        T(d,(52,326+i*32),ln,f(21,False),S600)
    RR(d,(52,440,260,500),16,fill=BLUE); T(d,(156,470),"Lancer le test",f(22),WHITE,anchor="mm")
    # jauge
    gx,gy=SW-160,406
    E(d,(gx-86,gy-86,gx+86,gy+86),outline=S200,w=12)
    d.arc([(gx-86)*S,(gy-86)*S,(gx+86)*S,(gy+86)*S],-90,-90+int(360*.78),fill=THEME["Écologie"],width=int(12*S))
    T(d,(gx,gy-8),"78%",f(34),NAVY,anchor="mm"); T(d,(gx,gy+28),"compatible",f(16,False),S500,anchor="mm")
    # à la une
    T(d,(30,600),"À LA UNE",f(18),S400)
    RR(d,(28,628,SW-28,800),18,fill=WHITE,outline=S200,w=2)
    sil=load(os.path.join(PUB,"card_blue.png"),w=110,h=150); im.alpha_composite(sil,(int(50*S),int(648*S)))
    for i,ln in enumerate(["Quel avenir pour","l'école publique ?"]):
        T(d,(190,664+i*40),ln,f(26),NAVY)
    T(d,(190,748),"Débat entre les candidats",f(20,False),S500)
    nav(d,active=1)
    return im
def s_fiche():
    im,d=screen_base(countdown=False)
    d.line([(0,150*S),(SW*S,150*S)],fill=S100,width=2*S)
    sil=load(os.path.join(PUB,"card_red.png"),w=120,h=165); im.alpha_composite(sil,(int(40*S),int(180*S)))
    T(d,(190,196),"Candidate 1",f(34),NAVY)
    T(d,(190,246),"Parti A",f(22,False),S500)
    RR(d,(SW-188,188,SW-40,232),22,fill=(255,247,224)); star(d,SW-168,210,12,GOLD); T(d,(SW-150,198),"Suivi",f(20),(180,120,20))
    T(d,(190,286),"candidate1.fr",f(20,False),BLUE)
    # tabs
    x=28
    for lab,active in [("Bio",True),("Prog.",False),("Affaires",False),("Actus",False)]:
        w=TW(d,lab,f(20))+34
        if active: RR(d,(x,372,x+w,424),26,fill=NAVY); T(d,(x+w/2,398),lab,f(20),WHITE,anchor="mm")
        else: RR(d,(x,372,x+w,424),26,fill=S100); T(d,(x+w/2,398),lab,f(20,False),S600,anchor="mm")
        x+=w+12
    body=("Personnalité politique française, figure de son courant. A officiellement "
          "annoncé sa candidature à l'élection présidentielle de 2027. Engagée de longue "
          "date sur les questions sociales et écologiques.")
    yy=458
    for ln in wrap(d,body,f(22,False),SW-90): T(d,(45,yy),ln,f(22,False),S600); yy+=34
    T(d,(45,yy+20),"Parcours",f(26),NAVY); yy+=64
    body2=("Née en 1970, elle débute sa carrière dans la vie associative avant de "
           "s'engager en politique. Élue locale puis parlementaire, elle s'impose comme "
           "une voix de sa famille politique.")
    for ln in wrap(d,body2,f(22,False),SW-90): T(d,(45,yy),ln,f(22,False),S600); yy+=34
    return im

def s_candidats():
    im,d=screen_base(countdown=False)
    T(d,(28,176),"Candidats",f(34),NAVY)
    cards=[("Candidat 1","Parti A","blue"),("Candidate 2","Parti B","red"),
           ("Candidat 3","Parti C","blue"),("Candidate 4","Parti D","red"),
           ("Candidate 5","Parti E","red"),("Candidat 6","Parti F","blue")]
    cw=(SW-28*2-24)/2; ch=400; y0=236
    for i,(name,party,kind) in enumerate(cards):
        c=i%2; r=i//2; x=28+c*(cw+24); yy=y0+r*(ch+24)
        RR(d,(x,yy,x+cw,yy+ch),20,fill=WHITE,outline=S200,w=2)
        ph=load(os.path.join(PUB,"card_blue.png" if kind=="blue" else "card_red.png"),w=cw-44,h=240)
        im.alpha_composite(ph,(int((x+22)*S),int((yy+22)*S)))
        T(d,(x+cw/2,yy+292),name,f(26),NAVY,anchor="mm")
        pw=TW(d,party,f(18))+28; RR(d,(x+cw/2-pw/2,yy+322,x+cw/2+pw/2,yy+360),19,fill=S100)
        T(d,(x+cw/2,yy+341),party,f(18,False),S600,anchor="mm")
    nav(d,active=0)
    return im
def s_notifs():
    im,d=screen_base(countdown=False)
    T(d,(28,176),"Notifications",f(34),NAVY)
    rows=[("Actualités presse","Nouveaux articles",i_news,True),
          ("Candidats suivis","Publications",i_heart,True),
          ("Mises à jour candidats","Programmes",i_news,False),
          ("Rappels électoraux","Inscription, vote",i_check,None)]
    y=252
    for title,desc,icfn,state in rows:
        RR(d,(28,y,SW-28,y+138),20,fill=WHITE,outline=S200,w=2)
        RR(d,(50,y+34,118,y+102),16,fill=S100); icfn(d,84,y+68,22,NAVY)
        T(d,(140,y+38),title,f(26),NAVY); T(d,(140,y+82),desc,f(20,False),S500)
        tx=SW-160
        if state is None:
            pw=TW(d,"Toujours",f(18))+24; RR(d,(SW-40-pw,y+50,SW-40,y+88),19,fill=S100); T(d,(SW-40-pw/2,y+69),"Toujours",f(18,False),S500,anchor="mm")
        else:
            col=NAVY if state else S300; RR(d,(tx,y+50,tx+90,y+94),22,fill=col)
            kx=tx+54 if state else tx+10; E(d,(kx,y+54,kx+34,y+88),fill=WHITE)
        y+=158
    RR(d,(28,y+8,SW-28,y+150),20,fill=(240,247,255),outline=(199,222,255),w=2)
    i_check(d,64,y+48,18,NAVY); T(d,(98,y+34),"100 % neutre & sans compte",f(24),NAVY)
    for i,ln in enumerate(["Aucune inscription, aucun tracking.","Tous les candidats à égalité."]):
        T(d,(60,y+82+i*32),ln,f(20,False),S600)
    return im

# ===================== COMPOSITIONS =====================
def compose_shot(screen,headline,sub,name,tilt=-3,scale=0.62):
    W,H=1080,2160
    bg=grad(W*S,H*S,(244,249,255),(214,230,250)); d=ImageDraw.Draw(bg)
    # caption
    hf=f(58); y=110
    for ln in wrap(d,headline,hf,W-130): T(d,(64,y),ln,hf,NAVY); y+=70
    sf=f(30,False)
    for ln in wrap(d,sub,sf,W-150): T(d,(64,y+8),ln,sf,S600); y+=42
    ph=frame(screen,tilt=tilt)
    pw=int(W*scale*S); ph=ph.resize((pw,int(pw*ph.height/ph.width)),Image.LANCZOS)
    px=(W*S-ph.width)//2; py=int((y+70)*S)
    shadow(bg,ph,px,py); bg.alpha_composite(ph,(px,py))
    bg.convert("RGB").save(os.path.join(OUT,name)); print("wrote",name)

def poster():
    W,H=1200,1800
    bg=grad(W*S,H*S,(247,251,255),(206,225,248)); d=ImageDraw.Draw(bg)
    # silhouettes faibles derrière le haut
    sb=fade(load(os.path.join(PUB,"card_blue.png"),w=300,h=410),0.45)
    sr=fade(load(os.path.join(PUB,"card_red.png"),w=300,h=410),0.45)
    bg.alpha_composite(sb,(int(330*S),int(40*S))); bg.alpha_composite(sr,(int(520*S),int(40*S)))
    # logo wordmark
    lg=load(os.path.join(PUB,"logo1.png"),w=300); bg.alpha_composite(lg,(int(60*S),int(70*S)))
    # tagline
    T(d,(64,250),"S'informer.",f(64),NAVY); T(d,(64,326),"Comparer.",f(64),NAVY); T(d,(64,402),"Choisir.",f(64),NAVY)
    T(d,(66,498),"Votre guide pour",f(30,False),S600); T(d,(66,538),"l'élection présidentielle 2027",f(30,False),S600)
    # feature tiles
    feats=[((219,234,254),BLUE,i_news,"Toute l'actualité","Suivez les infos clés en un clin d'œil"),
           ((254,226,226),RED,i_heart,"Suivi personnalisé","Vos candidats et sujets préférés"),
           ((220,242,228),THEME["Écologie"],i_scale,"Comparez","Programmes, idées et positions"),
           ((237,228,255),(124,58,237),i_check,"Testez-vous","Trouvez les candidats qui vous ressemblent")]
    fy=620
    for bgc,acc,icfn,title,subt in feats:
        RR(d,(64,fy,148,fy+84),22,fill=bgc); icfn(d,106,fy+42,22,acc)
        T(d,(176,fy+6),title,f(30),NAVY)
        for ln in wrap(d,subt,f(22,False),360): T(d,(176,fy+48),ln,f(22,False),S600); break
        # subtitle may wrap two lines
        lines=wrap(d,subt,f(22,False),360)
        for j,ln in enumerate(lines[:2]): T(d,(176,fy+48+j*30),ln,f(22,False),S600)
        fy+=128
    # rating card
    RR(d,(64,fy+10,560,fy+210),26,fill=WHITE,outline=S200,w=2)
    for k in range(5): star(d,150+k*64,fy+78,26,GOLD)
    T(d,(150,fy+118),"4,8",f(48),NAVY); T(d,(250,fy+132),"/ 5",f(30,False),S500)
    T(d,(96,fy+178),"Rejoignez des milliers d'utilisateurs engagés !",f(21,False),S600)
    # phones (droite + bas) — tenus à droite pour ne pas couvrir le texte de gauche
    big=frame(s_actus(),tilt=-4); big=big.resize((int(540*S),int(540*S*big.height/big.width)),Image.LANCZOS)
    bx,by=int(660*S),int(70*S); shadow(bg,big,bx,by); bg.alpha_composite(big,(bx,by))
    p2=frame(s_fiche(),tilt=2); p2=p2.resize((int(350*S),int(350*S*p2.height/p2.width)),Image.LANCZOS)
    p3=frame(s_match(),tilt=4); p3=p3.resize((int(360*S),int(360*S*p3.height/p3.width)),Image.LANCZOS)
    shadow(bg,p3,int(840*S),int(940*S)); bg.alpha_composite(p3,(int(840*S),int(940*S)))
    shadow(bg,p2,int(600*S),int(900*S)); bg.alpha_composite(p2,(int(600*S),int(900*S)))
    # footer band
    fyb=H-150; RR(d,(0,fyb,W,H),0,fill=NAVY)
    ic=load(os.path.join(PUB,"logo-cap2027.png"),w=92); bg.alpha_composite(ic,(int(60*S),int((fyb+30)*S)))
    T(d,(180,fyb+38),"CAP2027",f(36),WHITE); T(d,(182,fyb+86),"S'informer. Comparer. Choisir.",f(22,False),(190,208,238))
    RR(d,(W-360,fyb+34,W-60,fyb+116),14,fill=(0,0,0))
    d.polygon([((W-330)*S,(fyb+54)*S),((W-330)*S,(fyb+96)*S),((W-300)*S,(fyb+75)*S)],fill=(80,200,255))
    T(d,(W-288,fyb+46),"DISPONIBLE SUR",f(15,False),(200,210,225)); T(d,(W-288,fyb+66),"Google Play",f(28),WHITE)
    bg.convert("RGB").save(os.path.join(OUT,"poster.png")); print("wrote poster.png")

def feature_graphic():
    W,H=1024,500
    bg=grad(W*S,H*S,(247,251,255),(214,230,250)); d=ImageDraw.Draw(bg)
    lg=load(os.path.join(PUB,"logo1.png"),w=210); bg.alpha_composite(lg,(int(56*S),int(54*S)))
    T(d,(60,188),"S'informer. Comparer. Choisir.",f(33),NAVY)
    T(d,(62,238),"Votre guide neutre pour 2027.",f(24,False),S600)
    feats=[(BLUE,i_news,"Actualités tous bords"),(RED,i_heart,"Suivi personnalisé"),
           (THEME["Écologie"],i_scale,"Comparateur & boussole")]
    yy=300
    for acc,icfn,lab in feats:
        icfn(d,80,yy+14,15,acc); T(d,(110,yy),lab,f(25),NAVY); yy+=48
    # phones tenus à droite (x>=600) pour ne pas mordre sur le texte
    p2=frame(s_match(),tilt=4); p2=p2.resize((int(250*S),int(250*S*p2.height/p2.width)),Image.LANCZOS)
    shadow(bg,p2,int(600*S),int(150*S),blur=26,alpha=70); bg.alpha_composite(p2,(int(600*S),int(150*S)))
    big=frame(s_actus(),tilt=-5); big=big.resize((int(300*S),int(300*S*big.height/big.width)),Image.LANCZOS)
    bx,by=int(740*S),int(64*S); shadow(bg,big,bx,by,blur=30,alpha=80); bg.alpha_composite(big,(bx,by))
    bg.convert("RGB").save(os.path.join(OUT,"feature-graphic.png")); print("wrote feature-graphic.png")

def icon():
    Image.open(os.path.join(PUB,"icon-512.png")).convert("RGBA").save(os.path.join(OUT,"icon-512.png")); print("wrote icon-512.png")

if __name__=="__main__":
    compose_shot(s_actus(),"Toute l'actu présidentielle, tous les bords","Un fil agrégé : gauche, centre, droite et fact-checking.","screenshot-1-actus.png")
    compose_shot(s_match(),"Trouvez les candidats qui vous ressemblent","Une boussole anonyme sur les idées, pas sur les noms.","screenshot-2-boussole.png")
    compose_shot(s_fiche(),"Des fiches candidats à égalité","Mêmes informations pour chacun. Sources vérifiables.","screenshot-3-fiche.png")
    compose_shot(s_candidats(),"Tous les candidats, à égalité","Aucune hiérarchie, aucun parti pris.","screenshot-4-candidats.png")
    compose_shot(s_notifs(),"Vous choisissez ce que vous recevez","Notifications par catégorie. Rappels civiques inclus.","screenshot-5-notifs.png")
    poster()
    feature_graphic()
    icon()
    print("done ->",OUT)
