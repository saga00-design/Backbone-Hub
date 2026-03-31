
import React, { useState } from 'react';
import { StaffMember } from '../../types';
import { User, GraduationCap, TrendingUp, Trophy, Award, BookOpen, Star, ChevronRight, Search, Plus, Filter, PoundSterling, Clock, ShieldCheck, Zap, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth, handleFirestoreError, OperationType, cleanObject } from '../../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface StaffTrainingProps {
  staff: StaffMember[];
}

export const StaffTraining: React.FC<StaffTrainingProps> = ({ staff }) => {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const trainingCategories = [
    { id: 'food', name: 'Food Menu', icon: <BookOpen className="w-4 h-4" />, color: 'text-blue-400' },
    { id: 'cocktails', name: 'Cocktails', icon: <Zap className="w-4 h-4" />, color: 'text-yellow-400' },
    { id: 'wine', name: 'Wine Knowledge', icon: <Award className="w-4 h-4" />, color: 'text-purple-400' },
    { id: 'tequila', name: 'Tequila & Mezcal', icon: <Star className="w-4 h-4" />, color: 'text-orange-400' },
    { id: 'allergens', name: 'Allergens', icon: <ShieldCheck className="w-4 h-4" />, color: 'text-red-400' },
    { id: 'service', name: 'Steps of Service', icon: <Trophy className="w-4 h-4" />, color: 'text-green-400' },
  ];

  const trainingBatches = [
    { id: 'batch-1', name: 'Spring Intake 2024', date: '2024-03-15', members: 4, status: 'Active' },
    { id: 'batch-2', name: 'Holiday Season 2023', date: '2023-11-01', members: 6, status: 'Completed' },
    { id: 'batch-3', name: 'New Opening Team', date: '2023-08-20', members: 12, status: 'Completed' },
  ];

  const filteredStaff = staff.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState<Partial<StaffMember>>({
    firstName: '',
    lastName: '',
    role: 'Waiter',
    pin: '',
    hourlyRate: 12.50,
    active: true,
    trainingProgress: {}
  });

  const handleAddStaff = async () => {
    if (!newStaff.firstName || !newStaff.lastName || !newStaff.pin || !auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      await addDoc(collection(db, `users/${userId}/staff`), cleanObject({
        ...newStaff,
        trainingProgress: {
          food: 0,
          cocktails: 0,
          wine: 0,
          tequila: 0,
          allergens: 0,
          service: 0
        }
      }));
      setIsAddingStaff(false);
      setNewStaff({
        firstName: '',
        lastName: '',
        role: 'Waiter',
        pin: '',
        hourlyRate: 12.50,
        active: true,
        trainingProgress: {}
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'staff');
    }
  };

  const getAverageProgress = (s: StaffMember) => {
    const values = Object.values(s.trainingProgress || {});
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  return (
    <div className="h-full flex bg-main-bg dark:bg-slate-950 p-8 space-x-8 overflow-hidden">
      {/* Staff List Sidebar */}
      <div className="w-96 flex flex-col space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-text-navy dark:text-white tracking-tight">Staff Waiter Training Hub</h1>
          <p className="text-text-muted dark:text-slate-400 mt-1 font-medium">Performance & Training Batches</p>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-primary-surface dark:bg-slate-900 border border-border-grey dark:border-slate-800 rounded-2xl text-text-navy dark:text-slate-100 focus:outline-none focus:border-accent transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 no-scrollbar">
          {/* Batches Section */}
          <div className="mb-6">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-text-muted dark:text-slate-500 mb-3 px-2">Training Batches</h3>
            <div className="space-y-2">
              {trainingBatches.map(batch => (
                <div key={batch.id} className="p-4 bg-primary-surface dark:bg-slate-900/50 border border-border-grey dark:border-slate-800 rounded-xl hover:border-accent/30 transition-all cursor-pointer group shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-text-navy dark:text-slate-200 group-hover:text-accent transition-colors">{batch.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${batch.status === 'Active' ? 'bg-success/10 text-success' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                      {batch.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted dark:text-slate-500">
                    <span className="flex items-center space-x-1">
                      <User className="w-3 h-3" />
                      <span>{batch.members} Members</span>
                    </span>
                    <span>{batch.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <h3 className="text-[10px] uppercase tracking-widest font-bold text-text-muted dark:text-slate-500 mb-3 px-2">Individual Staff</h3>
          {filteredStaff.map(s => (
            <motion.button
              key={s.id}
              whileHover={{ x: 5 }}
              onClick={() => setSelectedStaff(s)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedStaff?.id === s.id ? 'bg-accent/10 border-accent shadow-lg shadow-accent/10' : 'bg-primary-surface dark:bg-slate-900 border-border-grey dark:border-slate-800 hover:border-accent/30'}`}
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-main-bg dark:bg-slate-800 border border-border-grey dark:border-slate-700 flex items-center justify-center">
                  <User className={`w-6 h-6 ${selectedStaff?.id === s.id ? 'text-accent' : 'text-text-muted'}`} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-text-navy dark:text-slate-100">{s.firstName} {s.lastName}</h3>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted">{s.role}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-accent">{getAverageProgress(s)}%</p>
                <div className="w-12 h-1 bg-border-grey dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${getAverageProgress(s)}%` }}></div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <button 
          onClick={() => setIsAddingStaff(true)}
          className="w-full py-4 bg-primary-surface dark:bg-slate-900 border border-dashed border-border-grey dark:border-slate-800 rounded-2xl text-[10px] uppercase tracking-widest font-bold text-text-muted hover:text-accent hover:border-accent transition-all flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Add Staff Modal */}
      <AnimatePresence>
        {isAddingStaff && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-primary-surface dark:bg-slate-900 border border-border-grey dark:border-slate-800 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-text-navy dark:text-white">New Staff Member</h3>
                <button onClick={() => setIsAddingStaff(false)} className="text-text-muted hover:text-accent">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">First Name</label>
                    <input 
                      type="text"
                      value={newStaff.firstName}
                      onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })}
                      className="w-full bg-main-bg dark:bg-slate-950 border border-border-grey dark:border-slate-800 rounded-xl px-4 py-3 text-text-navy dark:text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Last Name</label>
                    <input 
                      type="text"
                      value={newStaff.lastName}
                      onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
                      className="w-full bg-main-bg dark:bg-slate-950 border border-border-grey dark:border-slate-800 rounded-xl px-4 py-3 text-text-navy dark:text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Role</label>
                  <select 
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                    className="w-full bg-main-bg dark:bg-slate-950 border border-border-grey dark:border-slate-800 rounded-xl px-4 py-3 text-text-navy dark:text-white focus:outline-none focus:border-accent"
                  >
                    <option value="Waiter">Waiter</option>
                    <option value="Bartender">Bartender</option>
                    <option value="Chef">Chef (Admin)</option>
                    <option value="Manager">Manager (Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Security PIN (4 digits)</label>
                  <input 
                    type="password"
                    maxLength={4}
                    value={newStaff.pin}
                    onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })}
                    className="w-full bg-main-bg dark:bg-slate-950 border border-border-grey dark:border-slate-800 rounded-xl px-4 py-3 text-text-navy dark:text-white focus:outline-none focus:border-accent text-center text-2xl tracking-[0.5em]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Hourly Rate (£)</label>
                  <input 
                    type="number"
                    value={newStaff.hourlyRate}
                    onChange={(e) => setNewStaff({ ...newStaff, hourlyRate: parseFloat(e.target.value) })}
                    className="w-full bg-main-bg dark:bg-slate-950 border border-border-grey dark:border-slate-800 rounded-xl px-4 py-3 text-text-navy dark:text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <button 
                  onClick={handleAddStaff}
                  className="w-full py-4 bg-accent text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all mt-4"
                >
                  Create Staff Member
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff Detail View */}
      <div className="flex-1 bg-primary-surface dark:bg-slate-900 rounded-3xl border border-border-grey dark:border-slate-800 overflow-hidden flex flex-col shadow-2xl">
        {selectedStaff ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Detail Header */}
            <header className="p-12 bg-gradient-to-b from-accent/5 to-transparent dark:from-slate-800/50 dark:to-transparent flex items-start justify-between">
              <div className="flex items-center space-x-8">
                <div className="w-24 h-24 rounded-3xl bg-main-bg dark:bg-slate-800 border border-border-grey dark:border-slate-700 flex items-center justify-center shadow-xl">
                  <User className="w-12 h-12 text-accent" />
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-text-navy dark:text-white tracking-tight">{selectedStaff.firstName} {selectedStaff.lastName}</h2>
                  <div className="flex items-center space-x-4 mt-3">
                    <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] font-bold uppercase tracking-widest border border-accent/20">
                      {selectedStaff.role}
                    </span>
                    <div className="flex items-center space-x-2 text-text-muted dark:text-slate-500 text-xs font-bold uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      <span>Joined Recently</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <div className="px-8 py-4 bg-main-bg dark:bg-slate-800/50 border border-border-grey dark:border-slate-700 rounded-2xl text-center shadow-sm">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted dark:text-slate-500 mb-1">Pay Rate</p>
                  <p className="text-2xl font-bold text-text-navy dark:text-slate-100">£{selectedStaff.hourlyRate.toFixed(2)}<span className="text-xs text-text-muted">/hr</span></p>
                </div>
                <div className="px-8 py-4 bg-accent/10 border border-accent/20 rounded-2xl text-center shadow-sm">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-accent mb-1">Sales Rank</p>
                  <p className="text-2xl font-bold text-accent">#2</p>
                </div>
              </div>
            </header>

            {/* Content Tabs */}
            <div className="px-12 flex-1 overflow-y-auto pb-12 no-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Training Progress */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-text-navy dark:text-white flex items-center space-x-3">
                      <GraduationCap className="w-6 h-6 text-accent" />
                      <span>Training Academy</span>
                    </h3>
                    <button className="text-[10px] uppercase tracking-widest font-bold text-accent hover:underline">Assign Course</button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {trainingCategories.map(cat => (
                      <div key={cat.id} className="p-6 bg-main-bg dark:bg-slate-800/30 border border-border-grey dark:border-slate-800 rounded-2xl group hover:border-accent/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg bg-primary-surface dark:bg-slate-900 ${cat.color}`}>
                              {cat.icon}
                            </div>
                            <span className="text-sm font-bold text-text-navy dark:text-slate-200">{cat.name}</span>
                          </div>
                          <span className="text-xs font-bold text-text-muted dark:text-slate-500">{selectedStaff.trainingProgress[cat.id] || 0}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-primary-surface dark:bg-slate-900 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${selectedStaff.trainingProgress[cat.id] || 0}%` }}
                            className={`h-full ${selectedStaff.trainingProgress[cat.id] >= 100 ? 'bg-success' : 'bg-accent'}`}
                          ></motion.div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Performance Stats */}
                <section className="space-y-8">
                  <h3 className="text-xl font-bold text-text-navy dark:text-white flex items-center space-x-3">
                    <TrendingUp className="w-6 h-6 text-warning" />
                    <span>Performance Metrics</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-main-bg dark:bg-slate-800/30 border border-border-grey dark:border-slate-800 rounded-2xl shadow-sm">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted dark:text-slate-500 mb-2">Avg. Ticket</p>
                      <p className="text-2xl font-bold text-text-navy dark:text-slate-100">£{selectedStaff.performanceMetrics?.averageTicketValue.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="p-6 bg-main-bg dark:bg-slate-800/30 border border-border-grey dark:border-slate-800 rounded-2xl shadow-sm">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted dark:text-slate-500 mb-2">Upsell Rate</p>
                      <p className="text-2xl font-bold text-text-navy dark:text-slate-100">{selectedStaff.performanceMetrics?.upsellRate.toFixed(1) || '0.0'}%</p>
                    </div>
                  </div>

                  {/* Competition Section */}
                  <div className="p-8 bg-gradient-to-br from-accent/10 to-transparent dark:from-accent/20 dark:to-transparent border border-accent/20 dark:border-accent/30 rounded-3xl relative overflow-hidden shadow-sm">
                    <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-accent/5 dark:text-accent/10" />
                    <h4 className="text-lg font-bold text-text-navy dark:text-white mb-2">Mezcal Challenge</h4>
                    <p className="text-xs text-text-muted dark:text-slate-400 mb-6 leading-relaxed">Sell 10 "Oaxaca Old Fashioned" to win a £50 bonus. Ends in 2 days.</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-text-navy dark:text-slate-200">Progress: 7/10</span>
                      <span className="text-xs font-bold text-accent">70%</span>
                    </div>
                    <div className="w-full h-2 bg-primary-surface dark:bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
            <GraduationCap className="w-24 h-24 mb-6 opacity-10" />
            <p className="text-xl font-medium italic">Select a staff member or batch to view performance</p>
          </div>
        )}
      </div>
    </div>
  );
};
