
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-[#1a1a1a] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[#2a2a2a]"
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-2xl ${
                  variant === 'danger' ? 'bg-red-500/10 text-red-500' : 
                  variant === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                  'bg-accent/10 text-accent'
                }`}>
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-[#d9e2ec]">{title}</h3>
              </div>
              
              <p className="text-[#666] text-sm leading-relaxed mb-8">
                {message}
              </p>
              
              <div className="flex gap-3">
                <Button
                  onClick={onCancel}
                  variant="secondary"
                  className="flex-1 rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest"
                >
                  {cancelLabel}
                </Button>
                <Button
                  onClick={onConfirm}
                  className={`flex-1 rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest shadow-lg ${
                    variant === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 
                    variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 
                    'bg-accent hover:bg-accent/90 shadow-accent/20'
                  }`}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
            
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 text-[#666] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
