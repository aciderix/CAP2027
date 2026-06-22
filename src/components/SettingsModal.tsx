import { Bell, Trash2, Shield, AlertTriangle, Newspaper, UserCheck, Megaphone, Vote, Star, BookOpen, Landmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  getNotificationsEnabled,
  setNotificationsEnabled as persistNotifs,
} from '../lib/notifications';
import { registerPushNotifications, getPushToken } from '../lib/push';
import { registerPushWeb, getWebPushToken } from '../lib/pushWeb';
import { useMutedChannels, type NotifChannel } from '../lib/notificationChannels';
import { useFollowedThemes, POLITICS_THEME_SLUG } from '../lib/themeFollows';
import { supabase } from '../lib/supabase';
import { STABLE_STALE_MS } from '../lib/queryClient';
import { canRateApp, openRateApp } from '../lib/rateApp';
import { InfoTip } from './ui/InfoTip';

// Reflète l'état du toggle maître côté serveur (push_tokens.enabled) pour
// que push-broadcast cesse réellement d'envoyer quand l'utilisateur coupe
// tout. best-effort: si le token n'est pas encore prêt, le prochain
// register le réalignera.
async function setServerTokenEnabled(enabled: boolean) {
  const token = getPushToken() ?? getWebPushToken();
  if (!token) return;
  try {
    await supabase.rpc('set_token_enabled', { p_token: token, p_enabled: enabled });
  } catch {
    // best-effort
  }
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [permState, setPermState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const { isEnabled: channelEnabled, toggle: toggleChannel } = useMutedChannels();
  const {
    followed: followedThemes,
    isFollowed: themeFollowed,
    toggle: toggleTheme,
    clear: clearThemes,
    setOnly: setOnlyThemes,
  } = useFollowedThemes();

  // Themes list (reference data, very stable). Only fetched when the modal
  // is open AND notifs are on — it drives the press-notif category filter.
  const themesQuery = useQuery({
    queryKey: ['notifThemes'],
    enabled: isOpen,
    staleTime: STABLE_STALE_MS,
    queryFn: async (): Promise<Array<{ slug: string; name: string; color: string | null }>> => {
      const { data, error } = await supabase
        .from('themes')
        .select('slug, name, color')
        .order('order_index');
      if (error) throw error;
      return (data ?? []) as Array<{ slug: string; name: string; color: string | null }>;
    },
  });
  const themes = themesQuery.data ?? [];

  const refreshPerm = () => {
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.checkPermissions()
        .then((p) => setPermState(p.display as any))
        .catch(() => setPermState('unknown'));
    }
  };

  // Sync state from storage every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setNotifEnabled(getNotificationsEnabled());
    setError(null);
    setConfirmClear(false);
    refreshPerm();
  }, [isOpen]);

  const toggleNotifs = async () => {
    setError(null);
    const next = !notifEnabled;
    if (!next) {
      // Disabling: persist the pref. FCM-side, the server still has the
      // token but the OS-level notif channel will be muted by Android
      // once the user denies permission in system settings (the toggle
      // here is mainly an in-app "mute" — to fully cut server pushes,
      // the user must revoke at OS level).
      persistNotifs(false);
      setNotifEnabled(false);
      // Couper réellement côté serveur (opt-out total, rappels compris).
      void setServerTokenEnabled(false);
      return;
    }
    // Enabling: persist first so the background runner sees it ON
    // on its next wake.
    persistNotifs(true);
    setNotifEnabled(true);
    setBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const ask = await LocalNotifications.requestPermissions();
        setPermState(ask.display as any);
        if (ask.display !== 'granted') {
          setError("Permission refusée. Activez « CAP 2027 » dans Réglages → Apps → Notifications du téléphone.");
        }
        // Re-register the FCM token in case the user just flipped from
        // OFF (where we may have skipped registration) to ON.
        const res = await registerPushNotifications();
        if (!res.ok && res.error && res.error !== 'opt-in required' && res.error !== 'permission denied') {
          setError((prev) => prev ?? `FCM : ${res.error}`);
        }
      } else {
        // Web: enabling from Settings triggers the browser permission
        // prompt + FCM web token registration on the spot (the user
        // gesture is required by Firefox/Safari to open the prompt).
        const res = await registerPushWeb();
        if (!res.ok && res.error
          && res.error !== 'opt-in-required'
          && res.error !== 'browser-unsupported'
          && !res.error.startsWith('permission-')) {
          setError((prev) => prev ?? `Web push : ${res.error}`);
        }
      }
      // Réactiver l'envoi serveur (le token vient d'être (ré)enregistré).
      await setServerTokenEnabled(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleClearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.clear();
      try {
        Object.keys(window.sessionStorage).forEach((k) => sessionStorage.removeItem(k));
      } catch { /* noop */ }
      window.location.reload();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Réglages">
      <div className="flex flex-col gap-2 py-2">
        <p className="text-sm text-slate-500">
          Vos préférences restent sur votre téléphone. Aucun compte. Si vous activez les
          notifications, un identifiant anonyme est envoyé au serveur pour les acheminer.
        </p>

        {/* Single notif toggle */}
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex flex-col gap-3 mt-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#102a5c] shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#102a5c] text-sm">Notifications</p>
                <p className="text-xs text-slate-500 leading-snug">
                  Nouvelles actus, rappels jour de scrutin, vérifications en arrière-plan.
                </p>
              </div>
            </div>
            <button
              onClick={toggleNotifs}
              disabled={busy}
              aria-label="Activer les notifications"
              className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${
                notifEnabled ? 'bg-[#102a5c]' : 'bg-slate-300'
              } ${busy ? 'opacity-50' : ''}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                notifEnabled ? 'left-[26px]' : 'left-0.5'
              }`} />
            </button>
          </div>
          {notifEnabled && Capacitor.isNativePlatform() && permState === 'denied' && (
            <p className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 inline-flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                L'autorisation système est refusée. Pour activer&nbsp;: <b>Réglages Android → Applications → CAP 2027 → Notifications → autoriser</b>.
              </span>
            </p>
          )}
          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 inline-flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </p>
          )}
          {notifEnabled && !Capacitor.isNativePlatform() && (
            <p className="text-xs text-slate-500 bg-white rounded-lg p-2">
              Sur le navigateur, les nouvelles actus s'affichent dans la cloche en haut.
            </p>
          )}
        </div>

        {/* Notification channels — only meaningful when notifs are on */}
        {notifEnabled && (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex flex-col gap-1 mt-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 px-1 pb-1 inline-flex items-center gap-1">
              Types de notifications
              <InfoTip label="À quoi servent ces réglages ?">
                Activez ou coupez chaque catégorie indépendamment. Les rappels
                électoraux restent toujours actifs (échéances civiques).
              </InfoTip>
            </p>
            <ChannelRow
              icon={<Newspaper className="w-4 h-4" />}
              title="Actualités presse"
              desc="Nouveaux articles des médias suivis."
              channel="news_press"
              enabled={channelEnabled('news_press')}
              onToggle={toggleChannel}
            />
            <ChannelRow
              icon={<UserCheck className="w-4 h-4" />}
              title="Candidats suivis"
              desc="Publications et vidéos des candidats que vous suivez."
              channel="candidates_followed"
              enabled={channelEnabled('candidates_followed')}
              onToggle={toggleChannel}
            />
            <ChannelRow
              icon={<Megaphone className="w-4 h-4" />}
              title="Mises à jour candidats"
              desc="Programmes, propositions et fiches mis à jour."
              channel="candidates_updates"
              enabled={channelEnabled('candidates_updates')}
              onToggle={toggleChannel}
            />
            {/* Election reminders: always on, not mutable (civic deadlines) */}
            <div className="flex items-center justify-between gap-3 py-2 px-1">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#102a5c] shrink-0">
                  <Vote className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#102a5c] text-sm">Rappels électoraux</p>
                  <p className="text-xs text-slate-500 leading-snug">
                    Inscription, procuration, jour de vote, résultats. Toujours actifs.
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-1">
                Toujours
              </span>
            </div>
          </div>
        )}

        {/* Catégories d'actualité — affine les notifs presse par thème.
            Visible seulement si les notifs ET le canal "Actualités presse"
            sont actifs (le filtre ne porte que sur ces notifs-là). */}
        {notifEnabled && channelEnabled('news_press') && (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex flex-col gap-3 mt-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 px-1 pb-0.5 inline-flex items-center gap-1">
                Catégories d'actualité
                <InfoTip label="À quoi sert ce filtre ?">
                  Filtre les notifications d'actualités presse par thème. « Toutes » =
                  aucune restriction. Sinon, vous ne recevez que les sujets choisis.
                </InfoTip>
              </p>
              <p className="text-xs text-slate-500 px-1 leading-snug">
                S'applique aux notifications « Actualités presse ».
              </p>
            </div>

            {(() => {
              const politicsOnly = followedThemes.size === 1 && followedThemes.has(POLITICS_THEME_SLUG);
              return (
                <button
                  onClick={() => (politicsOnly ? clearThemes() : setOnlyThemes([POLITICS_THEME_SLUG]))}
                  className={`inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    politicsOnly
                      ? 'bg-[#102a5c] text-white border-[#102a5c]'
                      : 'bg-white text-[#102a5c] border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  Actualités politiques uniquement
                </button>
              );
            })()}

            <div className="flex flex-wrap gap-1.5">
              <ThemeChip active={followedThemes.size === 0} onClick={clearThemes} label="Toutes" />
              {themes.map((t) => (
                <ThemeChip
                  key={t.slug}
                  active={themeFollowed(t.slug)}
                  onClick={() => toggleTheme(t.slug)}
                  label={t.name}
                  dotColor={t.color}
                />
              ))}
            </div>
          </div>
        )}

        {/* Aide & découverte */}
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex flex-col gap-3 mt-2">
          <button
            onClick={() => {
              onClose();
              setTimeout(() => window.dispatchEvent(new Event('cap2027:replay-onboarding')), 150);
            }}
            className="flex items-center gap-3 text-left w-full"
          >
            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#1a56db] shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#102a5c] text-sm">Revoir le tutoriel</p>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                Relancez la présentation des fonctionnalités à tout moment.
              </p>
            </div>
          </button>

          {canRateApp() && (
            <button
              onClick={() => { void openRateApp(); }}
              className="flex items-center gap-3 text-left w-full border-t border-slate-100 pt-3"
            >
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-amber-500 shrink-0">
                <Star className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#102a5c] text-sm">Noter l'application</p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">
                  Donnez votre avis sur le Google Play Store. Ça aide beaucoup !
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Quick info */}
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex items-start gap-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-emerald-600 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-[#102a5c] text-sm">Confidentialité</p>
            <p className="text-xs text-slate-500 leading-snug mt-0.5">
              Aucun compte. Aucun cookie tiers. Aucun pixel publicitaire. Aucune donnée personnelle partagée.
            </p>
          </div>
        </div>

        {/* Clear data */}
        <div className="rounded-2xl bg-rose-50/40 border border-rose-100 p-4 flex flex-col gap-3 mt-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-rose-500 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-[#102a5c] text-sm">Effacer mes données locales</p>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                Supprime vos candidats suivis, vos résultats de boussole, l'onboarding et le cache.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleClearData}
            className={`w-full h-10 text-sm font-bold ${
              confirmClear
                ? 'border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200'
                : 'border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            {confirmClear ? 'Confirmer la suppression' : 'Effacer toutes mes données'}
          </Button>
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-2">
          CAP 2027 — App indépendante · Sans compte · Sans publicité
        </p>
      </div>
    </Modal>
  );
}

function ThemeChip({
  active, onClick, label, dotColor,
}: { active: boolean; onClick: () => void; label: string; dotColor?: string | null }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all whitespace-nowrap ${
        active
          ? 'bg-[#102a5c] text-white border-[#102a5c] shadow-sm'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
      }`}
    >
      {dotColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />}
      {label}
    </button>
  );
}

function ChannelRow({
  icon, title, desc, channel, enabled, onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  channel: NotifChannel;
  enabled: boolean;
  onToggle: (c: NotifChannel) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-1">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#102a5c] shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[#102a5c] text-sm">{title}</p>
          <p className="text-xs text-slate-500 leading-snug">{desc}</p>
        </div>
      </div>
      <button
        onClick={() => onToggle(channel)}
        aria-label={`Activer ${title}`}
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
}
