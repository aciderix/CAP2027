import { Bell, Trash2, Shield, AlertTriangle, Activity, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  getNotificationsEnabled,
  setNotificationsEnabled as persistNotifs,
  fireResumeNotification,
  type UnseenArticle,
} from '../lib/notifications';
import { registerPushNotifications, readPushDiag, type PushDiag } from '../lib/push';
import { cancelElectionReminders } from '../lib/electionReminders';

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
  const [diag, setDiag] = useState<PushDiag>({});
  const [diagOpen, setDiagOpen] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const refreshDiag = () => {
    setDiag(readPushDiag());
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
    setTestMsg(null);
    setConfirmClear(false);
    refreshDiag();
  }, [isOpen]);

  const fireTestLocal = async () => {
    setTestMsg(null);
    if (!Capacitor.isNativePlatform()) {
      setTestMsg('Test impossible sur le navigateur — ouvrez l\'app Android.');
      return;
    }
    const fake: UnseenArticle = {
      id: 'test', title: 'Notification de test CAP 2027', url: '',
      published_at: new Date().toISOString(),
      source_name: 'Test', source_color: '#102a5c', is_factcheck: false,
    };
    await fireResumeNotification(1, fake);
    setTestMsg('Si vous ne voyez pas la notif, vérifiez le diagnostic ci-dessous.');
  };

  const reRegister = async () => {
    setBusy(true); setTestMsg(null);
    try {
      const res = await registerPushNotifications();
      setTestMsg(res.ok ? 'register() lancé. Le token arrive dans 1–10 s, voir diagnostic.' : `Échec : ${res.error}`);
      setTimeout(refreshDiag, 1200);
      setTimeout(refreshDiag, 4000);
    } finally { setBusy(false); }
  };

  const toggleNotifs = async () => {
    setError(null);
    const next = !notifEnabled;
    if (!next) {
      // Disabling: cancel scheduled reminders, persist, done.
      persistNotifs(false);
      setNotifEnabled(false);
      await cancelElectionReminders();
      return;
    }
    // Enabling: persist first so any subsequent registration sees it ON.
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
      }
      // Register for FCM in parallel — silent if Firebase not configured
      // or permission denied. Surfaces a clean error otherwise.
      const res = await registerPushNotifications();
      if (!res.ok && res.error && res.error !== 'opt-in required' && res.error !== 'permission denied') {
        setError((prev) => prev ?? `FCM : ${res.error}`);
      }
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
          Vos préférences restent sur votre téléphone. Aucun compte, aucun envoi serveur.
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
                  Nouvelles actus, rappels jour de scrutin, alertes en arrière-plan.
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

          {/* Test buttons */}
          {Capacitor.isNativePlatform() && notifEnabled && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                variant="outline"
                onClick={fireTestLocal}
                className="flex-1 h-9 text-xs gap-1.5 inline-flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" /> Tester une notif locale
              </Button>
              <Button
                variant="outline"
                onClick={reRegister}
                disabled={busy}
                className="flex-1 h-9 text-xs gap-1.5 inline-flex items-center justify-center"
              >
                <Activity className="w-3.5 h-3.5" /> Forcer l'enregistrement push
              </Button>
            </div>
          )}
          {testMsg && (
            <p className="text-[11px] text-slate-600 bg-white rounded-lg p-2 border border-slate-200">{testMsg}</p>
          )}
        </div>

        {/* Diagnostic panel */}
        {Capacitor.isNativePlatform() && (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 mt-2">
            <button
              onClick={() => { setDiagOpen((o) => !o); refreshDiag(); }}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-bold text-[#102a5c] inline-flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> Diagnostic notifications
              </span>
              <span className="text-xs text-slate-400">{diagOpen ? 'masquer' : 'afficher'}</span>
            </button>
            {diagOpen && (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <DiagRow label="Plateforme" value={Capacitor.getPlatform()} />
                <DiagRow label="Notifs activées (app)" value={notifEnabled ? 'oui' : 'non'} />
                <DiagRow label="Permission OS (locale)" value={permState} />
                <DiagRow label="Permission OS (push)" value={diag.permission ?? '—'} />
                <DiagRow label="register() appelé à" value={diag.registerCalledAt ? new Date(diag.registerCalledAt).toLocaleTimeString('fr') : '—'} />
                <DiagRow label="Token reçu à" value={diag.tokenAt ? new Date(diag.tokenAt).toLocaleTimeString('fr') : '— (pas encore)'} />
                <DiagRow label="Token (preview)" value={diag.tokenPreview ?? '—'} mono />
                <DiagRow label="Upsert Supabase" value={diag.upsertOk === undefined ? '—' : diag.upsertOk ? 'OK' : 'échec'} />
                {diag.upsertError && <DiagRow label="Erreur upsert" value={diag.upsertError} mono full />}
                {diag.registrationError && <DiagRow label="Erreur registration" value={diag.registrationError} mono full />}
                {diag.lastError && <DiagRow label="Dernière erreur" value={diag.lastError} mono full />}
              </dl>
            )}
          </div>
        )}

        {/* Quick info */}
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex items-start gap-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-emerald-600 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-[#102a5c] text-sm">Confidentialité</p>
            <p className="text-xs text-slate-500 leading-snug mt-0.5">
              Aucun compte. Aucun cookie tiers. Aucun pixel publicitaire. Les seules données
              transitent depuis Supabase pour récupérer le contenu public.
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
                Supprime vos candidats suivis, vos résultats de boussole, l'onboarding et le
                cache. Ne touche pas aux données sur le serveur.
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
          CAP 2027 — App indépendante · 100 % locale
        </p>
      </div>
    </Modal>
  );
}

function DiagRow({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <>
      <dt className={`text-slate-500 font-medium ${full ? 'col-span-2 mt-1' : ''}`}>{label}</dt>
      <dd className={`${full ? 'col-span-2' : ''} ${mono ? 'font-mono' : ''} text-slate-800 break-all`}>{value}</dd>
    </>
  );
}
