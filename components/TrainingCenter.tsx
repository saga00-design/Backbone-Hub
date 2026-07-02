import React, { useState, useMemo } from 'react';
import { Recipe, ALLERGIES_LIST, InventoryItem, StaffCertification } from '../types';
import { Search, Wine, GlassWater, BookOpen, Info, Flame, List, FileText, Download, X, HelpCircle, ChevronRight, CheckCircle2, AlertCircle, ChevronDown, Trophy } from 'lucide-react';
import { Wheat, Shell, Egg, Fish, Flower2, Milk, Snail, Droplet, Bean, CircleDot, Sprout, FlaskConical, Nut, Leaf } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { motion } from 'motion/react';
import { db, collection, addDoc, LOCATION_ID, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { QuizBankManager } from './QuizBankManager';

interface TrainingCenterProps {
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  staffId?: string;
  staffName?: string;
  certifications?: StaffCertification[];
  quizSubmissions?: any[];
  staffMembers?: { id: string; firstName: string; lastName: string }[];
  isAdmin?: boolean;
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

export const TrainingCenter: React.FC<TrainingCenterProps> = ({ recipes, inventoryItems, staffId, staffName, certifications = [], quizSubmissions = [], staffMembers = [], isAdmin = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterSubCategory, setFilterSubCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'menu' | 'batches' | 'spirits' | 'stats' | 'quizbank'>('menu');
  const [selectedItem, setSelectedItem] = useState<Recipe | InventoryItem | null>(null);

  // Resolve a display name from a quiz submission — uses saved staffName first,
  // then tries staffMembers lookup by id, then falls back to a short ID fragment.
  const resolveStaffName = (q: any): string => {
    if (q.staffName && q.staffName !== 'Unknown') return q.staffName;
    const member = staffMembers.find(m => m.id === q.staffId);
    if (member) return `${member.firstName} ${member.lastName}`.trim();
    return q.staffId ? `Staff ${q.staffId.slice(-4)}` : 'Unknown';
  };
  const [quizItem, setQuizItem] = useState<Recipe | null>(null);
  const [quizState, setQuizState] = useState<{
    currentQuestion: number;
    score: number;
    showResults: boolean;
    answers: (string | string[])[];
  } | null>(null);

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

  const categories = ['All', ...Array.from(new Set(itemsToShow.map(r => (r as any).category || 'Uncategorized').filter(c => c !== 'All')))];
  const subCategories = activeTab === 'spirits' 
    ? ['All', ...Array.from(new Set(itemsToShow.map(r => (r as any).subCategory).filter(s => s && s !== 'All')))]
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
        const stepLabel = step.title ? `Step ${index + 1}: ${step.title}` : `Step ${index + 1}`;
        doc.text(stepLabel, 14, yPos);
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

  const generateQuestions = (item: Recipe) => {
    const questions: { text: string; options: string[]; answer: string | string[]; type: 'single' | 'multiple' }[] = [];

    // Ingredients Question
    if (item.ingredients && item.ingredients.length > 0) {
      const allIngs = item.ingredients.map(ing => inventoryItems.find(i => i.id === ing.inventoryItemId)?.name).filter(Boolean);
      if (allIngs.length > 0) {
        questions.push({
          text: `Which of these is a key ingredient in ${item.name}?`,
          options: [...new Set([allIngs[0]!, 'Salted Butter', 'Fresh Cream', 'Dill Picks'].sort(() => Math.random() - 0.5))],
          answer: allIngs[0]!,
          type: 'single'
        });
      }
    }

    // Calories Question
    if (item.calories) {
      const calories = item.calories;
      questions.push({
        text: `Approx. how many calories are in this dish?`,
        options: [`${Math.round(calories * 0.8)}`, `${calories}`, `${Math.round(calories * 1.2)}`, `${Math.round(calories * 1.5)}`].sort(() => Math.random() - 0.5),
        answer: `${calories}`,
        type: 'single'
      });
    }

    // Allergies Question
    if (item.allergies && item.allergies.length > 0) {
      questions.push({
        text: `Which allergens are present in this item?`,
        options: [...new Set([...item.allergies, 'Celery', 'Mustard', 'Gluten'].slice(0, 4).sort(() => Math.random() - 0.5))],
        answer: item.allergies,
        type: 'multiple'
      });
    } else {
      questions.push({
        text: `Is this item reported as allergen-free across the main 14 allergens?`,
        options: ['Yes', 'No, contains hidden traces', 'Only with modifications'],
        answer: 'Yes',
        type: 'single'
      });
    }

    // Pairings Question
    const pairings = [item.winePairing, item.tequilaPairing, item.mezcalPairing, item.cocktailPairing, item.starterPairing, item.mainPairing, item.dessertPairing].filter(p => p && p.name);
    if (pairings.length > 0) {
      questions.push({
        text: `What is a recommended pairing for this ${item.category || 'item'}?`,
        options: [...new Set([pairings[0]!.name, 'House Red', 'Sparkling Water', 'Draft Beer'].sort(() => Math.random() - 0.5))],
        answer: pairings[0]!.name,
        type: 'single'
      });
    }

    return questions;
  };

  const startQuiz = (item: Recipe) => {
    setQuizItem(item);
    const questions = generateQuestions(item);
    setQuizState({
      currentQuestion: 0,
      score: 0,
      showResults: false,
      answers: questions.map(q => q.type === 'multiple' ? [] : '')
    });
  };

  const handleAnswer = (option: string) => {
    if (!quizState || !quizItem) return;
    const questions = generateQuestions(quizItem);
    const q = questions[quizState.currentQuestion];
    
    const newAnswers = [...quizState.answers];
    if (q.type === 'multiple') {
      const currentArr = newAnswers[quizState.currentQuestion] as string[];
      if (currentArr.includes(option)) {
        newAnswers[quizState.currentQuestion] = currentArr.filter(a => a !== option);
      } else {
        newAnswers[quizState.currentQuestion] = [...currentArr, option];
      }
    } else {
      newAnswers[quizState.currentQuestion] = option;
    }

    setQuizState({ ...quizState, answers: newAnswers });
  };

  const nextQuestion = async () => {
    if (!quizState || !quizItem) return;
    const questions = generateQuestions(quizItem);
    const q = questions[quizState.currentQuestion];
    const userAnswer = quizState.answers[quizState.currentQuestion];
    
    let isCorrect = false;
    if (q.type === 'multiple') {
      const userArr = userAnswer as string[];
      const correctArr = q.answer as string[];
      isCorrect = userArr.length === correctArr.length && userArr.every(a => correctArr.includes(a));
    } else {
      isCorrect = userAnswer === q.answer;
    }

    const newScore = isCorrect ? quizState.score + 1 : quizState.score;

    if (quizState.currentQuestion + 1 < questions.length) {
      setQuizState({
        ...quizState,
        currentQuestion: quizState.currentQuestion + 1,
        score: newScore
      });
    } else {
      const passed = newScore === questions.length;
      
      // SAVE TO FIRESTORE
      if (staffId) {
        try {
          const cert: Omit<StaffCertification, 'id'> = {
            locationId: LOCATION_ID,
            staffId: staffId,
            staffName: staffName || 'Anonymous Staff',
            recipeId: quizItem.id,
            recipeName: quizItem.name,
            score: newScore,
            total: questions.length,
            passed,
            completedAt: new Date().toISOString()
          };
          await addDoc(collection(db, 'staffCertifications'), cert);
          toast.success(passed ? 'Certification earned!' : 'Results saved.');
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'staffCertifications');
        }
      }

      setQuizState({
        ...quizState,
        score: newScore,
        showResults: true
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200 dark:border-slate-800 mb-8 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm inline-flex">
        <button
          onClick={() => { setActiveTab('menu'); setFilterCategory('All'); }}
          className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'menu' 
              ? 'bg-primary-surface dark:bg-dark-navy/30 text-accent dark:text-accent/80 shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Menu Items
        </button>
        <button
          onClick={() => { setActiveTab('batches'); setFilterCategory('All'); }}
          className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'batches' 
              ? 'bg-primary-surface dark:bg-dark-navy/30 text-accent dark:text-accent/80 shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Prep & Batches
        </button>
        <button
          onClick={() => { setActiveTab('spirits'); setFilterCategory('All'); }}
          className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'spirits' 
              ? 'bg-primary-surface dark:bg-dark-navy/30 text-accent dark:text-accent/80 shadow-sm' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          Spirits & Bottles
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
              activeTab === 'stats' 
                ? 'bg-accent/10 dark:bg-accent/20 text-accent dark:text-accent shadow-sm border border-accent/20' 
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            Manager Stats
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('quizbank')}
            className={`py-2 px-6 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
              activeTab === 'quizbank'
                ? 'bg-accent/10 dark:bg-accent/20 text-accent dark:text-accent shadow-sm border border-accent/20'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            Quiz Bank
          </button>
        )}
      </div>

      {activeTab === 'quizbank' ? (
        <QuizBankManager staffName={staffName} />
      ) : activeTab === 'stats' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-accent/10 rounded-lg text-accent"><Trophy className="h-5 w-5" /></div>
                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Total Certifications</h3>
              </div>
              <p className="text-3xl font-black text-text-navy dark:text-white">{certifications.length}</p>
              <p className="text-[10px] text-gray-400 mt-1">Historically recorded knowledge tests</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-success/10 rounded-lg text-success"><CheckCircle2 className="h-5 w-5" /></div>
                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Pass Rate</h3>
              </div>
              <p className="text-3xl font-black text-success">
                {certifications.length > 0 
                  ? Math.round((certifications.filter(c => c.passed).length / certifications.length) * 100) 
                  : 0}%
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Global average across all staff</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-warning/10 rounded-lg text-warning"><HelpCircle className="h-5 w-5" /></div>
                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Top Dish Certified</h3>
              </div>
              <p className="text-3xl font-black text-text-navy dark:text-white">
                {(() => {
                  const counts: Record<string, number> = {};
                  certifications.forEach(c => { counts[c.recipeName] = (counts[c.recipeName] || 0) + 1; });
                  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                  return top ? top[0] : 'N/A';
                })()}
              </p>
              <p className="text-[10px] text-gray-400 mt-1 truncate">Most frequently tested recipe</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-black text-text-navy dark:text-white uppercase tracking-widest">Recent Certifications History</h3>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-[10px] font-bold text-gray-500">Live Feed</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                    <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Staff Member</th>
                    <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Recipe / Item</th>
                    <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Result</th>
                    <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {certifications.slice(0, 20).map(cert => (
                    <tr key={cert.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-[10px]">
                            {cert.staffName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-navy dark:text-white">{cert.staffName}</p>
                            <p className="text-[8px] text-gray-400 uppercase font-bold tracking-widest">ID: {cert.staffId.slice(-6)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-text-navy dark:text-white">{cert.recipeName}</p>
                      </td>
                      <td className="px-6 py-4">
                        {cert.passed ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 text-success text-[10px] font-black uppercase tracking-widest">
                            <CheckCircle2 className="h-3.5 w-3.5" /> PASSED ({cert.score}/{cert.total})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cta/10 text-cta text-[10px] font-black uppercase tracking-widest">
                            <AlertCircle className="h-3.5 w-3.5" /> FAILED ({cert.score}/{cert.total})
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                          {new Date(cert.completedAt).toLocaleDateString()}
                        </p>
                        <p className="text-[9px] text-gray-400">
                          {new Date(cert.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {certifications.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic text-sm">
                        No certifications recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Shift Quiz Analytics ──────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-text-navy dark:text-white uppercase tracking-widest">Shift Quiz Analytics</h3>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-[10px] font-bold text-gray-500">{quizSubmissions.length} submissions</span>
                {quizSubmissions.length > 0 && (
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    Math.round(quizSubmissions.reduce((a, q) => a + (q.score / q.totalQuestions) * 100, 0) / quizSubmissions.length) >= 80
                      ? 'bg-success/10 text-success'
                      : Math.round(quizSubmissions.reduce((a, q) => a + (q.score / q.totalQuestions) * 100, 0) / quizSubmissions.length) >= 60
                      ? 'bg-warning/10 text-warning'
                      : 'bg-error/10 text-error'
                  }`}>
                    Avg {Math.round(quizSubmissions.reduce((a, q) => a + (q.score / q.totalQuestions) * 100, 0) / quizSubmissions.length)}%
                  </span>
                )}
              </div>
            </div>

            {quizSubmissions.length === 0 ? (
              <div className="py-12 text-center text-gray-400 italic text-sm">No quiz submissions yet.</div>
            ) : (
              <>
                {/* Staff breakdown */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">By Staff Member</p>
                  <div className="space-y-3">
                    {(() => {
                      const byStaff: Record<string, { name: string; scores: number[]; total: number[] }> = {};
                      quizSubmissions.forEach((q: any) => {
                        const key = q.staffId || 'unknown';
                        if (!byStaff[key]) byStaff[key] = { name: resolveStaffName(q), scores: [], total: [] };
                        byStaff[key].scores.push(q.score);
                        byStaff[key].total.push(q.totalQuestions);
                      });
                      return Object.entries(byStaff)
                        .map(([id, s]) => {
                          const avg = Math.round(s.scores.reduce((a, b, i) => a + (b / s.total[i]) * 100, 0) / s.scores.length);
                          return { id, name: s.name, avg, count: s.scores.length };
                        })
                        .sort((a, b) => b.avg - a.avg)
                        .map((s, i) => (
                          <div key={s.id} className="flex items-center gap-4">
                            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-[10px] shrink-0">
                              {s.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs font-bold text-text-navy dark:text-white">{s.name}</span>
                                <span className={`text-[10px] font-black ${s.avg >= 80 ? 'text-success' : s.avg >= 60 ? 'text-warning' : 'text-error'}`}>
                                  {s.avg}% · {s.count} quiz{s.count !== 1 ? 'zes' : ''}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${s.avg >= 80 ? 'bg-success' : s.avg >= 60 ? 'bg-warning' : 'bg-error'}`}
                                  style={{ width: `${s.avg}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>

                {/* Recent submissions table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                        <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Staff Member</th>
                        <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                        <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Result</th>
                        <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                      {quizSubmissions.slice(0, 15).map((q: any, i: number) => {
                        const pct = Math.round((q.score / q.totalQuestions) * 100);
                        return (
                          <tr key={q.id || i} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-[10px]">
                                  {resolveStaffName(q).substring(0, 2).toUpperCase()}
                                </div>
                                <p className="text-xs font-bold text-text-navy dark:text-white">{resolveStaffName(q)}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-black text-text-navy dark:text-white">{q.score}/{q.totalQuestions}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                pct >= 80 ? 'bg-success/10 text-success' : pct >= 60 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'
                              }`}>
                                {pct >= 80 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                {pct}% · {pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : 'Needs work'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="text-xs text-gray-500 font-medium">{new Date(q.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                              <p className="text-[9px] text-gray-400">{new Date(q.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-accent transition-colors" />
              <input
                type="text"
                placeholder="Search training guides..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all dark:text-white"
              />
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto no-scrollbar">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilterCategory(category)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] rounded-lg border-2 transition-all whitespace-nowrap ${
                    filterCategory === category
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 hover:border-gray-200 dark:hover:border-slate-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6">
            {filteredItems.map((item, idx) => (
          <motion.div 
            key={`${item.id || 'new'}-${idx}`} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => setSelectedItem(item as any)}
            className="group bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer ring-1 ring-black/5 dark:ring-white/5"
          >
            <div className="aspect-[4/5] w-full relative overflow-hidden">
              <img 
                src={(item as any).imageUrl || `https://picsum.photos/seed/${encodeURIComponent(item.name)}/600/450`} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
              
              <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black text-accent dark:text-accent/80 shadow uppercase tracking-widest border border-white/20">
                  {(item as any).category || 'Item'}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="text-xs sm:text-sm font-black text-white line-clamp-2 uppercase tracking-tight leading-tight mb-1">{item.name}</h3>
                {(item as any).type === 'menu_item' && (
                   <div className="flex flex-wrap gap-1 mt-1">
                    {(item as any).allergies && (item as any).allergies.slice(0, 2).map((allergy: string, aIdx: number) => (
                      <span key={`${item.id || 'new'}-${allergy}-${aIdx}`} className="inline-flex items-center px-1 py-0.5 rounded bg-white/20 backdrop-blur-sm text-white text-[7px] font-bold uppercase tracking-widest">
                        {allergy}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-3 bg-gray-50/50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">
                  {activeTab === 'spirits' ? 'Product' : 'Training'}
                </span>
                <ChevronRight className="h-3 w-3 text-accent group-hover:translate-x-1 transition-transform" />
              </div>

              {(item as any).type === 'menu_item' && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const recipe = item as Recipe;
                    // For now checking if results exist (simulation of user results)
                    const results = recipe.quizResults?.['current-user']; // In a real app we'd have the real user ID
                    if (results?.passed) return <span className="flex items-center gap-1 text-[7px] font-black uppercase text-success bg-success/10 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="h-2 w-2" /> Passed</span>;
                    if (results) return <span className="flex items-center gap-1 text-[7px] font-black uppercase text-cta bg-cta/10 px-1.5 py-0.5 rounded-full"><AlertCircle className="h-2 w-2" /> Failed</span>;
                    return <span className="flex items-center gap-1 text-[7px] font-black uppercase text-warning bg-warning/10 px-1.5 py-0.5 rounded-full"><HelpCircle className="h-2 w-2" /> Pending</span>;
                  })()}
                </div>
              )}
              
              {(item as any).type === 'menu_item' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startQuiz(item as Recipe);
                  }}
                  className="w-full py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-[8px] font-black uppercase tracking-widest rounded-lg transition-colors border border-accent/20 flex items-center justify-center gap-1"
                >
                  <HelpCircle className="h-3 w-3" />
                  Test Knowledge
                </button>
              )}
            </div>
          </motion.div>
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
      </>
      )}

      {/* Training Guide Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-2xl max-w-6xl w-full h-full sm:h-auto sm:max-h-[95vh] flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 sm:px-8 sm:py-6 border-b border-gray-100 dark:border-slate-800 gap-4 bg-white dark:bg-slate-900 sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="bg-primary-surface dark:bg-dark-navy/30 p-3 rounded-2xl relative">
                    <BookOpen className="h-6 w-6 text-accent dark:text-accent/80" />
                    {(() => {
                      const results = (selectedItem as any).quizResults?.['current-user'];
                      if (results?.passed) return <div className="absolute -top-1 -right-1 h-3 w-3 bg-success rounded-full border-2 border-white dark:border-slate-800" />;
                      if (results) return <div className="absolute -top-1 -right-1 h-3 w-3 bg-cta rounded-full border-2 border-white dark:border-slate-800" />;
                      return <div className="absolute -top-1 -right-1 h-3 w-3 bg-warning rounded-full border-2 border-white dark:border-slate-800" />;
                    })()}
                </div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedItem.name}</h2>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{activeTab === 'spirits' ? 'Product Specification' : 'Training Guide'}</p>
                        {(() => {
                          const results = (selectedItem as any).quizResults?.['current-user'];
                          if (results?.passed) return <span className="text-[9px] font-black text-success uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Certified</span>;
                          if (results) return <span className="text-[9px] font-black text-cta uppercase tracking-widest flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" /> Failed</span>;
                          return <span className="text-[9px] font-black text-warning uppercase tracking-widest flex items-center gap-1"><HelpCircle className="h-2.5 w-2.5" /> Training In Progress</span>;
                        })()}
                    </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 w-full sm:w-auto justify-end">
                {activeTab !== 'spirits' && (
                  <button 
                    onClick={() => downloadPDF(selectedItem as Recipe)}
                    className="flex items-center gap-2 px-4 py-3 bg-accent hover:opacity-90 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-accent/20"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download PDF</span>
                  </button>
                )}
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
                                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
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
                          <span className="text-sm font-black text-accent dark:text-accent/80">£{(selectedItem as InventoryItem).pricePerUnit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Allergens</h4>
                      {(selectedItem as any).allergies && (selectedItem as any).allergies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(selectedItem as any).allergies.map((allergy: string, aIdx: number) => (
                            <span key={`${selectedItem.id || 'new'}-${allergy}-${aIdx}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30">
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
                          { label: 'Main', key: 'mainPairing', color: 'text-accent dark:text-accent/80', bg: 'bg-primary-surface dark:bg-dark-navy/20', border: 'border-primary-surface dark:border-dark-navy/30' },
                          { label: 'Dessert', key: 'dessertPairing', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-900/30' }
                        ] : [
                          { label: 'Wine', key: 'winePairing', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-100 dark:border-rose-900/30' },
                          { label: 'Tequila', key: 'tequilaPairing', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-900/30' },
                          { label: 'Mezcal', key: 'mezcalPairing', color: 'text-slate-900 dark:text-white', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
                          { label: 'Cocktail', key: 'cocktailPairing', color: 'text-accent dark:text-accent/80', bg: 'bg-primary-surface dark:bg-dark-navy/20', border: 'border-primary-surface dark:border-dark-navy/30' }
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
                            <div className="w-12 h-12 bg-accent dark:bg-accent/80 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-accent/30">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">Step {index + 1}</span>
                              {step.title && <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{step.title}</h4>}
                            </div>
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
                    <div className="bg-primary-surface dark:bg-dark-navy/20 p-8 sm:p-12 rounded-3xl border border-primary-surface dark:border-dark-navy/30 shadow-inner">
                      <div className="flex flex-col sm:flex-row items-start gap-8">
                        <div className="bg-accent dark:bg-accent/80 p-4 rounded-2xl shadow-xl shadow-accent/20">
                          <Info className="h-8 w-8 text-white" />
                        </div>
                        <div className="space-y-8 flex-1">
                          <div>
                            <h4 className="text-2xl font-black text-dark-navy dark:text-accent/80 mb-4 uppercase tracking-tight">Upselling Tips: {selectedItem.name}</h4>
                            <p className="text-lg text-dark-navy/80 dark:text-accent/80 leading-relaxed font-medium">
                                {(selectedItem as InventoryItem).description ? (selectedItem as InventoryItem).description : (
                                <>
                                    Knowledge of our <strong>{(selectedItem as InventoryItem).subCategory || (selectedItem as InventoryItem).category}</strong> is key to providing a premium experience. 
                                    When a customer orders a standard drink, always offer a premium upgrade to <strong>{selectedItem.name}</strong>.
                                    This specific bottle is known for its exceptional quality and distinct flavor profile that elevates any cocktail.
                                </>
                                )}
                            </p>
                                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-primary-surface dark:border-dark-navy/30">
                              <h5 className="text-[10px] font-black text-accent dark:text-accent/80 uppercase tracking-widest mb-3">When to Recommend</h5>
                              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                                {selectedItem.name.toLowerCase().includes('tequila') ? 'Perfect for premium Margaritas or sipping neat with a slice of orange.' : 
                                 selectedItem.name.toLowerCase().includes('gin') ? 'Ideal for a crisp G&T with premium tonic and fresh botanicals.' :
                                 selectedItem.name.toLowerCase().includes('vodka') ? 'Best for clean, smooth Martinis or refreshing long drinks.' :
                                 selectedItem.name.toLowerCase().includes('whiskey') || selectedItem.name.toLowerCase().includes('bourbon') ? 'Excellent for Old Fashioneds or enjoying on the rocks.' :
                                 'Customers looking for a higher quality alternative to our house spirits.'}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-primary-surface dark:border-dark-navy/30">
                              <h5 className="text-[10px] font-black text-accent dark:text-accent/80 uppercase tracking-widest mb-3">Key Selling Point</h5>
                              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                                {selectedItem.name.toLowerCase().includes('tequila') ? '100% Agave with a smooth, earthy finish.' : 
                                 selectedItem.name.toLowerCase().includes('gin') ? 'Complex botanical blend with a refreshing juniper-forward taste.' :
                                 selectedItem.name.toLowerCase().includes('vodka') ? 'Multiple distillations for ultimate purity and smoothness.' :
                                 selectedItem.name.toLowerCase().includes('whiskey') || selectedItem.name.toLowerCase().includes('bourbon') ? 'Aged to perfection with rich notes of oak and caramel.' :
                                 'Premium quality that significantly improves the overall drink experience.'}
                              </p>
                            </div>
                          </div>  </div>
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

              {/* In-Card Knowledge Test Section */}
              {selectedItem && (selectedItem as Recipe).type === 'menu_item' && (
                <div className="mt-12 pt-12 border-t border-gray-100 dark:border-slate-800">
                  <div className="bg-gray-50/50 dark:bg-slate-800/50 rounded-3xl p-8 sm:p-12 border border-gray-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 text-center sm:text-left">
                      <div className="flex items-center gap-4">
                        <div className="bg-accent/10 p-4 rounded-2xl">
                          <HelpCircle className="h-8 w-8 text-accent" />
                        </div>
                        <div>
                          <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Level Up Your Knowledge</h3>
                          <p className="text-sm text-text-muted mt-1 uppercase tracking-widest font-bold">Complete the training test to earn your certification</p>
                        </div>
                      </div>
                      
                      {(() => {
                        const results = (selectedItem as Recipe).quizResults?.['current-user'];
                        return results ? (
                          <div className={`px-6 py-3 rounded-2xl border-2 flex items-center gap-3 ${results.passed ? 'border-success bg-success/5 text-success' : 'border-cta bg-cta/5 text-cta'}`}>
                            {results.passed ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest">Last Result</p>
                              <p className="text-lg font-black">{results.score} / {results.total} ({results.passed ? 'PASSED' : 'RETRY'})</p>
                            </div>
                          </div>
                        ) : (
                          <div className="px-6 py-3 rounded-2xl border-2 border-warning bg-warning/5 text-warning flex items-center gap-3">
                            <Trophy className="h-6 w-6" />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest">Status</p>
                              <p className="text-lg font-black uppercase">PENDING</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => startQuiz(selectedItem as Recipe)}
                      className="w-full py-6 bg-accent text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <BookOpen className="h-5 w-5" />
                      Start Verification Test
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Knowledge Test Modal */}
      {quizItem && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="bg-accent/10 p-2 rounded-xl">
                  <HelpCircle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight line-clamp-1">{quizItem.name}</h3>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Knowledge Test</p>
                </div>
              </div>
              <button 
                onClick={() => { setQuizItem(null); setQuizState(null); }}
                className="text-text-muted hover:text-cta transition-colors p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] no-scrollbar">
              {quizState?.showResults ? (
                <div className="text-center py-8 space-y-6">
                  <div className="relative inline-block">
                    <div className="bg-accent/10 p-8 rounded-full">
                      <Trophy className="h-16 w-16 text-accent" />
                    </div>
                    <div className="absolute -top-2 -right-2 bg-success text-white px-3 py-1 rounded-full text-xs font-black shadow-lg">
                      {Math.round((quizState.score / generateQuestions(quizItem).length) * 100)}%
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Test Complete!</h4>
                    <p className="text-text-muted mt-2">You scored {quizState.score} out of {generateQuestions(quizItem).length}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => startQuiz(quizItem)}
                      className="px-6 py-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-text-navy dark:text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => { setQuizItem(null); setQuizState(null); }}
                      className="px-6 py-4 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-accent/20"
                    >
                      Finish
                    </button>
                  </div>
                </div>
              ) : quizState ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center text-[10px] font-black text-text-muted uppercase tracking-widest">
                    <span>Question {quizState.currentQuestion + 1} of {generateQuestions(quizItem).length}</span>
                    <div className="w-32 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-300" 
                        style={{ width: `${((quizState.currentQuestion + 1) / generateQuestions(quizItem).length) * 100}%` }} 
                      />
                    </div>
                  </div>

                  {(() => {
                    const questions = generateQuestions(quizItem);
                    const q = questions[quizState.currentQuestion];
                    return (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{q.text}</h4>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {q.options.map((opt, i) => {
                            const isSelected = q.type === 'multiple' 
                              ? (quizState.answers[quizState.currentQuestion] as string[]).includes(opt)
                              : quizState.answers[quizState.currentQuestion] === opt;
                            
                            return (
                              <button
                                key={i}
                                onClick={() => handleAnswer(opt)}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all group ${
                                  isSelected 
                                    ? 'border-accent bg-accent/5 ring-1 ring-accent' 
                                    : 'border-gray-100 dark:border-slate-800 hover:border-accent/30 hover:bg-gray-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span className={`text-sm font-bold ${isSelected ? 'text-accent' : 'text-gray-700 dark:text-slate-300'}`}>
                                  {opt}
                                </span>
                                {isSelected ? (
                                  <CheckCircle2 className="h-5 w-5 text-accent animate-in zoom-in" />
                                ) : (
                                  <div className="h-5 w-5 rounded-full border-2 border-gray-100 dark:border-slate-800 group-hover:border-accent/30 transition-colors" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
                    <button
                      onClick={nextQuestion}
                      className="w-full py-4 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 group"
                    >
                      {quizState.currentQuestion === generateQuestions(quizItem).length - 1 ? 'Finish Test' : 'Next Question'}
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
