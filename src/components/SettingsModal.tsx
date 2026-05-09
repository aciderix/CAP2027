import { Bell, Trash2, Star, Info, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  getNotificationsEnabled,
  setNotificationsEnabled as persistNotifs,
} from '../lib/notifications';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [confirmClear, setConfirmClear] = useState(false);

  // Sync state from storage every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setNotificationsEnabled(getNotificationsEnabled());
    setConfirmClear(false);
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.checkPermissions()
        .then((p) => setPermissionState(p.display as any))
        .catch(() => setPermissionState('unknown'));
    } else {
      setPermissionState('unknown');
    }
  }, [isOpen]);

  const toggleNotifications = async () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    persistNotifs(next);
    if (next && Capacitor.isNativePlatform()) {
      try {
        const status = await LocalNotifications.requestPermissions();
        setPermissionState(status.display as any);
      } catch {
        setPermissionState('denied');
      }
    }
  };

  const handleClearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.clear();
      // Clear React Query persisted cache too
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

        {/* Notifications */}
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex flex-col gap-3 mt-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#102a5c] shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#102a5c] text-sm">Notifications</p>
                <p className="text-xs text-slate-500 leading-snug">
                  Une alerte locale à la réouverture de l'app si du nouveau contenu est disponible.
                </p>
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              aria-label="Activer les notifications"
              className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${
                notificationsEnabled ? 'bg-[#102a5c]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                notificationsEnabled ? 'left-[26px]' : 'left-0.5'
              }`} />
            </button>
          </div>
          {notificationsEnabled && Capacitor.isNativePlatform() && permissionState === 'denied' && (
            <p className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">
              L'autorisation système a été refusée. Active "Notifications CAP 2027" dans les
              réglages Android pour qu'elles s'affichent.
            </p>
          )}
          {notificationsEnabled && !Capacitor.isNativePlatform() && (
            <p className="text-xs text-slate-500 bg-white rounded-lg p-2">
              Sur le navigateur, les nouvelles actus s'affichent dans la cloche en haut. Les
              notifications système sont actives uniquement dans l'app Android.
            </p>
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

        {/* Build version */}
        <p className="text-[10px] text-slate-400 text-center mt-2">
          CAP 2027 — App indépendante · 100 % locale
        </p>
      </div>
    </Modal>
  );
}
