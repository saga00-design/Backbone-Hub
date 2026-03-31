import React, { useState } from 'react';
import { StaffMember } from '../../types';
import { Lock } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { toast } from 'sonner';

interface PasscodeEntryProps {
  staff: StaffMember[];
  onAuthenticate: (staff: StaffMember) => void;
}

export const PasscodeEntry: React.FC<PasscodeEntryProps> = ({ staff, onAuthenticate }) => {
  const [pin, setPin] = useState('');
  const [authenticatedStaff, setAuthenticatedStaff] = useState<StaffMember | null>(null);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        const staffMember = staff.find(s => s.pin === newPin);
        if (staffMember) {
          setAuthenticatedStaff(staffMember);
        } else {
          setPin('');
          toast.error('Invalid PIN');
        }
      }
    }
  };

  const handleClockAction = async (action: 'in' | 'out') => {
    if (!authenticatedStaff) return;
    try {
      const staffRef = doc(db, `users/${auth.currentUser?.uid}/staff`, authenticatedStaff.id);
      await updateDoc(staffRef, {
        isClockedIn: action === 'in',
        lastClockIn: action === 'in' ? new Date().toISOString() : undefined
      });
      toast.success(`Successfully clocked ${action}!`);
      if (action === 'in') {
        onAuthenticate(authenticatedStaff);
      } else {
        setPin('');
        setAuthenticatedStaff(null);
      }
    } catch (err) {
      console.error("Error clocking in/out:", err);
      toast.error("Error clocking in/out");
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  if (authenticatedStaff) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-main-bg text-text-navy">
        <h2 className="text-2xl font-bold mb-8">Welcome, {authenticatedStaff.firstName}</h2>
        <div className="flex gap-4">
          {!authenticatedStaff.isClockedIn && (
            <button onClick={() => handleClockAction('in')} className="px-8 py-4 bg-success text-white rounded-2xl text-xl font-bold hover:opacity-90 transition-opacity">Clock In</button>
          )}
          {authenticatedStaff.isClockedIn && (
            <button onClick={() => handleClockAction('out')} className="px-8 py-4 bg-cta text-white rounded-2xl text-xl font-bold hover:opacity-90 transition-opacity">Clock Out</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-main-bg text-text-navy">
      <Lock className="w-16 h-16 text-accent mb-8" />
      <h2 className="text-2xl font-bold mb-8 font-serif tracking-tight">Enter Staff PIN</h2>
      <div className="flex space-x-4 mb-12">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-16 h-20 bg-card-bg border border-border-grey rounded-xl flex items-center justify-center text-3xl font-bold text-accent shadow-inner">
            {pin[i] ? '●' : ''}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            onClick={() => handleKeyPress(digit.toString())}
            className="w-20 h-20 bg-card-bg border border-border-grey rounded-2xl text-2xl font-bold text-text-navy hover:bg-secondary-surface hover:border-accent transition-all shadow-lg active:scale-95"
          >
            {digit}
          </button>
        ))}
        <button onClick={handleBackspace} className="w-20 h-20 bg-secondary-surface border border-border-grey rounded-2xl text-xs font-bold text-text-muted hover:bg-border-grey hover:text-text-navy transition-all active:scale-95 uppercase tracking-widest">
          CLEAR
        </button>
        <button onClick={() => handleKeyPress('0')} className="w-20 h-20 bg-card-bg border border-border-grey rounded-2xl text-2xl font-bold text-text-navy hover:bg-secondary-surface hover:border-accent transition-all shadow-lg active:scale-95">
          0
        </button>
      </div>
    </div>
  );
};
