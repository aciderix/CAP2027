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
  gauche: 'Gauche',
  centre: 'Centre',
  'centre-droit': 'Centre-droit',
  droite: 'Droite',
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
        <p className="text-[10px] text-slate-300">Aucun compte · 100% local · Sans publicité</p>
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
          mouvement ou un média.
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

  const sources = sourcesQuery.data ?? [];
  // Group by orientation
  const grouped = sources.reduce<Record<string, SourceRow[]>>((acc, s) => {
    const key = s.is_factcheck ? 'factcheck' : s.orientation;
    (acc[key] ||= []).push(s);
    return acc;
  }, {});

  const order = ['gauche', 'centre', 'centre-droit', 'droite', 'transverse', 'factcheck'];
  const groupKeys = order.filter((k) => grouped[k]?.length);

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
          <b>Fact-checking</b> — Les vérifications publiées par les rédactions
          spécialisées sont identifiées avec leur verdict (vrai, faux, trompeur,
          partiel) quand il est explicite dans le titre.
        </p>
        <p>
          <b>Aucune éditorialisation</b> — Pas de classement caché, pas d'algorithme de mise en
          avant. L'ordre par défaut est strictement chronologique. Le carrousel "À la une"
          remonte les candidats que <i>vous</i> suivez en premier.
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
                        target="_blank"
                        rel="noopener noreferrer"
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
          aucun parti, mouvement politique ni média.
        </p>

        <h4 className="font-bold text-[#102a5c] mt-2">Données personnelles</h4>
        <p>
          L'application <b>ne collecte aucune donnée personnelle</b>. Aucune inscription, aucun
          identifiant unique, aucun cookie tiers. Vos choix (candidats suivis, résultats de
          Boussole, préférences) sont stockés <b>uniquement sur votre appareil</b> et peuvent
          être effacés à tout moment depuis Réglages.
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
