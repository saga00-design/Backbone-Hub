import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { db, doc, getDoc } from '../firebase';

type ConfirmationState = 'verifying' | 'confirmed' | 'failed';

interface PaymentConfirmationProps {
  isOpen: boolean;
  paymentId: string;
  orderId: string;
  amount: number;
  method: string;
  tableName: string;
  onClose: () => void;
  onRetry?: () => void;
}

function formatAmount(amount: number): string {
  const pounds = amount > 100 ? amount / 100 : amount;
  return `£${pounds.toFixed(2)}`;
}

const POLL_DELAYS = [1000, 2000, 3000, 4000, 5000];

export const PaymentConfirmation: React.FC<PaymentConfirmationProps> = ({
  isOpen,
  paymentId,
  orderId,
  amount,
  method,
  tableName,
  onClose,
  onRetry,
}) => {
  const [state, setState] = useState<ConfirmationState>('verifying');

  useEffect(() => {
    if (!isOpen) return;
    setState('verifying');

    let cancelled = false;

    const poll = async () => {
      for (let i = 0; i < POLL_DELAYS.length; i++) {
        await new Promise<void>(r => setTimeout(r, POLL_DELAYS[i]));
        if (cancelled) return;
        try {
          const snap = await getDoc(doc(db, 'posPayments', paymentId));
          if (cancelled) return;
          if (snap.exists()) {
            setState('confirmed');
            return;
          }
        } catch {
          // continue polling on error
        }
      }
      if (!cancelled) setState('failed');
    };

    poll();
    return () => { cancelled = true; };
  }, [isOpen, paymentId]);

  useEffect(() => {
    if (state !== 'confirmed') return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [state, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="payment-confirmation-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        >
          <motion.div
            key="payment-confirmation-modal"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-card-bg rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center"
          >
            {state === 'verifying' && (
              <>
                <div className="flex justify-center mb-6">
                  <Loader2 className="h-16 w-16 text-accent animate-spin" />
                </div>
                <h2 className="text-2xl font-black text-text-navy tracking-tighter mb-2">
                  Confirming Payment
                </h2>
                <div className="mt-4 space-y-1 text-sm text-text-muted">
                  <p>{tableName}</p>
                  <p className="font-bold">{method}</p>
                  <p className="text-3xl font-black text-text-navy mt-2">{formatAmount(amount)}</p>
                </div>
              </>
            )}

            {state === 'confirmed' && (
              <>
                <div className="flex justify-center mb-6">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-text-navy tracking-tighter mb-2">
                  Payment Confirmed
                </h2>
                <div className="mt-4 space-y-1 text-sm text-text-muted">
                  <p>{tableName}</p>
                  <p className="font-bold">{method}</p>
                  <p className="text-3xl font-black text-text-navy mt-2">{formatAmount(amount)}</p>
                </div>
                <p className="text-xs text-text-muted mt-4">Closing automatically...</p>
              </>
            )}

            {state === 'failed' && (
              <>
                <div className="flex justify-center mb-6">
                  <AlertCircle className="h-16 w-16 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-text-navy tracking-tighter mb-2">
                  Verification Failed
                </h2>
                <p className="text-sm text-text-muted mb-4">
                  Please record this payment manually:
                </p>
                <div className="bg-secondary-surface rounded-2xl p-4 text-left text-sm mb-6 space-y-2">
                  <p className="font-bold text-text-muted text-[10px] uppercase tracking-widest">
                    Payment Reference
                  </p>
                  <p className="font-mono text-xs text-text-navy break-all">{paymentId}</p>
                  <div className="border-t border-border-grey" />
                  <p className="text-text-muted">{tableName}</p>
                  <p className="text-2xl font-black text-text-navy">{formatAmount(amount)}</p>
                </div>
                <div className="flex gap-3">
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex-1 py-3 bg-accent text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                      Try Again
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-secondary-surface text-text-navy rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-border-grey transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
