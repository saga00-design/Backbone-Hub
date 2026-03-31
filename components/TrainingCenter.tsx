import React, { useState } from 'react';
import { Recipe, ALLERGIES_LIST, InventoryItem } from '../types';
import { Search, Wine, GlassWater, BookOpen, Info, Flame, List, FileText, Download, X } from 'lucide-react';
import { Wheat, Shell, Egg, Fish, Flower2, Milk, Snail, Droplet, Bean, CircleDot, Sprout, FlaskConical, Nut, Leaf } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface TrainingCenterProps {
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
}

const allergyIcons: Record<string, React.ReactNode> = {
  'Celery': <Leaf className="h-4 w-4 text-success" />,
  'Gluten': <Wheat className="h-4 w-4 text-warning" />,
  'Crustaceans': <Shell className="h-4 w-4 text-cta" />,
  'Eggs': <Egg className="h-4 w-4 text-warning" />,
  'Fish': <Fish className="h-4 w-4 text-accent" />,
  'Lupin': <Flower2 className="h-4 w-4 text-accent" />,
  'Milk': <Milk className="h-4 w-4 text-accent" />,
  'Molluscs': <Snail className="h-4 w-4 text-text-muted" />,
  'Mustard': <Droplet className="h-4 w-4 text-warning" />,
  'Peanuts': <Bean className="h-4 w-4 text-warning" />,
  'Sesame': <CircleDot className="h-4 w-4 text-text-navy" />,
  'Soybeans': <Sprout className="h-4 w-4 text-success" />,
  'Sulphites': <FlaskConical className="h-4 w-4 text-accent" />,
  'Tree nuts': <Nut className="h-4 w-4 text-warning" />
};

