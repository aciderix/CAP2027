import { motion } from 'motion/react';
import { Bell, Newspaper, UserCheck, Megaphone, Vote } from 'lucide-react';
import { useMutedChannels, type NotifChannel } from '../lib/notificationChannels';

// First-launch screen shown right AFTER the OS notification permission
// has been granted. Lets the user pick which categories of notifs they
// want, mirroring the toggles in Settings. Opt-out model: everything is
// ON by default, so doing nothing keeps all channels active.
//
// Election reminders are shown as an always-on info row (not mutable),
// same as in Settings.

interface ChannelSelectionProps {
  onComplete: () => void;
}

const ROWS: Array<{
  channel: NotifChannel;
  icon: React.ReactNode;
  title: string;
  desc: string;
}> = [
  {
    channel: 'news_press',
    icon: <Newspaper className="w-5 h-5" />,
    title: 'Actualités presse',
    desc: 'Nouveaux articles des médias suivis.',
  },
  {
    channel: 'candidates_followed',
    icon: <UserCheck className="w-5 h-5" />,
    title: 'Candidats suivis',
    desc: 'Publications et vidéos des candidats que vous suivez.',
  },
  {
    channel: 'candidates_updates',
    icon: <Megaphone className="w-5 h-5" />,
    title: 'Mises à jour candidats',
    desc: 'Programmes, propositions et fiches mis à jour.',
  },
];

export function ChannelSelection({ onComplete }: ChannelSelectionProps) {
  const { isEnabled, toggle } = useMutedChannels();

  return (
    <motion.div
      className="fixed inset-0 min-h-[100dvh] bg-white z-[91] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 pt-10 sm:pt-14 pb-4">
        <div className="w-full max-w-[460px] mx-auto flex flex-col">
          <div className="w-14 h-14 rounded-2xl bg-[#102a5c] text-white flex items-center justify-center mb-6 shadow-sm">
            <Bell className="w-7 h-7" />
          </div>
          <h1 className="text-[26px] sm:text-[30px] leading-[1.1] font-black text-[#102a5c] mb-3 tracking-tight">
            Vos notifications
          </h1>
          <p className="text-[16px] sm:text-[17px] text-[#475569] leading-relaxed font-medium mb-7">
            Choisissez ce que vous souhaitez recevoir. Tout est activé par défaut —
            vous pouvez modifier ces choix à tout moment dans les Réglages.
          </p>

          <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 border border-slate-100 p-3">
            {ROWS.map((r) => {
              const enabled = isEnabled(r.channel);
              return (
                <div key={r.channel} className="flex items-center justify-between gap-3 py-2.5 px-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#102a5c] shrink-0">
                      {r.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#102a5c] text-sm">{r.title}</p>
                      <p className="text-xs text-slate-500 leading-snug">{r.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(r.channel)}
                    aria-label={`Activer ${r.title}`}
                    className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${
                      enabled ? 'bg-[#102a5c]' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                      enabled ? 'left-[26px]' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              );
            })}

            {/* Election reminders: always on */}
            <div className="flex items-center justify-between gap-3 py-2.5 px-1 border-t border-slate-100 mt-1 pt-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#102a5c] shrink-0">
                  <Vote className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#102a5c] text-sm">Rappels électoraux</p>
                  <p className="text-xs text-slate-500 leading-snug">
                    Inscription, procuration, jour de vote, résultats.
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-1">
                Toujours
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug mt-4 px-1">
            Réglages → Notifications pour ajuster ces préférences quand vous le souhaitez.
          </p>
        </div>
      </div>

      <div className="p-6 pb-8 sm:pb-10 bg-white border-t border-slate-100">
        <button
          onClick={onComplete}
          className="w-full max-w-[460px] mx-auto block bg-[#1a56db] text-white font-bold text-[16px] sm:text-[17px] py-4 rounded-[16px] xl:rounded-[20px] hover:bg-[#154bbd] transition-colors active:scale-[0.98] shadow-sm tracking-wide"
        >
          Terminer
        </button>
      </div>
    </motion.div>
  );
}
