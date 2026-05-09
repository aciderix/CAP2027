import { useState } from 'react';
import {
  ClipboardCheck, HeartHandshake, CalendarDays, ExternalLink, ChevronRight,
  Vote, IdCard, MapPin, FileSignature, Eye,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export function VoterToolkit() {
  const [activeModal, setActiveModal] = useState<'inscription' | 'procuration' | 'calendrier' | 'vote' | null>(null);

  const closeModal = () => setActiveModal(null);

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 pt-4 sm:pt-6 md:pt-8 pb-0 sm:pb-2 md:pb-4 w-full relative overflow-hidden">
      <div className="mb-3 sm:mb-5 px-4 sm:px-6 md:px-8">
        <h2 className="text-[18px] sm:text-[28px] font-bold text-[#102a5c]">
          Boîte à outils du votant
        </h2>
      </div>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-10 sm:w-14 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10 pb-4" />
        <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="w-1 sm:w-2 md:w-4 shrink-0 snap-start" aria-hidden="true" />
          <ToolkitItem 
            icon={<ClipboardCheck className="w-5 h-5 text-[#1a56db]" strokeWidth={2.5} />}
          title="Êtes-vous inscrit ?"
          description="Vérifiez votre inscription sur les listes électorales."
          bgClass="bg-[#eff4ff] border-[#dbeafe]"
          onClick={() => setActiveModal('inscription')}
        />
        <ToolkitItem 
          icon={<HeartHandshake className="w-5 h-5 text-[#6d28d9]" strokeWidth={2.5} />}
          title="Procuration"
          description="Trouvez ou proposez une procuration facilement."
          bgClass="bg-[#eff4ff] border-[#dbeafe]"
          onClick={() => setActiveModal('procuration')}
        />
        <ToolkitItem
          icon={<CalendarDays className="w-5 h-5 text-[#e11d48]" strokeWidth={2.5} />}
          title="Calendrier"
          description="Toutes les dates clés de la présidentielle."
          bgClass="bg-[#eff4ff] border-[#dbeafe]"
          onClick={() => setActiveModal('calendrier')}
        />
        <ToolkitItem
          icon={<Vote className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />}
          title="Comment je vote ?"
          description="Pas-à-pas le jour J : pièces, bureau, déroulé, dépouillement."
          bgClass="bg-[#eff4ff] border-[#dbeafe]"
          onClick={() => setActiveModal('vote')}
        />
          <div className="w-12 sm:w-16 shrink-0" aria-hidden="true" />
        </div>
        <div className="absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 pb-4" />
      </div>

      <Modal 
        isOpen={activeModal === 'inscription'} 
        onClose={closeModal}
        title="Vérifier mon inscription"
      >
        <div className="space-y-5">
          <div className="space-y-3 text-slate-600 leading-relaxed">
            <p>
              Pour voter aux élections présidentielles de 2027, vous devez être dûment inscrit sur les listes électorales. 
            </p>
            <p>
              L'inscription est automatique pour les jeunes de 18 ans (s'ils ont fait le recensement citoyen) 
              et pour les personnes obtenant la nationalité française. Dans les autres cas (déménagement, 
              première inscription tardive), <strong>vous devez faire la démarche vous-même</strong>.
            </p>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <a href="https://www.service-public.fr/particuliers/vosdroits/R51788" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button className="w-full justify-center flex items-center gap-2">
                Vérifier ma situation <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
              </Button>
            </a>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'procuration'} 
        onClose={closeModal}
        title="Vote par procuration"
      >
        <div className="space-y-5">
          <div className="space-y-3 text-slate-600 leading-relaxed">
            <p>
              Si vous êtes absent le jour du vote (1er ou 2nd tour), vous pouvez charger un autre 
              électeur de voter à votre place. 
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-2">De quoi avez-vous besoin ?</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Votre Numéro National d'Électeur (NNE)</li>
                <li>Le NNE de la personne à qui vous donnez procuration, ainsi que sa date de naissance</li>
              </ul>
            </div>
            <p className="text-sm">
              Une fois la demande en ligne effectuée, vous devrez faire valider votre identité (en commissariat, gendarmerie ou en ligne via France Identité).
            </p>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <a href="https://www.maprocuration.gouv.fr/" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button className="w-full justify-center flex items-center gap-2">
                Maprocuration.gouv.fr <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
              </Button>
            </a>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={activeModal === 'calendrier'} 
        onClose={closeModal}
        title="Calendrier Électoral 2027"
      >
        <div className="space-y-5">
          <p className="text-slate-600">
            Les dates de l'élection présidentielle de 2027 ne sont pas encore formellement arrêtées 
            par décret, mais elles auront traditionnellement lieu au mois d'avril.
          </p>
          
          <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#e11d48] uppercase">Avril</span>
                <span className="text-xl font-black text-[#102a5c] leading-none">11*</span>
              </div>
              <div className="pt-1">
                <h4 className="font-bold text-[#102a5c] text-lg leading-tight">1er Tour (Estimé)</h4>
                <p className="text-sm text-slate-500 mt-0.5">Ouverture des bureaux à 8h00</p>
              </div>
            </div>
            
            <div className="w-[2px] h-6 bg-slate-200 ml-7 -my-2"></div>
            
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#e11d48] uppercase">Avril</span>
                <span className="text-xl font-black text-[#102a5c] leading-none">25*</span>
              </div>
              <div className="pt-1">
                <h4 className="font-bold text-[#102a5c] text-lg leading-tight">2nd Tour (Estimé)</h4>
                <p className="text-sm text-slate-500 mt-0.5">Ouverture des bureaux à 8h00</p>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-slate-400 italic">
            * Les dates précises seront confirmées quelques mois avant le scrutin par le Ministère de l'Intérieur.
          </p>
          
          <div className="pt-3">
            <Button variant="secondary" onClick={closeModal} className="w-full">
              J'ai compris
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'vote'}
        onClose={closeModal}
        title="Comment je vote ?"
      >
        <div className="space-y-4 text-slate-600 leading-relaxed">
          <p className="text-sm">
            Le vote se déroule entre <b>8 h et 19 h</b> (jusqu'à 20 h en métropole, parfois
            22 h dans certaines grandes villes). Voici les étapes pas à pas.
          </p>

          <VoteStep
            n={1}
            icon={<IdCard className="w-4 h-4" />}
            title="Pièce d'identité (obligatoire)"
            body="Carte nationale d'identité, passeport, permis de conduire ou titre de séjour. La carte électorale n'est PAS obligatoire mais utile pour gagner du temps."
          />
          <VoteStep
            n={2}
            icon={<MapPin className="w-4 h-4" />}
            title="Se rendre à son bureau de vote"
            body="L'adresse est imprimée sur la carte électorale et consultable en ligne. C'est toujours le bureau rattaché à votre adresse de domicile lors de l'inscription."
          />
          <VoteStep
            n={3}
            icon={<FileSignature className="w-4 h-4" />}
            title="Prendre TOUS les bulletins + une enveloppe"
            body="Prenez au moins deux bulletins différents pour préserver le secret du vote. Direction l'isoloir : c'est obligatoire d'y passer."
          />
          <VoteStep
            n={4}
            icon={<Vote className="w-4 h-4" />}
            title="Voter"
            body="Dans l'isoloir, vous mettez le bulletin de votre choix dans l'enveloppe — sans le modifier (rature, annotation = bulletin nul). Vous pouvez aussi mettre une enveloppe vide (= vote blanc) ou y glisser deux bulletins (= vote nul)."
          />
          <VoteStep
            n={5}
            icon={<ClipboardCheck className="w-4 h-4" />}
            title="« A voté »"
            body="Le président demande la pièce d'identité, contrôle votre présence sur la liste, vous introduisez l'enveloppe dans l'urne et signez la liste d'émargement."
          />
          <VoteStep
            n={6}
            icon={<Eye className="w-4 h-4" />}
            title="Le dépouillement est public"
            body="Après la fermeture, le bureau de vote est ouvert au public pour le dépouillement. N'importe qui peut y assister, observer le comptage et même y participer comme scrutateur."
          />

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1.5">
            <p className="font-bold text-[#102a5c] mb-1">À savoir</p>
            <p>• Vous votez <b>deux fois</b> pour la présidentielle : 1er tour, puis 2nd tour deux semaines plus tard si aucun candidat n'a la majorité absolue.</p>
            <p>• En cas d'absence : <b>procuration</b> (cf. tuile à côté).</p>
            <p>• Vote blanc = enveloppe vide. Il est compté à part mais ne change pas le pourcentage des candidats.</p>
            <p>• Le silence électoral commence la veille du scrutin à minuit : pas de propagande, pas de sondages diffusés.</p>
          </div>

          <div className="pt-3 flex flex-col sm:flex-row justify-end gap-3">
            <a
              href="https://www.elections.interieur.gouv.fr/comprendre-elections/comment-je-vote"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button className="w-full justify-center flex items-center gap-2">
                Source officielle <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
              </Button>
            </a>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