export const TrainingCenter: React.FC<TrainingCenterProps> = ({ recipes, inventoryItems }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterSubCategory, setFilterSubCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'menu' | 'batches' | 'spirits'>('menu');
  const [selectedItem, setSelectedItem] = useState<Recipe | InventoryItem | null>(null);

  const spiritCategories = ['Spirits', 'Liquor', 'Gin', 'Vodka', 'Rum', 'Tequila', 'Mezcal', 'Whiskey', 'Bourbon', 'Brandy', 'Cognac', 'Liqueur', 'Wine', 'Beer'];

  const itemsToShow = activeTab === 'menu' 
    ? recipes.filter(r => r.type === 'menu_item')
    : activeTab === 'batches'
      ? recipes.filter(r => r.type === 'recipe')
      : inventoryItems.filter(i => 
          spiritCategories.some(cat => 
            (i.category || '').toLowerCase().includes(cat.toLowerCase()) || 
            (i.subCategory || '').toLowerCase().includes(cat.toLowerCase())
          )
        );

  const categories = ['All', ...Array.from(new Set(itemsToShow.map(r => (r as any).category || 'Uncategorized')))];
  const subCategories = activeTab === 'spirits' 
    ? ['All', ...Array.from(new Set(itemsToShow.map(r => (r as any).subCategory).filter(Boolean)))]
    : [];

  const filteredItems = itemsToShow.filter(item => {
    const name = (item as any).name || '';
    const description = (item as any).description || '';
    const matchesSearch = name.toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                          description.toLowerCase().includes((searchTerm || '').toLowerCase());
    const itemCategory = (item as any).category || 'Uncategorized';
    const itemSubCategory = (item as any).subCategory || '';
    
    const matchesCategory = filterCategory === 'All' || itemCategory === filterCategory;
    const matchesSubCategory = filterSubCategory === 'All' || itemSubCategory === filterSubCategory;
    
    return matchesSearch && matchesCategory && matchesSubCategory;
  });

  const getBase64ImageFromUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to fetch image for base64 conversion", e);
      return url; // Fallback to original URL
    }
  };

  const downloadPDF = async (item: Recipe) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(item.name, 14, 22);
    
    // Main Image
    if (item.imageUrl) {
      try {
        let finalImageUrl = item.imageUrl;
        if (!item.imageUrl.startsWith('data:image')) {
          finalImageUrl = await getBase64ImageFromUrl(item.imageUrl);
        }
        
        if (finalImageUrl.startsWith('data:image')) {
          doc.addImage(finalImageUrl, 'JPEG', 140, 10, 50, 40);
        }
      } catch (e) {
        console.error("Failed to add main image to PDF", e);
      }
    }
    
    let yPos = 35;

    // Description
    doc.setFontSize(11);
    doc.setTextColor(0);
    const splitDesc = doc.splitTextToSize(item.description || 'No description available.', 180);
    doc.text(splitDesc, 14, yPos);
    yPos += (splitDesc.length * 5) + 5;
    
    // Ingredients
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Ingredients", 14, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    if (item.ingredients && item.ingredients.length > 0) {
      item.ingredients.forEach(ing => {
        const invItem = inventoryItems.find(i => i.id === ing.inventoryItemId);
        if (invItem) {
          doc.text(`• ${invItem.name}`, 18, yPos);
          yPos += 6;
        }
      });
    } else {
      doc.text("Not specified", 18, yPos);
      yPos += 6;
    }
    
    yPos += 5;

    // Allergens & Calories
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Allergens:", 14, yPos);
    doc.setFont("helvetica", "normal");
    const allergensText = item.allergies && item.allergies.length > 0 ? item.allergies.join(', ') : 'None reported';
    doc.text(allergensText, 40, yPos);
    yPos += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Calories:", 14, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(item.calories ? `${item.calories} kcal` : 'Not specified', 40, yPos);
    yPos += 8;

    // Pairings
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Pairings", 14, yPos);
    yPos += 6;
    
    const renderPairing = (label: string, pairing: any) => {
      if (!pairing || !pairing.name) return;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, yPos);
      doc.setFont("helvetica", "normal");
      const splitName = doc.splitTextToSize(pairing.name, 150);
      doc.text(splitName, 40, yPos);
      yPos += (splitName.length * 4) + 2;

      const notes = [
        { l: 'Nose', v: pairing.nose },
        { l: 'Palate', v: pairing.palate },
        { l: 'Finish', v: pairing.finish },
        { l: 'Aromas', v: pairing.aromas }
      ].filter(n => n.v);

      notes.forEach(note => {
        doc.setFont("helvetica", "bold");
        doc.text(`  ${note.l}:`, 14, yPos);
        doc.setFont("helvetica", "normal");
        const splitNote = doc.splitTextToSize(note.v, 140);
        doc.text(splitNote, 40, yPos);
        yPos += (splitNote.length * 4) + 1;
      });
      yPos += 2;
    };

    if (item.category === 'Beverage') {
      renderPairing('Starter', item.starterPairing);
      renderPairing('Main', item.mainPairing);
      renderPairing('Dessert', item.dessertPairing);
    } else {
      renderPairing('Wine', item.winePairing);
      renderPairing('Tequila', item.tequilaPairing);
      renderPairing('Mezcal', item.mezcalPairing);
      renderPairing('Cocktail', item.cocktailPairing);
    }

    yPos += 4;
    
    // Training Steps
    if (item.trainingSteps && item.trainingSteps.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Training Guide", 14, yPos);
      yPos += 10;
      
      item.trainingSteps.forEach((step, index) => {
        if (yPos > 220) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Step ${index + 1}`, 14, yPos);
        yPos += 6;
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const splitStepDesc = doc.splitTextToSize(step.description || '', 180);
        doc.text(splitStepDesc, 14, yPos);
        yPos += (splitStepDesc.length * 5) + 5;
        
        if (step.image) {
          try {
            if (step.image.startsWith('data:image')) {
              doc.addImage(step.image, 'JPEG', 14, yPos, 40, 30);
              yPos += 35;
            }
          } catch (e) {
            console.error("Failed to add image to PDF", e);
          }
        }
        
        yPos += 5;
      });
    }
    
    doc.save(`${item.name.replace(/\s+/g, '_')}_Training_Guide.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200 dark:border-slate-800 mb-8 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm inline-flex">
        <button
          onClick={() => { setActiveTab('menu'); setFilterCategory('All'); }}
          className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'menu' 
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Menu Items
        </button>
        <button
          onClick={() => { setActiveTab('batches'); setFilterCategory('All'); }}
          className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'batches' 
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Prep & Batches
        </button>
        <button
          onClick={() => { setActiveTab('spirits'); setFilterCategory('All'); }}
          className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'spirits' 
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Spirits & Bottles
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800">
        <div className="relative flex-1 max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl leading-5 bg-gray-50 dark:bg-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-gray-900 dark:text-white transition-all"
            placeholder={`Search ${activeTab === 'menu' ? 'menu items' : activeTab === 'batches' ? 'prep & batches' : 'spirits & bottles'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <select
            className="block w-full sm:w-56 pl-4 pr-10 py-3 text-sm border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white font-medium transition-all"
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setFilterSubCategory('All'); }}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          
          {activeTab === 'spirits' && subCategories.length > 1 && (
            <select
              className="block w-full sm:w-56 pl-4 pr-10 py-3 text-sm border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white font-medium transition-all"
              value={filterSubCategory}
              onChange={(e) => setFilterSubCategory(e.target.value)}
            >
              {subCategories.map(subCat => (
                <option key={subCat} value={subCat}>{subCat}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredItems.map(item => (
          <div key={item.id} className="group bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="aspect-[4/3] w-full relative overflow-hidden">
              <img 
                src={(item as any).imageUrl || `https://picsum.photos/seed/${encodeURIComponent(item.name)}/600/450`} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black text-blue-600 dark:text-blue-400 shadow-lg uppercase tracking-widest border border-white/20">
                {(item as any).category || 'Uncategorized'}
              </div>
              {(item as any).subCategory && (
                <div className="absolute top-12 right-3 bg-blue-600/90 dark:bg-blue-500/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black text-white shadow-lg uppercase tracking-widest border border-blue-400/20">
                  {(item as any).subCategory}
                </div>
              )}
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 line-clamp-1 uppercase tracking-tight">{item.name}</h3>
              {(item as any).type === 'menu_item' || activeTab === 'spirits' ? (
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">{(item as any).description || 'No description available.'}</p>
              ) : null}
              
              <div className="space-y-4 mt-auto pt-4 border-t border-gray-100 dark:border-slate-800">
                {/* Ingredients Summary */}
                {activeTab !== 'spirits' && (
                  <div className="flex items-start gap-3">
                    <div className="bg-gray-100 dark:bg-slate-800 p-1.5 rounded-lg">
                        <List className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {(item as any).ingredients && (item as any).ingredients.length > 0 ? (
                        (item as any).ingredients.map((ing: any) => {
                          const invItem = inventoryItems.find(i => i.id === ing.inventoryItemId);
                          return invItem ? invItem.name : '';
                        }).filter(Boolean).join(', ')
                      ) : (
                        <span className="text-gray-400 italic">No ingredients listed</span>
                      )}
                    </p>
                  </div>
                )}

                {activeTab === 'spirits' && (
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-gray-400 dark:text-slate-500">Stock: <span className="text-gray-900 dark:text-white">{(item as InventoryItem).quantity} {(item as InventoryItem).unit}</span></span>
                    <span className="text-blue-600 dark:text-blue-400">£{(item as InventoryItem).pricePerUnit.toFixed(2)}</span>
                  </div>
                )}

                {(item as any).type === 'menu_item' && (
                  <div className="flex flex-wrap gap-2">
                    {(item as any).allergies && (item as any).allergies.slice(0, 3).map((allergy: string) => (
                      <span key={allergy} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30">
                        {allergy}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setSelectedItem(item as any)}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {activeTab === 'spirits' ? 'Product Info' : 'Training Guide'}
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {filteredItems.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800">
            <div className="bg-gray-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="h-10 w-10 text-gray-300 dark:text-slate-700" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">No items found</h3>
            <p className="text-gray-500 dark:text-slate-400 mt-2">Try adjusting your search or category filter.</p>
          </div>
        )}
      </div>

      {/* Training Guide Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-2xl max-w-6xl w-full h-full sm:h-auto sm:max-h-[95vh] flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 sm:p-8 border-b border-gray-100 dark:border-slate-800 gap-4 bg-white dark:bg-slate-900 sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-2xl">
                    <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedItem.name}</h2>
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{activeTab === 'spirits' ? 'Product Specification' : 'Training & Preparation Guide'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 w-full sm:w-auto justify-end">
                <button 
                    onClick={() => setSelectedItem(null)} 
                    className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 p-3 rounded-2xl transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-gray-50/30 dark:bg-slate-900/50 no-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                <div className="lg:col-span-1 space-y-8">
                  <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800">
                    <img 
                      src={(selectedItem as any).imageUrl || `https://picsum.photos/seed/${encodeURIComponent(selectedItem.name)}/800/800`} 
                      alt={selectedItem.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Description & Upselling</h3>
                    <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{(selectedItem as any).description || 'No description available.'}</p>
                  </div>

                  {activeTab !== 'spirits' && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Ingredients</h3>
                      <ul className="space-y-3">
                        {(selectedItem as Recipe).ingredients && (selectedItem as Recipe).ingredients.length > 0 ? (
                          (selectedItem as Recipe).ingredients.map(ing => {
                            const invItem = inventoryItems.find(i => i.id === ing.inventoryItemId);
                            return invItem ? (
                              <li key={ing.inventoryItemId} className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-slate-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {invItem.name}
                              </li>
                            ) : null;
                          })
                        ) : (
                          <li className="text-sm text-gray-400 italic">Not specified</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {activeTab === 'spirits' && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Product Details</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
                          <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Category</span>
                          <span className="text-sm font-black text-gray-900 dark:text-white">{(selectedItem as InventoryItem).category}</span>
                        </div>
                        {(selectedItem as InventoryItem).subCategory && (
                          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
                            <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Sub-category</span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">{(selectedItem as InventoryItem).subCategory}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
                          <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Unit</span>
                          <span className="text-sm font-black text-gray-900 dark:text-white">{(selectedItem as InventoryItem).unit}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Price</span>
                          <span className="text-sm font-black text-blue-600 dark:text-blue-400">£{(selectedItem as InventoryItem).pricePerUnit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Allergens</h4>
                      {(selectedItem as any).allergies && (selectedItem as any).allergies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(selectedItem as any).allergies.map((allergy: string) => (
                            <span key={allergy} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30">
                              {allergyIcons[allergy] || '⚠️'} {allergy}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">None</span>
                      )}
                    </div>
                    {activeTab !== 'spirits' && (
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Calories</h4>
                        <p className="text-lg font-black text-gray-900 dark:text-white">
                          {(selectedItem as Recipe).calories ? `${(selectedItem as Recipe).calories} kcal` : <span className="text-gray-400 italic">N/A</span>}
                        </p>
                      </div>
                    )}
                  </div>

                  {activeTab === 'menu' && (selectedItem as Recipe).type === 'menu_item' && (
                    <div className="space-y-6">
                      <h3 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-3">Pairings & Recommendations</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {((selectedItem as Recipe).category === 'Beverage' ? [
                          { label: 'Starter', key: 'starterPairing', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-900/30' },
                          { label: 'Main', key: 'mainPairing', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-900/30' },
                          { label: 'Dessert', key: 'dessertPairing', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-900/30' }
                        ] : [
                          { label: 'Wine', key: 'winePairing', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-100 dark:border-rose-900/30' },
                          { label: 'Tequila', key: 'tequilaPairing', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-900/30' },
                          { label: 'Mezcal', key: 'mezcalPairing', color: 'text-slate-900 dark:text-white', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
                          { label: 'Cocktail', key: 'cocktailPairing', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-900/30' }
                        ]).map((p) => {
                          const pairing = (selectedItem as Recipe)[p.key as keyof Recipe] as any;
                          if (!pairing || !pairing.name) return null;
                          return (
                            <div key={p.key} className={`${p.bg} ${p.border} p-5 rounded-2xl border shadow-sm`}>
                              <h4 className={`text-sm font-black ${p.color} mb-3 uppercase tracking-tight`}>{p.label}: {pairing.name}</h4>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                {pairing.nose && (
                                  <div>
                                    <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Nose</span>
                                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-tight">{pairing.nose}</p>
                                  </div>
                                )}
                                {pairing.palate && (
                                  <div>
                                    <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Palate</span>
                                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-tight">{pairing.palate}</p>
                                  </div>
                                )}
                                {pairing.finish && (
                                  <div>
                                    <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Finish</span>
                                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-tight">{pairing.finish}</p>
                                  </div>
                                )}
                                {pairing.aromas && (
                                  <div>
                                    <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Aromas</span>
                                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-tight">{pairing.aromas}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-8 border-b border-gray-100 dark:border-slate-800 pb-4 uppercase tracking-tight">
                    {activeTab === 'spirits' ? 'Upselling & Product Knowledge' : 'Step-by-Step Training Guide'}
                  </h3>
                  {(selectedItem as any).trainingSteps && (selectedItem as any).trainingSteps.length > 0 ? (
                    <div className="space-y-8 sm:space-y-12">
                      {(selectedItem as any).trainingSteps.map((step: any, index: number) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-6 bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-xl hover:shadow-2xl transition-all duration-300">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-blue-500/30">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 space-y-6">
                            <p className="text-base sm:text-lg text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed font-medium">{step.description}</p>
                            {step.image && (
                              <div className="relative rounded-2xl overflow-hidden border-4 border-gray-50 dark:border-slate-700 shadow-2xl max-w-full sm:max-w-xl">
                                <img 
                                  src={step.image} 
                                  alt={`Step ${index + 1}`} 
                                  className="w-full h-auto max-h-[400px] object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === 'spirits' ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-8 sm:p-12 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-inner">
                      <div className="flex flex-col sm:flex-row items-start gap-8">
                        <div className="bg-blue-600 dark:bg-blue-500 p-4 rounded-2xl shadow-xl shadow-blue-500/20">
                          <Info className="h-8 w-8 text-white" />
                        </div>
                        <div className="space-y-8 flex-1">
                          <div>
                            <h4 className="text-2xl font-black text-blue-900 dark:text-blue-300 mb-4 uppercase tracking-tight">Upselling Tips: {selectedItem.name}</h4>
                            <p className="text-lg text-blue-800/80 dark:text-blue-300/80 leading-relaxed font-medium">
                                {(selectedItem as InventoryItem).description ? (selectedItem as InventoryItem).description : (
                                <>
                                    Knowledge of our <strong>{(selectedItem as InventoryItem).subCategory || (selectedItem as InventoryItem).category}</strong> is key to providing a premium experience. 
                                    When a customer orders a standard drink, always offer a premium upgrade to <strong>{selectedItem.name}</strong>.
                                    This specific bottle is known for its exceptional quality and distinct flavor profile that elevates any cocktail.
                                </>
                                )}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-blue-100 dark:border-blue-900/30">
                              <h5 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">When to Recommend</h5>
                              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                                {selectedItem.name.toLowerCase().includes('tequila') ? 'Perfect for premium Margaritas or sipping neat with a slice of orange.' : 
                                 selectedItem.name.toLowerCase().includes('gin') ? 'Ideal for a crisp G&T with premium tonic and fresh botanicals.' :
                                 selectedItem.name.toLowerCase().includes('vodka') ? 'Best for clean, smooth Martinis or refreshing long drinks.' :
                                 selectedItem.name.toLowerCase().includes('whiskey') || selectedItem.name.toLowerCase().includes('bourbon') ? 'Excellent for Old Fashioneds or enjoying on the rocks.' :
                                 'Customers looking for a higher quality alternative to our house spirits.'}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-blue-100 dark:border-blue-900/30">
                              <h5 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Key Selling Point</h5>
                              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                                {selectedItem.name.toLowerCase().includes('tequila') ? '100% Agave with a smooth, earthy finish.' : 
                                 selectedItem.name.toLowerCase().includes('gin') ? 'Complex botanical blend with a refreshing juniper-forward taste.' :
                                 selectedItem.name.toLowerCase().includes('vodka') ? 'Multiple distillations for ultimate purity and smoothness.' :
                                 selectedItem.name.toLowerCase().includes('whiskey') || selectedItem.name.toLowerCase().includes('bourbon') ? 'Aged to perfection with rich notes of oak and caramel.' :
                                 'Premium quality that significantly improves the overall drink experience.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800">
                      <BookOpen className="mx-auto h-16 w-16 text-gray-200 dark:text-slate-800 mb-6" />
                      <p className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">No training steps found</p>
                      <p className="text-gray-500 dark:text-slate-400 mt-2">Add steps in the Menu Recipes section to see them here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
