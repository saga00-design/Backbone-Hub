import React, { useState } from 'react';
import { MenuCategory } from '../../types';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { db, collection, addDoc, deleteDoc, doc, handleFirestoreError, OperationType, cleanObject } from '../../firebase';

interface MenuManagementProps {
  menuCategories: MenuCategory[];
  userId: string;
}

export const MenuManagement: React.FC<MenuManagementProps> = ({ menuCategories, userId }) => {
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    try {
      await addDoc(collection(db, `users/${userId}/menuCategories`), cleanObject({
        name: newCategoryName,
        path: newCategoryName
      }));
      setNewCategoryName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'menuCategories');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, `users/${userId}/menuCategories`, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `menuCategories/${id}`);
    }
  };

  const prePopulateBarMenu = async () => {
    const barMenu = {
      'Bar Menu': 'Bar Menu',
      'Spirits': 'Bar Menu > Spirits',
      'Wines': 'Bar Menu > Wines',
      'Cocktails': 'Bar Menu > Cocktails'
    };
    for (const [name, path] of Object.entries(barMenu)) {
      try {
        await addDoc(collection(db, `users/${userId}/menuCategories`), cleanObject({
          name: name,
          path: path
        }));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'menuCategories');
      }
    }
  };

  const prePopulateSpirits = async () => {
    const spirits = ['Gin', 'Vodka', 'Whiskey', 'Rum', 'Tequila', 'Mezcal', 'Brandy', 'Liqueurs'];
    for (const spirit of spirits) {
      try {
        await addDoc(collection(db, `users/${userId}/menuCategories`), cleanObject({
          name: spirit,
          path: `Beverage > Spirits > ${spirit}`
        }));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'menuCategories');
      }
    }
  };

  return (
    <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
      <h2 className="text-xl font-bold mb-4 text-[#d9e2ec]">Menu Management</h2>
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={newCategoryName} 
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New Category Name"
          className="flex-1 p-2 bg-[#2a2a2a] rounded-lg text-[#d9e2ec] border border-[#3a3a3a] focus:outline-none focus:border-[#486581]"
        />
        <button onClick={handleAddCategory} className="p-2 bg-[#486581] rounded-lg text-white hover:bg-[#5a7a9a] transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <button onClick={prePopulateSpirits} className="w-full p-2 mb-4 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-[#486581] hover:bg-[#3a3a3a] transition-colors font-bold text-sm uppercase tracking-wider">
        Pre-populate Spirits Sub-categories
      </button>
      <button onClick={prePopulateBarMenu} className="w-full p-2 mb-4 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-[#486581] hover:bg-[#3a3a3a] transition-colors font-bold text-sm uppercase tracking-wider">
        Pre-populate Bar Menu
      </button>
      <div className="space-y-2">
        {menuCategories.map(cat => (
          <div key={cat.id} className="flex justify-between items-center p-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
            <span className="text-[#d9e2ec] text-sm">{cat.name} <span className="text-[#666] text-xs ml-2">({cat.path})</span></span>
            <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:text-red-400 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