function VoteStep({
  n, icon, title, body,
}: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 shrink-0 rounded-full bg-[#102a5c] text-white text-xs font-black flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-[#102a5c] text-sm flex items-center gap-1.5">
          <span className="text-[#1a56db]">{icon}</span>
          {title}
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{body}</p>
      </div>
    </div>
  );
}

function ToolkitItem({ icon, title, description, bgClass, onClick }: { icon: React.ReactNode, title: string, description: string, bgClass: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`relative overflow-hidden flex flex-col text-left rounded-[16px] p-3 sm:p-4 w-[165px] sm:w-[200px] snap-start shrink-0 lg:flex-1 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border ${bgClass}`}
    >
      <div className="relative z-10 flex flex-col h-full w-full">
        <div className="flex items-center mb-1.5 sm:mb-2.5 w-full">
          <h3 className="font-bold text-[#102a5c] text-[14px] sm:text-[16px] leading-[1.15] sm:leading-tight pr-0.5">{title}</h3>
        </div>
        <div className="flex items-end justify-between gap-1.5 sm:gap-2 mt-auto w-full">
          <p className="text-[11px] sm:text-[13px] text-slate-700 leading-[1.4] sm:leading-relaxed flex-1 overflow-hidden">{description}</p>
          <ChevronRight className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] text-[#102a5c] opacity-40 shrink-0 mb-0.5" strokeWidth={2.5} />
        </div>
      </div>
      <div className="absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 opacity-[0.08] shrink-0 pointer-events-none">
        <div className="scale-[3.5] sm:scale-[4.5] origin-bottom-right">
          {icon}
        </div>
      </div>
    </button>
  );
}
