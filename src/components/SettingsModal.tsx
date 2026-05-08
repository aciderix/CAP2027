import { X, Bell, Monitor, Trash2, Shield, Info } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Réglages">
      <div className="flex flex-col gap-6 py-2">
        <p className="text-sm text-slate-500">
          Gérez vos préférences. Toutes vos données restent stockées localement sur votre appareil.
        </p>

        {/* Notifications */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Notifications</p>
              <p className="text-xs text-slate-500">Événements et messages du jour J</p>
            </div>
          </div>
          <button 
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-[#102a5c]' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${notificationsEnabled ? 'left-[26px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Affichage */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Mode Sombre</p>
              <p className="text-xs text-slate-500">Thème clair ou sombre</p>
            </div>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-[#102a5c]' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${darkMode ? 'left-[26px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Effacer les données */}
        <div className="py-3">
          <div className="flex items-center gap-3 mb-3">
             <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <Trash2 className="w-5 h-5" />
             </div>
             <div>
                <p className="font-semibold text-slate-800 text-sm">Données locales</p>
                <p className="text-xs text-slate-500">Abonnements, favoris, résultats</p>
             </div>
          </div>
          <Button variant="outline" className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-9 text-sm">
             Effacer toutes mes données
          </Button>
        </div>

      </div>
    </Modal>
  );
}
