import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, Check, AlertCircle } from 'lucide-react';
import { StaffMember } from '../types';
import { verifyStaffPin } from '../firebase';

interface POSPINModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (staffId: string, staffName: string) => void;
  staffMembers: StaffMember[];
  currentUserEmail: string | null;
  locationId: string;
}

export function POSPINModal({ isOpen, onClose, onVerified, staffMembers, currentUserEmail, locationId }: POSPINModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [matchingStaff, setMatchingStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      // Auto-identify if possible
      const staff = staffMembers.find(s => s.email.toLowerCase() === currentUserEmail?.toLowerCase());
      setMatchingStaff(staff || null);
    }
  }, [isOpen, staffMembers, currentUserEmail]);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !isVerifying) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);

      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  // PINs used to be compared directly against staffMembers[].pin in the
  // browser - that field no longer exists on StaffMember at all (moved to
  // the manager-only staffSecrets/{staffId} collection). Verification now
  // goes through the verifyStaffPin Cloud Function, which uses the Admin
  // SDK server-side and never sends the actual PIN value back to the client.
  const verifyPin = async (enteredPin: string) => {
    setIsVerifying(true);
    try {
      const result = await verifyStaffPin({
        pin: enteredPin,
        locationId,
        staffId: matchingStaff?.id,
      });
      const data = result.data as { verified: boolean; staffId?: string; staffName?: string };

      if (data.verified && data.staffId) {
        onVerified(data.staffId, data.staffName || '');
      } else {
        setError(true);
        setPin('');
      }
    } catch (err) {
      console.error('PIN verification failed:', err);
      setError(true);
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-200"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">POS ACCESS</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">
              {isVerifying ? 'Verifying...' : matchingStaff ? `Hello ${matchingStaff.firstName}, enter your PIN` : 'Enter your 4-digit staff PIN'}
            </p>
          </div>

          <div className="flex justify-center gap-4 mb-10">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pin.length > i 
                    ? 'bg-accent border-accent scale-110 shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]' 
                    : error 
                      ? 'border-error animate-shake' 
                      : 'border-slate-200'
                }`} 
              />
            ))}
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-error text-center text-xs font-bold uppercase tracking-widest mb-6"
            >
              Invalid credentials
            </motion.p>
          )}

          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={isVerifying}
                className="h-16 w-16 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-xl font-black text-slate-900 transition-all flex items-center justify-center border border-slate-100 shadow-sm disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => onClose()}
              className="h-16 w-16 rounded-2xl text-slate-400 hover:text-slate-600 active:scale-95 text-xs font-bold uppercase trekking-widest transition-all flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={isVerifying}
              className="h-16 w-16 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-xl font-black text-slate-900 transition-all flex items-center justify-center border border-slate-100 shadow-sm disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              disabled={isVerifying}
              className="h-16 w-16 rounded-2xl text-slate-400 hover:text-slate-600 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
