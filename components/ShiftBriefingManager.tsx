
import React, { useState, useEffect } from 'react';
import { ShiftBriefingNote, Recipe, ShiftType } from '../types';
import { db, auth, collection, onSnapshot, query, where, doc, setDoc, deleteDoc, handleFirestoreError, OperationType, cleanObject, LOCATION_ID, writeBatch } from '../firebase';
import { Plus, Trash2, Edit2, Sparkles, Clock, Users, X, Zap, ShieldAlert, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { StockAvailabilityManager } from './StockAvailabilityManager';
import { PageHeader } from './PageHeader';

interface ShiftBriefingManagerProps {
  recipes: Recipe[];
  checkPermission: (module: string, action: string) => boolean;
  userRole: string;
}

export const ShiftBriefingManager: React.FC<ShiftBriefingManagerProps> = ({ recipes, checkPermission, userRole }) => {
  const [shiftBriefingNotes, setShiftBriefingNotes] = useState<ShiftBriefingNote[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubShiftBriefings = onSnapshot(
      query(collection(db, 'shiftBriefings'), where('locationId', '==', LOCATION_ID)),
      (snapshot) => {
        setShiftBriefingNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftBriefingNote)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shiftBriefings')
    );

    return () => {
      unsubShiftBriefings();
    };
  }, []);

  const handleSaveShiftBriefing = async (data: Partial<ShiftBriefingNote>) => {
    try {
      const id = editingItem?.id || `sb-${Date.now()}`;
      const newItem = {
        ...data,
        id,
        locationId: LOCATION_ID,
        author: auth.currentUser?.displayName || auth.currentUser?.email || 'System',
        lastUpdated: new Date().toISOString(),
        date: data.date || new Date().toISOString().split('T')[0],
        shift: data.shift || 'Lunch'
      };
      await setDoc(doc(db, 'shiftBriefings', id), cleanObject(newItem), { merge: true });
      toast.success(editingItem ? 'Briefing updated' : 'Briefing created');
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'shiftBriefings');
    }
  };

  const handleDeleteItem = async (collectionName: string, id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success('Item deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  const handleActivateBriefing = async (id: string) => {
    try {
      const batch = writeBatch(db);
      // Deactivate all others in this location
      shiftBriefingNotes.forEach(note => {
        if (note.id !== id && note.isActiveOnPOS) {
          batch.update(doc(db, 'shiftBriefings', note.id), { isActiveOnPOS: false });
        }
      });
      // Activate this one
      batch.update(doc(db, 'shiftBriefings', id), { isActiveOnPOS: true });
      await batch.commit();
      toast.success('Briefing activated on POS');
    } catch (err) {
      console.error("Activation failed:", err);
      toast.error('Failed to activate briefing');
    }
  };

  const activeBriefing = shiftBriefingNotes.find(note => note.isActiveOnPOS);
  const [activeTab, setActiveTab] = useState<'briefing' | 'availability'>('briefing');

  return (
    <div className="space-y-6">

      <PageHeader
        icon={Megaphone}
        title="Shift Briefing"
        subtitle="Manager updates, directives, and 86/availability status"
      />

      {/* Tab bar */}
      <div className="flex gap-2 bg-primary-surface rounded-xl p-1 border border-border-grey w-fit">
        <button
          onClick={() => setActiveTab('briefing')}
          className={`flex items-center gap-2 py-2 px-5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'briefing'
              ? 'bg-white dark:bg-slate-900 text-accent shadow-sm border border-accent/20'
              : 'text-text-muted hover:text-text-navy dark:hover:text-white'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Shift Briefing
        </button>
        <button
          onClick={() => setActiveTab('availability')}
          className={`flex items-center gap-2 py-2 px-5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'availability'
              ? 'bg-white dark:bg-slate-900 text-accent shadow-sm border border-accent/20'
              : 'text-text-muted hover:text-text-navy dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          86 &amp; Availability
        </button>
      </div>

      {activeTab === 'availability' ? (
        <StockAvailabilityManager recipes={recipes} checkPermission={checkPermission} />
      ) : (
      <div className="bg-card-bg rounded-2xl border border-border-grey overflow-hidden shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-navy">MANAGER'S MESSAGE BOARD</h2>
            <p className="text-xs text-text-muted font-bold uppercase tracking-[0.2em] mt-1">Operational updates and directives</p>
          </div>
          {checkPermission('staff', 'manageBriefing') && (
            <button 
              onClick={() => { setEditingItem(activeBriefing || null); setIsModalOpen(true); }}
              className="bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-accent/20 active:scale-95"
            >
              <Edit2 className="w-5 h-5" />
              Update Briefing
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shiftBriefingNotes.map(item => (
            <ShiftBriefingNoteCard 
              key={item.id} 
              item={item} 
              onEdit={() => { setEditingItem(item); setIsModalOpen(true); }} 
              onDelete={() => handleDeleteItem('shiftBriefings', item.id)} 
              canEdit={checkPermission('staff', 'manageBriefing')} 
              onActivate={() => handleActivateBriefing(item.id)}
            />
          ))}
          {shiftBriefingNotes.length === 0 && (
            <div className="col-span-full py-12 text-center text-text-muted italic border-2 border-dashed border-border-grey/50 rounded-2xl">
              No briefing notes available for the current location.
            </div>
          )}
        </div>
      </div>
      )}

      {isModalOpen && (
        <ShiftBriefingNoteFormModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveShiftBriefing} 
          initialData={editingItem} 
          recipes={recipes}
        />
      )}
    </div>
  );
};

const ShiftBriefingNoteCard = ({ item, onEdit, onDelete, canEdit, onActivate }: { item: ShiftBriefingNote, onEdit: () => void, onDelete: () => void, canEdit: boolean, onActivate: () => void }) => (
  <div className={`p-4 rounded-xl border relative group transition-all ${item.isActiveOnPOS ? 'bg-accent/5 border-accent ring-1 ring-accent' : 'bg-primary-surface border-border-grey hover:border-accent'}`}>
    {item.isActiveOnPOS && (
      <div className="absolute -top-2.5 right-4 bg-accent text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg z-10 flex items-center gap-1">
        <Zap className="w-2.5 h-2.5" /> Active on POS
      </div>
    )}
    <div className="flex justify-between items-start mb-2">
      <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] font-bold uppercase tracking-tighter">
        Manual Entry
      </span>
      {canEdit && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1 text-text-muted hover:text-accent"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 text-text-muted hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
    <div className="bg-error/5 border-l-2 border-error p-2.5 mb-3 rounded-r-xl">
      <span className="text-[9px] font-black uppercase text-error block mb-1 tracking-wider italic">MANAGER'S MESSAGE</span>
      <p className="text-xs text-text-navy font-semibold leading-relaxed line-clamp-4">{item.message}</p>
    </div>
    
    {(item.focusOfDay || (item.challenges && item.challenges.length > 0)) && (
      <div className="space-y-2 mb-3 border-t border-border-grey/30 pt-2">
        {item.focusOfDay && (
          <div>
            <span className="text-[10px] font-black uppercase text-accent">Focus of the Day:</span>
            <p className="text-[11px] text-text-navy font-medium italic">"{item.focusOfDay}"</p>
          </div>
        )}
        {item.challenges && item.challenges.length > 0 && (
          <div>
            <span className="text-[10px] font-black uppercase text-amber-600">Daily Challenges:</span>
            <ul className="list-disc list-inside text-[11px] text-text-muted">
              {item.challenges.map((c, i) => c && <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>
    )}

    {item.items86 && item.items86.length > 0 && (
      <div className="mb-3">
        <span className="text-[10px] font-black uppercase text-error">Items 86's:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {item.items86.map((item: any, i: number) => (
            <span key={i} className="px-1.5 py-0.5 bg-error/10 text-error rounded text-[9px] font-bold uppercase">
              {item}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Targets Display */}
    {(item.targets?.bar?.cocktailTarget || item.targets?.floor?.dessertTarget || item.targets?.kitchen?.avgPrepTimeTarget || item.targets?.floor?.totalSalesTarget || item.targets?.bar?.premiumDrinkTarget) && (
      <div className="mb-3 grid grid-cols-1 gap-2 p-3 bg-secondary-surface/40 rounded-xl border border-border-grey/30">
        <span className="text-[9px] font-black uppercase text-text-muted mb-1 block">Department Targets</span>
        {item.targets?.floor?.totalSalesTarget && <div className="flex justify-between text-[10px] text-accent"><span className="font-black uppercase">Sales Goal:</span> <span className="font-black">{item.targets.floor.totalSalesTarget}</span></div>}
        {item.targets?.floor?.dessertTarget && <div className="flex justify-between text-[10px]"><span className="font-bold">Floor:</span> <span>{item.targets.floor.dessertTarget}</span></div>}
        {item.targets?.bar?.cocktailTarget && <div className="flex justify-between text-[10px]"><span className="font-bold">Bar (Cocktails):</span> <span>{item.targets.bar.cocktailTarget}</span></div>}
        {item.targets?.bar?.premiumDrinkTarget && <div className="flex justify-between text-[10px]"><span className="font-bold">Bar (Premium):</span> <span>{item.targets.bar.premiumDrinkTarget}</span></div>}
        {item.targets?.kitchen?.avgPrepTimeTarget && <div className="flex justify-between text-[10px]"><span className="font-bold">Kitchen:</span> <span>{item.targets.kitchen.avgPrepTimeTarget}</span></div>}
      </div>
    )}

    {/* Individual Targets */}
    {(item.targets?.individual?.dessertTarget || item.targets?.individual?.cocktailTarget || item.targets?.individual?.salesTarget) && (
      <div className="mb-3 p-3 bg-accent/5 rounded-xl border border-accent/10">
        <span className="text-[9px] font-black uppercase text-accent mb-1 block">Indiv. Challenges</span>
        <div className="grid grid-cols-3 gap-2 text-center">
          {item.targets.individual.dessertTarget && <div><p className="text-[8px] uppercase text-text-muted">Desserts</p><p className="text-[10px] font-black">{item.targets.individual.dessertTarget}</p></div>}
          {item.targets.individual.cocktailTarget && <div><p className="text-[8px] uppercase text-text-muted">Cocktails</p><p className="text-[10px] font-black">{item.targets.individual.cocktailTarget}</p></div>}
          {item.targets.individual.salesTarget && <div><p className="text-[8px] uppercase text-text-muted">Sales</p><p className="text-[10px] font-black">{item.targets.individual.salesTarget}</p></div>}
        </div>
      </div>
    )}

    {/* Specials & Alerts */}
    {( (item.specials && item.specials.some((s: string) => s)) || (item.managerAlerts && item.managerAlerts.some((a: string) => a)) ) && (
      <div className="grid grid-cols-2 gap-2 mb-3">
        {item.specials?.some((s: string) => s) && (
          <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
            <span className="text-[8px] font-black uppercase text-amber-600 block mb-1">Specials</span>
            {item.specials.map((s: string, i: number) => s && <p key={i} className="text-[9px] font-bold leading-tight mb-1 last:mb-0"># {s}</p>)}
          </div>
        )}
        {item.managerAlerts?.some((a: string) => a) && (
          <div className="p-2 bg-red-50 rounded-lg border border-red-100">
            <span className="text-[8px] font-black uppercase text-red-600 block mb-1">Alerts</span>
            {item.managerAlerts.map((a: string, i: number) => a && <p key={i} className="text-[9px] font-black leading-tight text-red-800 mb-1 last:mb-0">! {a}</p>)}
          </div>
        )}
      </div>
    )}

    <div className="flex items-center justify-between text-[10px] text-text-muted font-medium mt-auto pt-3 border-t border-border-grey/50">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" /> {item.shift}
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3" /> By {item.author}
        </div>
      </div>
      {canEdit && !item.isActiveOnPOS && (
        <button 
          onClick={onActivate}
          className="bg-accent/10 text-accent hover:bg-accent hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 active:scale-95"
        >
          <Zap className="w-3 h-3" /> Activate
        </button>
      )}
    </div>
  </div>
);

const ShiftBriefingNoteFormModal = ({ isOpen, onClose, onSave, initialData, recipes }: any) => {
  const [formData, setFormData] = useState({
    message: initialData?.message || '',
    shift: initialData?.shift || 'Lunch' as ShiftType,
    date: initialData?.date || new Date().toISOString().split('T')[0],
    challenges: initialData?.challenges || ['', ''],
    focusOfDay: initialData?.focusOfDay || '',
    items86: initialData?.items86 || [],
    targets: initialData?.targets || {
      floor: { totalSalesTarget: '', dessertTarget: '' },
      bar: { cocktailTarget: '', premiumDrinkTarget: '' },
      kitchen: { avgPrepTimeTarget: '' },
      individual: { salesTarget: '', dessertTarget: '', cocktailTarget: '' }
    },
    specials: initialData?.specials || ['', ''],
    managerAlerts: initialData?.managerAlerts || ['', ''],
  });

  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecipes = recipes.filter((r: Recipe) => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  const toggleItem86 = (name: string) => {
    setFormData(prev => ({
      ...prev,
      items86: prev.items86.includes(name)
        ? prev.items86.filter((i: string) => i !== name)
        : [...prev.items86, name]
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card-bg rounded-2xl border border-border-grey w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-border-grey flex justify-between items-center bg-primary-surface flex-shrink-0">
          <h2 className="text-xl font-bold text-text-navy">
            {initialData ? 'Edit Briefing Note' : 'New Briefing Note'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-navy"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Shift</label>
              <select 
                value={formData.shift}
                onChange={e => setFormData({ ...formData, shift: e.target.value as ShiftType })}
                className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
              >
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
                <option value="All Day">All Day</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Date</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-accent mb-1.5">Focus of the Day</label>
            <input 
              type="text" 
              value={formData.focusOfDay}
              onChange={e => setFormData({ ...formData, focusOfDay: e.target.value })}
              className="w-full bg-accent/5 border border-accent/20 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all font-bold text-accent"
              placeholder="e.g. Guest recognition and wine paring..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Daily Challenges</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input 
                type="text" 
                value={formData.challenges[0]}
                onChange={e => {
                  const newChallenges = [...formData.challenges];
                  newChallenges[0] = e.target.value;
                  setFormData({ ...formData, challenges: newChallenges });
                }}
                className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                placeholder="Challenge 1"
              />
              <input 
                type="text" 
                value={formData.challenges[1]}
                onChange={e => {
                  const newChallenges = [...formData.challenges];
                  newChallenges[1] = e.target.value;
                  setFormData({ ...formData, challenges: newChallenges });
                }}
                className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                placeholder="Challenge 2"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-error mb-1.5 font-black">MANAGER'S MESSAGE</label>
            <textarea 
              value={formData.message}
              onChange={e => setFormData({ ...formData, message: e.target.value })}
              className="w-full bg-error/5 border border-error/20 rounded-xl px-4 py-2 text-sm h-32 resize-none focus:ring-2 focus:ring-error outline-none transition-all font-medium"
              placeholder="Enter special instructions or manager's message..."
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-accent tracking-[0.2em] border-b border-border-grey pb-2">Shift Targets</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-accent mb-1 tracking-widest">Total Sales Target</label>
                <input 
                  type="text" 
                  value={formData.targets.floor?.totalSalesTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      floor: { ...formData.targets.floor, totalSalesTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 text-sm font-black text-accent focus:ring-2 focus:ring-accent outline-none"
                  placeholder="e.g. £4,500 target for tonight"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">Floor Dessert Target</label>
                <input 
                  type="text" 
                  value={formData.targets.floor?.dessertTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      floor: { ...formData.targets.floor, dessertTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  placeholder="e.g. 25 Sticky Toffee Pudding"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">Bar Cocktail Target</label>
                <input 
                  type="text" 
                  value={formData.targets.bar?.cocktailTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      bar: { ...formData.targets.bar, cocktailTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  placeholder="e.g. 50 Espresso Martinis"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">Premium Drinks</label>
                <input 
                  type="text" 
                  value={formData.targets.bar?.premiumDrinkTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      bar: { ...formData.targets.bar, premiumDrinkTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  placeholder="e.g. 10 bottles of Champagne"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">Kitchen Avg Prep Time</label>
                <input 
                  type="text" 
                  value={formData.targets.kitchen?.avgPrepTimeTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      kitchen: { ...formData.targets.kitchen, avgPrepTimeTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  placeholder="e.g. < 12 minutes"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">Indiv. Sales Target</label>
                <input 
                  type="text" 
                  value={formData.targets.individual?.salesTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      individual: { ...formData.targets.individual, salesTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  placeholder="Indiv. Sales"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">Indiv. Desserts Target</label>
                <input 
                  type="text" 
                  value={formData.targets.individual?.dessertTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      individual: { ...formData.targets.individual, dessertTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  placeholder="Indiv. Desserts"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">Indiv. Cocktail Target</label>
                <input 
                  type="text" 
                  value={formData.targets.individual?.cocktailTarget || ''}
                  onChange={e => setFormData({ 
                    ...formData, 
                    targets: { 
                      ...formData.targets, 
                      individual: { ...formData.targets.individual, cocktailTarget: e.target.value } 
                    } 
                  })}
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  placeholder="Indiv. Cocktails"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
              <label className="block text-[10px] font-black uppercase text-amber-800 mb-3 tracking-widest">Specials</label>
              <div className="space-y-2">
                <input 
                  type="text" 
                  value={formData.specials[0]}
                  onChange={e => {
                    const newSpecials = [...formData.specials];
                    newSpecials[0] = e.target.value;
                    setFormData({ ...formData, specials: newSpecials });
                  }}
                  className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Special 1"
                />
                <input 
                  type="text" 
                  value={formData.specials[1]}
                  onChange={e => {
                    const newSpecials = [...formData.specials];
                    newSpecials[1] = e.target.value;
                    setFormData({ ...formData, specials: newSpecials });
                  }}
                  className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Special 2"
                />
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
              <label className="block text-[10px] font-black uppercase text-red-800 mb-3 tracking-widest">Manager Alerts</label>
              <div className="space-y-2">
                <input 
                  type="text" 
                  value={formData.managerAlerts[0]}
                  onChange={e => {
                    const newAlerts = [...formData.managerAlerts];
                    newAlerts[0] = e.target.value;
                    setFormData({ ...formData, managerAlerts: newAlerts });
                  }}
                  className="w-full bg-white border border-red-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-red-500 outline-none font-bold"
                  placeholder="High Priority Alert 1"
                />
                <input 
                  type="text" 
                  value={formData.managerAlerts[1]}
                  onChange={e => {
                    const newAlerts = [...formData.managerAlerts];
                    newAlerts[1] = e.target.value;
                    setFormData({ ...formData, managerAlerts: newAlerts });
                  }}
                  className="w-full bg-white border border-red-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-red-500 outline-none font-bold"
                  placeholder="High Priority Alert 2"
                />
              </div>
            </div>
          </div>

          <div className="bg-primary-surface/50 p-4 rounded-xl border border-border-grey/50">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-error mb-3">Items 86's</label>
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search items to 86..."
              className="w-full bg-main-bg border border-border-grey rounded-lg px-3 py-1.5 text-xs mb-3"
            />
            <div className="flex flex-wrap gap-2 mb-3">
            {formData.items86.map((item: string, idx: number) => (
                <button 
                  key={`${item}-${idx}`}
                  onClick={() => toggleItem86(item)}
                  className="px-2 py-1 bg-error text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-error/80"
                >
                  {item} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {filteredRecipes.map((r: Recipe, idx: number) => (
                <button
                  key={r.id || `${r.name}-${idx}`}
                  onClick={() => toggleItem86(r.name)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all truncate text-left ${
                    formData.items86.includes(r.name)
                      ? 'bg-error border-error text-white'
                      : 'bg-white border-border-grey text-text-muted hover:border-error/40 hover:text-error'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 dark:bg-slate-800 border-t border-border-grey flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-text-muted hover:text-text-navy transition-colors">Cancel</button>
          <button 
            onClick={() => onSave(formData)} 
            className="bg-accent text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:opacity-90 active:scale-95 transition-all"
          >
            {initialData ? 'Update Note' : 'Create Note'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
