import React, { useState, useEffect } from 'react';
import { InventoryItem, Modifier } from '../types';
import { Button } from './Button';
import { Plus, Trash2, Edit2, Search } from 'lucide-react';
import { db, collection, addDoc, deleteDoc, doc, onSnapshot, handleFirestoreError, OperationType, cleanObject, auth, updateDoc, query, where, LOCATION_ID } from '../firebase';
import { logAuditAction } from '../services/auditService';

interface ModifierManagementProps {
  inventoryItems: InventoryItem[];
  triggerCreate?: number;
}

export const ModifierManagement: React.FC<ModifierManagementProps> = ({ inventoryItems, triggerCreate }) => {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [editingModifier, setEditingModifier] = useState<Partial<Modifier>>({
    name: '',
    price: 0,
    inventoryItemId: '',
    quantity: 1
  });

  useEffect(() => {
    if (triggerCreate && triggerCreate > 0) {
      setEditingModifier({ name: '', price: 0, inventoryItemId: '', quantity: 1 });
      setIsModalOpen(true);
    }
  }, [triggerCreate]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(query(collection(db, 'modifiers'), where('locationId', '==', LOCATION_ID)), (snapshot) => {
      setModifiers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Modifier)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'modifiers'));
    return unsub;
  }, []);

  const handleEdit = (mod: Modifier) => {
    setEditingModifier(mod);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!auth.currentUser || !editingModifier.name) return;
    try {
      if (editingModifier.id) {
        const { id, ...data } = editingModifier;
        const updatedData = {
          ...data,
          locationId: LOCATION_ID,
          updatedAt: new Date().toISOString()
        };
        
        // Audit log
        const oldMod = modifiers.find(m => m.id === id);
        logAuditAction(
          auth.currentUser.uid,
          auth.currentUser.displayName || auth.currentUser.email || 'Unknown',
          'UPDATE',
          'Modifier',
          id!,
          editingModifier.name || 'Unknown',
          oldMod,
          updatedData
        );

        await updateDoc(doc(db, 'modifiers', id!), cleanObject(updatedData));
      } else {
        const newMod = {
          ...editingModifier,
          locationId: LOCATION_ID,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, 'modifiers'), cleanObject(newMod));
        
        // Audit log
        logAuditAction(
          auth.currentUser.uid,
          auth.currentUser.displayName || auth.currentUser.email || 'Unknown',
          'CREATE',
          'Modifier',
          docRef.id,
          editingModifier.name || 'Unknown',
          null,
          newMod
        );
      }
      setIsModalOpen(false);
      setEditingModifier({ name: '', price: 0, inventoryItemId: '', quantity: 1 });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'modifiers');
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    const modToDelete = modifiers.find(m => m.id === id);
    try {
      await deleteDoc(doc(db, 'modifiers', id));
      // Audit log
      logAuditAction(
        auth.currentUser.uid,
        auth.currentUser.displayName || auth.currentUser.email || 'Unknown',
        'DELETE' as any,
        'Modifier',
        id,
        modToDelete?.name || 'Unknown',
        modToDelete,
        null
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `modifiers/${id}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-main-bg min-h-full">
      <div className="flex justify-between items-center mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-text-navy tracking-tight">Modifier Management</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {modifiers.map(mod => (
          <div key={mod.id} className="bg-card-bg p-4 sm:p-6 rounded-2xl border border-border-grey hover:border-accent/50 transition-all shadow-lg group relative">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div>
                <h3 className="font-bold text-text-navy text-base sm:text-lg">{mod.name}</h3>
                <p className="text-xs sm:text-sm font-bold text-accent mt-0.5 sm:mt-1">£{mod.price.toFixed(2)}</p>
              </div>
              <div className="flex space-x-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(mod)} className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(mod.id)} className="p-2 text-cta hover:bg-error/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {mod.inventoryItemId && (
              <div className="mt-4 pt-4 border-t border-border-grey">
                <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-1">Linked Inventory</p>
                <p className="text-xs text-text-navy">
                  {inventoryItems.find(i => i.id === mod.inventoryItemId)?.name} 
                  <span className="text-accent ml-2">({mod.quantity} {inventoryItems.find(i => i.id === mod.inventoryItemId)?.unit})</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 z-50">
          <div className="bg-card-bg p-6 sm:p-8 rounded-3xl w-full max-w-md border border-border-grey shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl sm:text-2xl font-bold text-text-navy mb-6 sm:mb-8">
              {editingModifier.id ? 'Edit Modifier' : 'Add Modifier'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Modifier Name</label>
                <input 
                  className="w-full p-3 bg-main-bg border border-border-grey rounded-xl text-text-navy focus:outline-none focus:border-accent placeholder-text-muted/50" 
                  placeholder="e.g. Extra Cheese" 
                  value={editingModifier.name} 
                  onChange={e => setEditingModifier({...editingModifier, name: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Price (£)</label>
                <input 
                  className="w-full p-3 bg-main-bg border border-border-grey rounded-xl text-text-navy focus:outline-none focus:border-accent placeholder-text-muted/50" 
                  type="number" 
                  step="0.01"
                  placeholder="0.00" 
                  value={editingModifier.price} 
                  onChange={e => setEditingModifier({...editingModifier, price: parseFloat(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Link to Inventory</label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      className="w-full p-2 pl-9 bg-main-bg border border-border-grey rounded-xl text-xs text-text-navy focus:outline-none focus:border-accent placeholder-text-muted/50" 
                      placeholder="Search inventory..." 
                      value={inventorySearch}
                      onChange={e => setInventorySearch(e.target.value)}
                    />
                  </div>
                  <select 
                    className="w-full p-3 bg-main-bg border border-border-grey rounded-xl text-text-navy focus:outline-none focus:border-accent appearance-none" 
                    value={editingModifier.inventoryItemId} 
                    onChange={e => setEditingModifier({...editingModifier, inventoryItemId: e.target.value})}
                  >
                    <option value="">No Inventory Link</option>
                    {inventoryItems
                      .filter(i => i.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                      .map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)
                    }
                  </select>
                </div>
              </div>
              {editingModifier.inventoryItemId && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 block">Deduction Quantity</label>
                  <input 
                    className="w-full p-3 bg-main-bg border border-border-grey rounded-xl text-text-navy focus:outline-none focus:border-accent placeholder-text-muted/50" 
                    type="number" 
                    placeholder="Quantity to deduct" 
                    value={editingModifier.quantity} 
                    onChange={e => setEditingModifier({...editingModifier, quantity: parseFloat(e.target.value)})} 
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <Button 
                variant="secondary" 
                onClick={() => setIsModalOpen(false)}
                className="bg-transparent border border-border-grey text-text-muted hover:text-text-navy hover:bg-secondary-surface px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-accent hover:opacity-90 text-white px-8 py-2 rounded-xl shadow-lg shadow-accent/20 font-bold uppercase tracking-widest text-[10px]"
              >
                Save Modifier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
