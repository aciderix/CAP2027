import { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 pointer-events-none mt-safe">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg pointer-events-auto flex flex-col max-h-[calc(100dvh-24px)] md:max-h-[90vh] overflow-hidden"
            >
              <div className={`flex items-center shrink-0 ${title ? 'justify-between p-4 sm:p-5 border-b border-slate-100' : 'justify-end pt-3 pr-3 pb-0'}`}>
                {title && <h3 className="text-xl font-bold text-[#102a5c]">{title}</h3>}
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-700 focus:outline-none hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className={`overflow-y-auto ${title ? 'p-4 sm:p-6' : 'px-4 pb-4 pt-0 sm:px-6 sm:pb-6 sm:pt-2'}`}>
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
