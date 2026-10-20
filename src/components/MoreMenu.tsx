import {
  Star, Target, Info, Search, FileText, ChevronRight,
  Settings, Mail, ExternalLink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './ui/Modal';
import { SettingsModal } from './SettingsModal';
import { supabase } from '../lib/supabase';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { openLink } from '../lib/openLink';
import { DK_LICENCE_URL, DK_SITE_URL } from '../lib/dkShared';
import { ORIENTATION_ORDER } from '../lib/orientationFollows';

interface MoreMenuProps {
  onGoToCandidates: () => void;
}

interface SourceRow {
  name: string;
  homepage_url: string | null;
  orientation: string;
  color: string | null;
  is_factcheck: boolean;
}

const ORIENTATION_LABELS: Record<string, string> = {
  'extreme-gauche': 'Extrême gauche',
  gauche: 'Gauche',
  'centre-gauche': 'Centre-gauche',
  centre: 'Centre',
  'centre-droit': 'Centre-droit',
  droite: 'Droite',
  'extreme-droite': 'Extrême droite',
  transverse: 'Transverse',
  factcheck: 'Fact-checking',
};

export function MoreMenu({ onGoToCandidates }: MoreMenuProps) {
  const [openModal, setOpenModal] = useState<null | 'about' | 'method' | 'legal'>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const items = [
    {
      id: 'subscriptions',
      icon: <Star className="w-5 h-5 text-amber-500" />,
      title: 'Gérer mes abonnements',
      desc: 'Suivre / désuivre des candidats pour personnaliser votre fil',
      onClick: onGoToCandidates,
    },
    {
      id: 'compass',
      icon: <Target className="w-5 h-5 text-emerald-500" />,
      title: 'Mes résultats de Boussole',
      desc: 'Reprendre le test ou voir votre dernier classement',
      onClick: () => {
        // Two-step: ensure we're on home, then ask the home to open the modal.
        window.dispatchEvent(new CustomEvent('cap2027:goto-home'));
        // Defer until home is rendered
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('cap2027:open-boussole'));
        }, 60);
      },
    },
    {
      id: 'settings',
      icon: <Settings className="w-5 h-5 text-slate-500" />,
      title: 'Réglages',
      desc: 'Notifications, données locales, confidentialité',
      onClick: () => setSettingsOpen(true),
    },
    {
      id: 'about',
      icon: <Info className="w-5 h-5 text-blue-500" />,
      title: 'À propos',
      desc: 'Notre mission et notre indépendance',
      onClick: () => setOpenModal('about'),
    },
    {
      id: 'methodology',
      icon: <Search className="w-5 h-5 text-purple-500" />,
      title: 'Méthodologie et sources',
      desc: 'Comment on agrège, comment on tague, qui on lit',
      onClick: () => setOpenModal('method'),
    },
    {
      id: 'legal',
      icon: <FileText className="w-5 h-5 text-slate-500" />,
      title: 'Mentions légales',
      desc: 'Données, confidentialité et CGU',
      onClick: () => setOpenModal('legal'),
    },
  ];

  return (
    <div className="flex flex-col gap-3 pb-20 animate-in fade-in zoom-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 transition-colors text-left ${
              index !== items.length - 1 ? 'border-b border-slate-100' : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[#102a5c] text-[15px] sm:text-base">{item.title}</span>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">{item.desc}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        ))}
      </div>

      <div className="text-center mt-6 flex flex-col items-center gap-1">
        <img decoding="async" src="/logo-cap2027-sm.png" alt="" className="w-10 h-10 rounded-xl opacity-90 mb-1" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">CAP 2027 • App indépendante</p>
        <p className="text-[10px] text-slate-300">Aucun compte · Sans tracking · Sans publicité</p>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AboutModal isOpen={openModal === 'about'} onClose={() => setOpenModal(null)} />
      <MethodologyModal isOpen={openModal === 'method'} onClose={() => setOpenModal(null)} />
      <LegalModal isOpen={openModal === 'legal'} onClose={() => setOpenModal(null)} />
    </div>
  );
}

function AboutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="À propos">
      <div className="flex flex-col gap-4 py-2 text-sm text-slate-700 leading-relaxed">
        <div className="flex flex-col items-center gap-2 pb-3 border-b border-slate-100">
          <img decoding="async" src="/logo-cap2027.png" alt="" className="w-16 h-16 rounded-2xl shadow-sm" />
          <h3 className="font-black text-[#102a5c] text-lg">CAP 2027</h3>
          <p className="text-xs text-slate-500 italic">S'informer · Comparer · Choisir</p>
        </div>
        <p>
          <b>Une boîte à outils civique gratuite et indépendante</b> pour la présidentielle 2027.
          Pas d'inscription, pas de tracking, pas de publicité.
        </p>
        <p>
          On agrège des sources publiques (presse en ligne, fact-checkers, comptes officiels des
          candidats), on les tague automatiquement par candidat, parti et thématique, puis on
          présente le tout sans hiérarchie cachée. Tous les candidats publiés sont traités à
          égalité.
        </p>
        <p>
          <b>Vous décidez ce que vous voyez</b> : suivez les candidats qui vous intéressent,
          lancez le test de Boussole pour mesurer vos affinités, comparez les programmes
          côte à côte.
        </p>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
          Le projet est non-commercial, financé par ses auteurs. Aucun lien avec un parti, un
          mouvement, un média ni une administration. <b>Ce n'est pas une application officielle&nbsp;:</b>
          pour vos démarches, référez-vous aux sites officiels de l'État.
        </p>
      </div>
    </Modal>
  );
}

function MethodologyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const sourcesQuery = useQuery({
    queryKey: ['methodologySources'],
    enabled: isOpen,
    staleTime: STABLE_STALE_MS,
    queryFn: async (): Promise<SourceRow[]> => {
      const { data, error } = await supabase
        .from('news_sources')
        .select('name, homepage_url, orientation, color, is_factcheck')
        .eq('is_active', true)
        .order('orientation')
        .order('name');
      if (error) throw error;
      return (data ?? []) as SourceRow[];
    },
  });

  // Dernier export Demos Kratos importé (programmes) : date affichée dans la
  // section qui leur est consacrée.
  const dkQuery = useQuery({
    queryKey: ['dkLastImport'],
    enabled: isOpen,
    staleTime: STABLE_STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dk_imports').select('generated_at, meta').eq('kind', 'programmes')
        .order('imported_at', { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const dkDate = dkQuery.data?.generated_at
    ? new Date(dkQuery.data.generated_at).toLocaleDateString('fr-FR')
    : null;

  const sources = sourcesQuery.data ?? [];
  // Group by orientation
  const grouped = sources.reduce<Record<string, SourceRow[]>>((acc, s) => {
    const key = s.is_factcheck ? 'factcheck' : s.orientation;
    (acc[key] ||= []).push(s);
    return acc;
  }, {});

  const groupKeys = ORIENTATION_ORDER.filter((k) => grouped[k]?.length);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Méthodologie et sources">
      <div className="flex flex-col gap-4 py-2 text-sm text-slate-700 leading-relaxed">
        <p>
          <b>Agrégation</b> — Chaque heure, l'app récupère les articles publiés
          par les sources ci-dessous et les rassemble dans un fil unique.
        </p>
        <p>
          <b>Étiquetage</b> — Chaque article est rattaché automatiquement aux
          candidats, partis et thématiques qu'il mentionne, pour qu'il apparaisse
          au bon endroit dans la fiche d'un candidat ou dans le filtre d'un
          thème. L'écriture sans accent fonctionne aussi.
        </p>
        <p>
          <b>Orientation des sources</b> — Chaque média est classé d'après la façon dont
          son article Wikipédia le caractérise. Les médias généralistes et de service
          public, pour lesquels Wikipédia n'indique pas d'orientation, sont classés au
          centre. Les comptes des candidats suivent le positionnement de leur parti sur
          Wikipédia ; quand il s'agit d'une fourchette, on retient son milieu, ou sa
          borne la plus modérée. « Extrême » n'est retenu que lorsque Wikipédia l'indique
          sans nuance, à gauche comme à droite. « Transverse » regroupe les médias qui se
          situent hors du clivage gauche-droite ou dont le positionnement est contesté.
        </p>
        <p>
          <b>Fact-checking</b> — Les vérifications publiées par les rédactions
          spécialisées sont identifiées avec leur verdict (vrai, faux, trompeur,
          partiel) quand il est explicite dans le titre.
        </p>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex flex-col gap-2">
          <p>
            <b>Programmes, comparateur et Match : propulsés par Demos Kratos</b> — Les
            mesures des candidats, leurs synthèses par thème, les comparaisons entre
            programmes et les affirmations du Match viennent de{' '}
            <button type="button" onClick={() => void openLink(DK_SITE_URL)} className="underline font-semibold">
              demos-kratos.fr
            </button>
            , qui les extrait des programmes officiels, de manière neutre, avec des outils
            utilisant l'IA. Chaque mesure cite le passage exact du programme et renvoie à sa
            source officielle et à sa page sur demos-kratos.fr, où l'on peut signaler une erreur.
          </p>
          <p className="text-xs text-slate-500">
            Données mises à jour chaque jour
            {dkDate && <> (dernier export : {dkDate})</>}, sous licence{' '}
            <button type="button" onClick={() => void openLink(DK_LICENCE_URL)} className="underline">
              CC BY-NC 4.0
            </button>
            . Le score du Match est calculé par CAP 2027, avec sa propre méthode.
          </p>
        </div>
        <p>
          <b>Aucune éditorialisation</b> — Pas de classement caché, pas d'algorithme de mise en
          avant. L'ordre par défaut est chronologique, avec une seule règle : pas plus de
          2 articles d'un même média sur 10 consécutifs, pour qu'un média qui publie beaucoup
          n'occupe pas tout l'écran. Les articles en trop descendent un peu plus bas, aucun
          n'est retiré. La règle ne s'applique pas quand un filtre ne laisse que quelques médias.
          Le carrousel "À la une" remonte les candidats que <i>vous</i> suivez en premier.
        </p>

        <div>
          <h4 className="font-bold text-[#102a5c] mb-2 mt-2 text-base">Sources actives ({sources.length})</h4>
          {sourcesQuery.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          )}
          {!sourcesQuery.isLoading && groupKeys.map((k) => (
            <div key={k} className="mb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 mt-2">
                {ORIENTATION_LABELS[k] ?? k}
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {grouped[k].map((s) => (
                  <li key={s.name}>
                    {s.homepage_url ? (
                      <a
                        href={s.homepage_url}
                        onClick={(e) => { e.preventDefault(); void openLink(s.homepage_url!); }}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border border-slate-200 hover:border-slate-300 transition-colors"
                        style={{ color: s.color || '#475569' }}
                      >
                        {s.name} <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border border-slate-200"
                        style={{ color: s.color || '#475569' }}
                      >
                        {s.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function LegalModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mentions légales">
      <div className="flex flex-col gap-3 py-2 text-sm text-slate-700 leading-relaxed">
        <h4 className="font-bold text-[#102a5c]">Éditeur</h4>
        <p>
          CAP 2027 est un projet non-commercial édité à titre personnel. Il n'est affilié à
          aucun parti, mouvement politique, média, <b>ni à aucune administration ou entité
          gouvernementale</b>. Ce n'est pas une application officielle&nbsp;: pour toute démarche,
          référez-vous aux sites officiels de l'État (service-public.fr, maprocuration.gouv.fr,
          elections.interieur.gouv.fr).
        </p>

        <h4 className="font-bold text-[#102a5c] mt-2">Données personnelles</h4>
        <p>
          L'application <b>ne demande aucune inscription</b> et ne collecte <b>aucune donnée
          personnelle identifiante</b> (pas de nom, d'e-mail, de localisation), aucun cookie
          tiers ni pixel publicitaire. Vos choix (candidats suivis, résultats de Boussole,
          préférences) sont stockés sur votre appareil et peuvent être effacés depuis Réglages.
        </p>
        <p>
          Si vous activez les notifications, un <b>identifiant de notification anonyme</b> est
          enregistré sur notre serveur (UE) afin de vous envoyer uniquement les alertes que vous
          avez choisies. Il n'est lié à aucune identité et est supprimé lorsque vous désactivez
          les notifications ou désinstallez l'application.
        </p>

        <h4 className="font-bold text-[#102a5c] mt-2">Contenu tiers</h4>
        <p>
          Les articles, vidéos et messages affichés proviennent de leurs auteurs respectifs et
          restent leur propriété. CAP 2027 se contente d'agréger des extraits publics (titre,
          résumé, image d'illustration) et renvoie systématiquement à la source d'origine.
        </p>

        <h4 className="font-bold text-[#102a5c] mt-2">Hébergement</h4>
        <p>
          Le backend tourne sur Supabase (Frankfurt, UE). L'app Android est packagée avec
          Capacitor.
        </p>

        <h4 className="font-bold text-[#102a5c] mt-2">Contact</h4>
        <p className="inline-flex items-center gap-1">
          <Mail className="w-3.5 h-3.5" />
          <a
            href="mailto:cap2027.app@gmail.com"
            className="text-[#1a56db] hover:underline"
          >
            cap2027.app@gmail.com
          </a>
        </p>
      </div>
    </Modal>
  );
}
