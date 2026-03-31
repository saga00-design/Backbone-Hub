
import React, { useState, useEffect, useRef } from 'react';
import { ModifierManagement } from './ModifierManagement';
import { InventoryItem, Recipe, RecipeIngredient, ALLERGIES_LIST, RecipeType, MenuCategory, Unit } from '../types';
import { Button } from './Button';
import { Plus, Trash2, Calculator, ChefHat, PoundSterling, Edit2, AlertCircle, Image as ImageIcon, Sparkles, Loader2, Upload, Camera, Check, Wheat, Shell, Egg, Fish, Flower2, Milk, Snail, Droplet, Bean, CircleDot, Sprout, FlaskConical, Nut, Leaf, Download, Minus, Search, X, BookOpen, Info, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI, Type } from "@google/genai";
import { handleAiError } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { convertQuantity, getIngredientDetails as getIngredientDetailsShared, calculateTotalCost as calculateTotalCostShared } from '../utils/recipeUtils';

interface MenuRecipesProps {
  inventoryItems: InventoryItem[];
  recipes: Recipe[];
  onSaveRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (id: string) => void;
  onUpdateInventory?: (updates: { id: string; quantity: number }[]) => void;
  onAddInventoryItem?: (item: any) => void;
  initialEditRecipeId?: string | null;
  onClearInitialEditRecipeId?: () => void;
}

const allergyIcons: Record<string, React.ReactNode> = {
  'Celery': <Leaf className="h-5 w-5 text-success" />,
  'Gluten': <Wheat className="h-5 w-5 text-warning" />,
  'Crustaceans': <Shell className="h-5 w-5 text-cta" />,
  'Eggs': <Egg className="h-5 w-5 text-warning" />,
  'Fish': <Fish className="h-5 w-5 text-accent" />,
  'Lupin': <Flower2 className="h-5 w-5 text-accent" />,
  'Milk': <Milk className="h-5 w-5 text-accent" />,
  'Molluscs': <Snail className="h-5 w-5 text-text-muted" />,
  'Mustard': <Droplet className="h-5 w-5 text-warning" />,
  'Peanuts': <Bean className="h-5 w-5 text-warning" />,
  'Sesame': <CircleDot className="h-5 w-5 text-text-muted" />,
  'Soybeans': <Sprout className="h-5 w-5 text-success" />,
  'Sulphites': <FlaskConical className="h-5 w-5 text-accent" />,
  'Tree nuts': <Nut className="h-5 w-5 text-warning" />
};

export const MenuRecipes: React.FC<MenuRecipesProps> = ({ 
  inventoryItems, 
  recipes, 
  onSaveRecipe, 
  onDeleteRecipe, 
  onUpdateInventory, 
  onAddInventoryItem,
  initialEditRecipeId,
  onClearInitialEditRecipeId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe>>({
    name: '',
    description: '',
    type: 'recipe',
    category: 'Food',
    subCategory: '',
    imageUrl: '',
    sellingPrice: 0,
    vatCode: 'STANDARD_20',
    vatRate: 20,
    serviceChargeRate: 12.5,
    allergies: [],
    autoDetectAllergies: true,
    ingredients: [],
    trainingSteps: []
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [mainTab, setMainTab] = useState<'kitchen_menu' | 'bar_menu' | 'batches' | 'allergy_matrix' | 'recipe_ai' | 'modifiers'>('kitchen_menu');
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'ingredients' | 'allergies' | 'training' | 'sustainability'>('basic');

  const [ingredientSearchTerm, setIngredientSearchTerm] = useState('');
  const [isDetectingAllergies, setIsDetectingAllergies] = useState(false);
  const [isEnhancingImage, setIsEnhancingImage] = useState(false);
  const [dismissedAllergies, setDismissedAllergies] = useState<Set<string>>(new Set());
  const [imageStyle, setImageStyle] = useState<string>('studio lighting');
  const [recipeIdeaPrompt, setRecipeIdeaPrompt] = useState('');
  const [recipeIdeaResult, setRecipeIdeaResult] = useState('');
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [isGeneratingTraining, setIsGeneratingTraining] = useState(false);
  const [isCalculatingCalories, setIsCalculatingCalories] = useState(false);
  const [scaleMultiplier, setScaleMultiplier] = useState<number | ''>(1);
  const [isAnalyzingCost, setIsAnalyzingCost] = useState(false);
  const [costAnalysisResult, setCostAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingSustainability, setIsAnalyzingSustainability] = useState(false);
  const [sustainabilityResult, setSustainabilityResult] = useState<string | null>(null);
  const [producingBatch, setProducingBatch] = useState<Recipe | null>(null);
  const [produceQuantity, setProduceQuantity] = useState<number>(1);
  const [ingredientAllergies, setIngredientAllergies] = useState<Record<string, string[]>>({});
  const [hasDetectedIngredients, setHasDetectedIngredients] = useState(false);
  const [isDetectingMatrix, setIsDetectingMatrix] = useState(false);
  const [triggerModifierCreate, setTriggerModifierCreate] = useState(0);
  const prevIngredientsRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialEditRecipeId) {
      const recipeToEdit = recipes.find(r => r.id === initialEditRecipeId);
      if (recipeToEdit) {
        setEditingRecipe(recipeToEdit);
        setIsModalOpen(true);
        if (recipeToEdit.type === 'recipe') {
          setMainTab('batches');
        } else if (recipeToEdit.category === 'Beverage') {
          setMainTab('bar_menu');
        } else {
          setMainTab('kitchen_menu');
        }
        if (onClearInitialEditRecipeId) {
          onClearInitialEditRecipeId();
        }
      }
    }
  }, [initialEditRecipeId, recipes, onClearInitialEditRecipeId]);

  useEffect(() => {
    if (!isModalOpen) {
      setIsDetectingAllergies(false);
      prevIngredientsRef.current = '';
      return;
    }
    if (!editingRecipe.ingredients) return;

    const currentIngredientsStr = JSON.stringify(
      editingRecipe.ingredients.map(i => i.inventoryItemId).filter(Boolean)
    );

    if (currentIngredientsStr === prevIngredientsRef.current) return;
    prevIngredientsRef.current = currentIngredientsStr;

    const ingredientNames = editingRecipe.ingredients.map(ing => {
      const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
      return item ? item.name : '';
    }).filter(Boolean);

    if (ingredientNames.length === 0) {
      setIsDetectingAllergies(false);
      return;
    }

    setIsDetectingAllergies(true);

    const detect = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Given these ingredients: ${ingredientNames.join(', ')}. Which of the following allergies might be present? ${ALLERGIES_LIST.join(', ')}. Return a JSON object where the keys are the allergy names and the values are arrays of ingredient names that contain that allergy. Only include allergies that are present.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: ALLERGIES_LIST.reduce((acc, allergy) => {
                acc[allergy] = {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                };
                return acc;
              }, {} as Record<string, any>)
            }
          }
        });
        const text = response.text || '{}';
        const detectedMap = JSON.parse(text);
        
        setEditingRecipe(prev => {
          const currentAllergies = prev.allergies || [];
          const newAllergies = [...currentAllergies];
          const newAllergyIngredients = { ...(prev.allergyIngredients || {}) };
          
          // Also include allergies from inventory items
          const inventoryDetectedMap = autoDetectAllergiesMap(prev.ingredients || []);
          
          // Merge maps
          const allDetectedMap: Record<string, string[]> = { ...detectedMap };
          Object.keys(inventoryDetectedMap).forEach(a => {
            if (!allDetectedMap[a]) allDetectedMap[a] = [];
            inventoryDetectedMap[a].forEach(ing => {
              if (!allDetectedMap[a].includes(ing)) allDetectedMap[a].push(ing);
            });
          });

          const allDetected = Object.keys(allDetectedMap);

          allDetected.forEach((a: string) => {
            if (!currentAllergies.includes(a) && !dismissedAllergies.has(a)) {
              newAllergies.push(a);
            }
            if (!newAllergyIngredients[a]) newAllergyIngredients[a] = [];
            allDetectedMap[a].forEach(ing => {
              if (!newAllergyIngredients[a].includes(ing)) newAllergyIngredients[a].push(ing);
            });
          });
          return { ...prev, allergies: newAllergies, allergyIngredients: newAllergyIngredients };
        });
      } catch (error: any) {
        const message = handleAiError(error);
        toast.error(message);
      } finally {
        setIsDetectingAllergies(false);
      }
    };

    const timer = setTimeout(detect, 1500);
    return () => clearTimeout(timer);
  }, [editingRecipe.ingredients, isModalOpen, inventoryItems, dismissedAllergies]);

  useEffect(() => {
    if (mainTab !== 'allergy_matrix' || hasDetectedIngredients) return;

    const detectAllIngredients = async () => {
      setIsDetectingMatrix(true);
      try {
        const allIngredientNames = Array.from(new Set(inventoryItems.map(i => i.name)));
        if (allIngredientNames.length === 0) {
          setHasDetectedIngredients(true);
          return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Given these ingredients: ${allIngredientNames.join(', ')}. Which of the following allergies might be present in each ingredient? ${ALLERGIES_LIST.join(', ')}. Return a JSON object where the keys are the ingredient names and the values are arrays of allergy names present in that ingredient. If an ingredient has no allergies, it can be omitted or have an empty array.`,
          config: {
            responseMimeType: "application/json"
          }
        });

        const text = response.text || '{}';
        const detected = JSON.parse(text);
        
        setIngredientAllergies(detected);
        setHasDetectedIngredients(true);
      } catch (error: any) {
        const message = handleAiError(error);
        toast.error(message);
      } finally {
        setIsDetectingMatrix(false);
      }
    };

    detectAllIngredients();
  }, [mainTab, inventoryItems, hasDetectedIngredients]);

  // Helper to get ingredient details
  const getIngredientDetails = (ing: RecipeIngredient) => {
    return getIngredientDetailsShared(ing, inventoryItems);
  };

  // Calculate total cost of a recipe
  const calculateTotalCost = (recipeIngredients: RecipeIngredient[] | undefined) => {
    return calculateTotalCostShared(recipeIngredients, inventoryItems);
  };

  const autoDetectAllergiesMap = (ingredients: RecipeIngredient[]) => {
    const detected: Record<string, string[]> = {};
    ingredients.forEach(ing => {
      const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
      if (item && item.allergies) {
        item.allergies.forEach(a => {
          if (!detected[a]) detected[a] = [];
          if (!detected[a].includes(item.name)) detected[a].push(item.name);
        });
      }
    });
    return detected;
  };

  const handleOpenModal = (recipe?: Recipe) => {
    if (recipe) {
      setEditingRecipe({ ...recipe });
    } else {
      setEditingRecipe({
        name: '',
        description: '',
        type: mainTab === 'batches' ? 'recipe' : 'menu_item',
        category: mainTab === 'bar_menu' ? 'Beverage' : 'Food',
        subCategory: '',
        imageUrl: '',
        sellingPrice: 0,
        vatCode: 'STANDARD_20',
        vatRate: 20,
        serviceChargeRate: 12.5,
        allergies: [],
        autoDetectAllergies: true,
        ingredients: [],
        yieldAmount: mainTab === 'batches' ? 1 : undefined,
        yieldUnit: mainTab === 'batches' ? 'portions' : undefined,
        calories: undefined,
        station: mainTab === 'bar_menu' ? 'Bar' : 'Grill',
        course: '1st Course',
        trackAvailability: false,
        availabilityCount: 0,
        winePairing: { name: '', nose: '', palate: '', finish: '', aromas: '' },
        tequilaPairing: { name: '', nose: '', palate: '', finish: '', aromas: '' },
        mezcalPairing: { name: '', nose: '', palate: '', finish: '', aromas: '' },
        cocktailPairing: { name: '', nose: '', palate: '', finish: '', aromas: '' },
        trainingSteps: []
      });
    }
    setActiveTab('basic');
    setIsModalOpen(true);
  };

  const handleAddIngredientRow = () => {
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: [
        ...(prev.ingredients || []),
        { inventoryItemId: '', quantity: 0 }
      ]
    }));
  };

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: any) => {
    const newIngredients = [...(editingRecipe.ingredients || [])];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setEditingRecipe(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const handleRemoveIngredientRow = (index: number) => {
    const newIngredients = [...(editingRecipe.ingredients || [])];
    newIngredients.splice(index, 1);
    setEditingRecipe(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const handleCalculateCalories = async () => {
    if (!editingRecipe.ingredients || editingRecipe.ingredients.length === 0) return;
    setIsCalculatingCalories(true);
    try {
      const ingredientDetails = editingRecipe.ingredients.map(ing => {
        const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
        return item ? `${ing.quantity} ${ing.unit || item.unit} of ${item.name}` : '';
      }).filter(Boolean);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Estimate the total calories for a recipe with these ingredients: ${ingredientDetails.join(', ')}. Return ONLY a JSON object with a single key "calories" containing the estimated integer value. Example: {"calories": 450}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.INTEGER }
            }
          }
        }
      });
      
      const text = response.text || '{}';
      const data = JSON.parse(text);
      if (data.calories) {
        setEditingRecipe(prev => ({ ...prev, calories: data.calories }));
      }
    } catch (error) {
      const message = handleAiError(error);
      toast.error(message);
    } finally {
      setIsCalculatingCalories(false);
      setTimeout(() => setIsCalculatingCalories(false), 1000); // Show success state briefly
    }
  };

  const handleSave = () => {
    if (!editingRecipe.name || editingRecipe.sellingPrice === undefined) return;

      const recipeToSave: Recipe = {
      id: editingRecipe.id || Date.now().toString(),
      name: editingRecipe.name,
      description: editingRecipe.description,
      type: editingRecipe.type || 'recipe',
      category: editingRecipe.category || 'Food',
      subCategory: editingRecipe.subCategory,
      imageUrl: editingRecipe.imageUrl,
      sellingPrice: Number(editingRecipe.sellingPrice) || 0,
      vatRate: Number(editingRecipe.vatRate) || 0,
      vatCode: editingRecipe.vatCode,
      serviceChargeRate: Number(editingRecipe.serviceChargeRate) || 0,
      yieldAmount: editingRecipe.yieldAmount ? Number(editingRecipe.yieldAmount) : undefined,
      yieldUnit: editingRecipe.yieldUnit,
      calories: editingRecipe.calories ? Number(editingRecipe.calories) : undefined,
      station: editingRecipe.station,
      course: editingRecipe.course,
      trackAvailability: editingRecipe.trackAvailability,
      availabilityCount: editingRecipe.availabilityCount ? Number(editingRecipe.availabilityCount) : undefined,
      allergies: editingRecipe.allergies || [],
      autoDetectAllergies: false,
      ingredients: (editingRecipe.ingredients || []).filter(i => i.inventoryItemId && i.quantity > 0),
      winePairing: editingRecipe.winePairing || { name: '', nose: '', palate: '', finish: '', aromas: '' },
      tequilaPairing: editingRecipe.tequilaPairing || { name: '', nose: '', palate: '', finish: '', aromas: '' },
      mezcalPairing: editingRecipe.mezcalPairing || { name: '', nose: '', palate: '', finish: '', aromas: '' },
      cocktailPairing: editingRecipe.cocktailPairing || { name: '', nose: '', palate: '', finish: '', aromas: '' },
      trainingSteps: editingRecipe.trainingSteps || [],
      sustainabilityScore: editingRecipe.sustainabilityScore,
      carbonFootprint: editingRecipe.carbonFootprint,
      sustainabilityTips: editingRecipe.sustainabilityTips,
      lastUpdated: new Date().toISOString()
    };

    onSaveRecipe(recipeToSave);
    setIsModalOpen(false);
  };

  const handleScaleRecipe = () => {
    if (!scaleMultiplier || scaleMultiplier <= 0) return;
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients?.map(ing => ({
        ...ing,
        quantity: ing.quantity * Number(scaleMultiplier)
      })),
      yieldAmount: prev.yieldAmount ? prev.yieldAmount * Number(scaleMultiplier) : undefined,
      calories: prev.calories ? Math.round(prev.calories * Number(scaleMultiplier)) : undefined
    }));
    setScaleMultiplier(1);
  };

  const handleAnalyzeCost = async () => {
    if (!editingRecipe || !editingRecipe.ingredients || editingRecipe.ingredients.length === 0) return;
    setIsAnalyzingCost(true);
    setCostAnalysisResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const totalCost = calculateTotalCost(editingRecipe.ingredients);
      const recipeData = editingRecipe.ingredients.map(ing => {
        const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
        return {
          name: item?.name || 'Unknown',
          quantity: ing.quantity,
          unit: ing.unit,
          cost: item ? item.pricePerUnit * ing.quantity : 0,
          category: item?.category
        };
      });

      // Find potential cheaper alternatives in the same category
      const alternatives = recipeData.map(ing => {
        const sameCategoryItems = inventoryItems.filter(i => 
          i.category === ing.category && 
          i.name !== ing.name && 
          i.pricePerUnit < (inventoryItems.find(item => item.name === ing.name)?.pricePerUnit || 0)
        ).sort((a, b) => a.pricePerUnit - b.pricePerUnit).slice(0, 2);
        
        return {
          ingredient: ing.name,
          alternatives: sameCategoryItems.map(a => ({ name: a.name, price: a.pricePerUnit, unit: a.unit }))
        };
      }).filter(a => a.alternatives.length > 0);

      const prompt = `
        Hi there! I'm looking for some friendly, expert advice on the cost efficiency of this recipe: "${editingRecipe.name}". 
        
        Here's the breakdown of what's in it: ${JSON.stringify(recipeData)}. 
        The total cost to make it is £${totalCost.toFixed(2)}, and we're planning to sell it for £${editingRecipe.sellingPrice}.
        
        I've also identified some potentially cheaper ingredients in our inventory that might work as alternatives:
        ${JSON.stringify(alternatives)}
        
        Could you take a look and give me some down-to-earth suggestions? 
        Imagine you're a seasoned kitchen manager chatting with a colleague. 
        What are some practical ways we could trim the costs without losing that great quality our customers love? 
        Maybe there are some clever ingredient swaps or prep tweaks? 
        
        Keep it conversational, helpful, and actionable. No corporate speak, just real kitchen wisdom.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setCostAnalysisResult(response.text || "No analysis generated.");
    } catch (error) {
      const message = handleAiError(error);
      setCostAnalysisResult(message);
    } finally {
      setIsAnalyzingCost(false);
    }
  };

  const handleAnalyzeSustainability = async () => {
    if (!editingRecipe || !editingRecipe.ingredients || editingRecipe.ingredients.length === 0) return;
    setIsAnalyzingSustainability(true);
    setSustainabilityResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const ingredientDetails = editingRecipe.ingredients.map(ing => {
        const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
        return item ? `${ing.quantity} ${ing.unit || item.unit} of ${item.name}` : '';
      }).filter(Boolean);

      const prompt = `
        Analyze the sustainability and carbon footprint of this recipe: "${editingRecipe.name}".
        Ingredients: ${ingredientDetails.join(', ')}.
        
        Please provide:
        1. A sustainability score from 1 to 100 (100 being most sustainable).
        2. A carbon footprint rating (Low, Medium, High).
        3. 3-4 specific tips to make this recipe more eco-friendly (e.g., seasonal swaps, reducing waste, choosing lower-impact proteins).
        
        Return the response in JSON format:
        {
          "score": number,
          "rating": "Low" | "Medium" | "High",
          "tips": ["tip 1", "tip 2", "tip 3"]
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              rating: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              tips: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["score", "rating", "tips"]
          }
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      setEditingRecipe(prev => ({
        ...prev,
        sustainabilityScore: data.score,
        carbonFootprint: data.rating,
        sustainabilityTips: data.tips
      }));
      setSustainabilityResult(data.tips.join('\n'));
    } catch (error) {
      const message = handleAiError(error);
      toast.error(message);
    } finally {
      setIsAnalyzingSustainability(false);
    }
  };

  const handleProduceBatch = () => {
    if (!producingBatch || !onUpdateInventory || !onAddInventoryItem) return;

    // 1. Calculate total ingredients needed
    const updates: { id: string; quantity: number }[] = [];
    let hasInsufficientStock = false;
    let missingItems: string[] = [];

    producingBatch.ingredients.forEach(ing => {
      const inventoryItem = inventoryItems.find(i => i.id === ing.inventoryItemId);
      if (inventoryItem) {
        const totalNeeded = ing.quantity * produceQuantity;
        if (inventoryItem.quantity < totalNeeded) {
          hasInsufficientStock = true;
          missingItems.push(`${inventoryItem.name} (Need ${totalNeeded}, have ${inventoryItem.quantity})`);
        } else {
          updates.push({ id: inventoryItem.id, quantity: inventoryItem.quantity - totalNeeded });
        }
      }
    });

    if (hasInsufficientStock) {
      toast.error(`Insufficient stock to produce ${produceQuantity} batches.\n\nMissing:\n${missingItems.join('\n')}`);
      return;
    }

    // 2. Deduct ingredients
    onUpdateInventory(updates);

    // 3. Add or update the batch in inventory
    const recipeInventoryId = `recipe-${producingBatch.id}`;
    const existingBatchItem = inventoryItems.find(i => i.id === recipeInventoryId);
    
    const yieldAmount = producingBatch.yieldAmount || 1;
    const totalYieldProduced = yieldAmount * produceQuantity;

    if (existingBatchItem) {
      onUpdateInventory([{ id: existingBatchItem.id, quantity: existingBatchItem.quantity + totalYieldProduced }]);
    } else {
      // If for some reason it's not in combinedItems, we still update it via id
      onUpdateInventory([{ id: recipeInventoryId, quantity: (producingBatch.quantity || 0) + totalYieldProduced }]);
    }

    setProducingBatch(null);
    setProduceQuantity(1);
    toast.success(`Successfully produced ${produceQuantity} batch(es) of ${producingBatch.name}.`);
  };

  const handleGenerateTraining = async () => {
    if (!editingRecipe.name) {
      toast.error("Please enter a recipe name first.");
      return;
    }
    setIsGeneratingTraining(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const ingredientsList = (editingRecipe.ingredients || []).map(ing => {
        const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
        return item ? `${ing.quantity} ${item.unit} ${item.name}` : '';
      }).filter(Boolean).join(', ');

      const availableBeverages = recipes.filter(r => r.category === 'Beverage').map(r => r.name).join(', ');
      const availableStarters = recipes.filter(r => r.category === 'Food' && (r.subCategory?.toLowerCase().includes('starter') || r.subCategory?.toLowerCase().includes('appetizer'))).map(r => r.name).join(', ');
      const availableMains = recipes.filter(r => r.category === 'Food' && r.subCategory?.toLowerCase().includes('main')).map(r => r.name).join(', ');
      const availableDesserts = recipes.filter(r => r.category === 'Food' && r.subCategory?.toLowerCase().includes('dessert')).map(r => r.name).join(', ');
      const allFood = recipes.filter(r => r.category === 'Food').map(r => r.name).join(', ');

      const isBeverage = editingRecipe.category === 'Beverage';

      const prompt = `
        You are an expert sommelier, mixologist, and restaurant trainer.
        I have a ${isBeverage ? 'beverage' : 'menu item'} named "${editingRecipe.name}".
        ${editingRecipe.description ? `Description: ${editingRecipe.description.substring(0, 500)}` : ''}
        ${ingredientsList ? `Ingredients: ${ingredientsList}` : ''}
        
        ${isBeverage 
          ? `Available Food items to choose from: ${allFood}
             Starters: ${availableStarters}
             Mains: ${availableMains}
             Desserts: ${availableDesserts}`
          : `Available Beverages (Wines, Tequilas, Mezcals, Cocktails) to choose from: ${availableBeverages}`
        }

        Please provide:
        1. A professional, appetizing description (2-3 sentences). This description should be detailed and enticing, providing staff with key talking points for upselling (e.g., mention premium ingredients, unique preparation methods, or flavor profiles).
        ${isBeverage 
          ? `2. A recommended Starter course pairing.
             3. A recommended Main course pairing.
             4. A recommended Dessert course pairing.`
          : `2. A recommended Wine pairing.
             3. A recommended Tequila pairing.
             4. A recommended Mezcal pairing.
             5. A recommended Cocktail pairing.`
        }
        
        CRITICAL RULES:
        - The description MUST be appetizing and highlight why a guest should order it.
        - If the item is a BEVERAGE, you MUST pair it with FOOD items (Starter, Main, Dessert) from the available list above.
        - If the item is FOOD, you MUST pair it with BEVERAGES (Wine, Tequila, Mezcal, Cocktail).
        - You MUST provide a pairing for ALL categories requested.
        - DO NOT leave any pairing blank. Even if a perfect match isn't obvious, suggest the best possible one.
        - DO NOT use "N/A", "None", or "Not applicable". Always provide a creative and professional pairing.
        - For EACH pairing, you MUST provide detailed tasting notes:
          - Nose: The aromatic profile.
          - Palate: The flavor and mouthfeel.
          - Finish: The lingering aftertaste.
          - Aromas: Key scent descriptors.
        - Estimated calories (as a number).

        Return JSON format:
        {
          "description": "...",
          ${isBeverage 
            ? `"starterPairing": { "name": "...", "nose": "...", "palate": "...", "finish": "...", "aromas": "..." },
               "mainPairing": { "name": "...", "nose": "...", "palate": "...", "finish": "...", "aromas": "..." },
               "dessertPairing": { "name": "...", "nose": "...", "palate": "...", "finish": "...", "aromas": "..." }`
            : `"winePairing": { "name": "...", "nose": "...", "palate": "...", "finish": "...", "aromas": "..." },
               "tequilaPairing": { "name": "...", "nose": "...", "palate": "...", "finish": "...", "aromas": "..." },
               "mezcalPairing": { "name": "...", "nose": "...", "palate": "...", "finish": "...", "aromas": "..." },
               "cocktailPairing": { "name": "...", "nose": "...", "palate": "...", "finish": "...", "aromas": "..." }`
          },
          "calories": number
        }
      `;

      const pairingSchema = {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the paired item" },
          nose: { type: Type.STRING, description: "Aromatic notes" },
          palate: { type: Type.STRING, description: "Flavor profile" },
          finish: { type: Type.STRING, description: "Aftertaste notes" },
          aromas: { type: Type.STRING, description: "Key aromas" }
        },
        required: ["name", "nose", "palate", "finish", "aromas"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              ...(isBeverage ? {
                starterPairing: pairingSchema,
                mainPairing: pairingSchema,
                dessertPairing: pairingSchema
              } : {
                winePairing: pairingSchema,
                tequilaPairing: pairingSchema,
                mezcalPairing: pairingSchema,
                cocktailPairing: pairingSchema
              }),
              calories: { type: Type.NUMBER }
            },
            required: ["description", "calories", ...(isBeverage ? ["starterPairing", "mainPairing", "dessertPairing"] : ["winePairing", "tequilaPairing", "mezcalPairing", "cocktailPairing"])]
          }
        }
      });

      const text = response.text || '{}';
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanText);
      
      setEditingRecipe(prev => ({
        ...prev,
        description: data.description || prev.description,
        winePairing: data.winePairing || prev.winePairing,
        tequilaPairing: data.tequilaPairing || prev.tequilaPairing,
        mezcalPairing: data.mezcalPairing || prev.mezcalPairing,
        cocktailPairing: data.cocktailPairing || prev.cocktailPairing,
        starterPairing: data.starterPairing || prev.starterPairing,
        mainPairing: data.mainPairing || prev.mainPairing,
        dessertPairing: data.dessertPairing || prev.dessertPairing,
        calories: data.calories !== undefined ? data.calories : prev.calories
      }));
    } catch (error) {
      const message = handleAiError(error);
      toast.error(message);
    } finally {
      setIsGeneratingTraining(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsEnhancingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        const mimeType = file.type;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: `Enhance this food image, make it look like a professional high-quality ${imageStyle} food photography shot, appetizing, perfectly lit, and dramatic.`,
              },
            ],
          },
        });

        let enhancedImageUrl = base64String; // fallback
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            enhancedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }

        setEditingRecipe(prev => ({ ...prev, imageUrl: enhancedImageUrl }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      const message = handleAiError(error);
      toast.error(message);
    } finally {
      setIsEnhancingImage(false);
      if (e.target) e.target.value = ''; // reset input
    }
  };

  const downloadPDF = async () => {
    const element = document.getElementById('allergy-matrix-table');
    if (!element) return;

    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width;
    const originalHeight = element.style.height;

    element.style.overflow = 'visible';
    element.style.width = 'max-content';
    element.style.height = 'max-content';

    try {
      const canvas = await html2canvas(element, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('allergy-matrix.pdf');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      element.style.overflow = originalOverflow;
      element.style.width = originalWidth;
      element.style.height = originalHeight;
    }
  };

  const downloadRecipeBook = async () => {
    const doc = new jsPDF();
    const logoUrl = "https://picsum.photos/seed/backbone/200/200";
    let logoData = "";
    try {
      logoData = await getBase64ImageFromUrl(logoUrl);
    } catch (e) {}

    // --- COVER PAGE ---
    doc.setFillColor(15, 15, 15); // Dark background
    doc.rect(0, 0, 210, 297, 'F');
    
    if (logoData.startsWith('data:image')) {
      doc.addImage(logoData, 'JPEG', 85, 40, 40, 40);
    }

    doc.setFontSize(48);
    doc.setTextColor(72, 101, 129); // brand-600
    doc.setFont("helvetica", "bold");
    doc.text("Backbone Hub", 105, 100, { align: 'center' });
    
    doc.setDrawColor(72, 101, 129);
    doc.setLineWidth(1.5);
    doc.line(50, 105, 160, 105);

    doc.setFontSize(32);
    doc.setTextColor(255, 255, 255);
    doc.text("MASTER RECIPE BOOK", 105, 130, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Kitchen Menu • Bar Menu • Prep & Batches", 105, 145, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Version 2.0 | Generated: ${new Date().toLocaleDateString()}`, 105, 260, { align: 'center' });
    doc.text("© 2026 Backbone Hub Systems", 105, 270, { align: 'center' });

    // --- TABLE OF CONTENTS ---
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');
    
    doc.setFontSize(24);
    doc.setTextColor(15, 15, 15);
    doc.setFont("helvetica", "bold");
    doc.text("TABLE OF CONTENTS", 14, 30);
    doc.line(14, 35, 196, 35);

    const allRecipes = [...recipes].sort((a, b) => 
      (a.category || '').localeCompare(b.category || '') || 
      (a.name || '').localeCompare(b.name || '')
    );

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    let tocY = 45;
    let currentPage = 3; // TOC is page 2, first recipe is page 3

    allRecipes.forEach((recipe, index) => {
      if (tocY > 270) {
        doc.addPage();
        tocY = 20;
      }
      doc.setTextColor(72, 101, 129);
      doc.text(`${index + 1}.`, 14, tocY);
      doc.setTextColor(15, 15, 15);
      doc.text(recipe.name, 22, tocY);
      doc.setTextColor(150, 150, 150);
      doc.text(recipe.category || 'General', 140, tocY);
      doc.text(`Page ${currentPage + index}`, 180, tocY);
      
      // Add a dotted line
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(22, tocY + 1, 196, tocY + 1);
      
      tocY += 8;
    });

    // --- RECIPE PAGES ---
    for (const recipe of allRecipes) {
      doc.addPage();
      let yPos = 25;

      // Page Header
      doc.setFillColor(245, 247, 250);
      doc.rect(0, 0, 210, 20, 'F');
      
      if (logoData.startsWith('data:image')) {
        doc.addImage(logoData, 'JPEG', 14, 4, 12, 12);
      }
      
      doc.setFontSize(10);
      doc.setTextColor(72, 101, 129);
      doc.setFont("helvetica", "bold");
      doc.text("BACKBONE HUB | RECIPE INTELLIGENCE", 30, 13);
      
      doc.setTextColor(150, 150, 150);
      doc.text(recipe.category?.toUpperCase() || 'GENERAL', 196, 13, { align: 'right' });

      // Recipe Title
      doc.setFontSize(28);
      doc.setTextColor(15, 15, 15);
      doc.setFont("helvetica", "bold");
      doc.text(recipe.name.toUpperCase(), 14, yPos + 15);
      
      doc.setDrawColor(72, 101, 129);
      doc.setLineWidth(1);
      doc.line(14, yPos + 18, 100, yPos + 18);
      
      yPos += 30;

      // Image if available
      if (recipe.imageUrl) {
        try {
          const imgData = await getBase64ImageFromUrl(recipe.imageUrl);
          if (imgData.startsWith('data:image')) {
            const props = doc.getImageProperties(imgData);
            const ratio = props.width / props.height;
            const targetWidth = 70;
            const targetHeight = targetWidth / ratio;
            
            // Draw a frame for the image
            doc.setDrawColor(230, 230, 230);
            doc.rect(125, 25, 72, targetHeight + 2);
            doc.addImage(imgData, 'JPEG', 126, 26, 70, targetHeight);
          }
        } catch (e) {}
      }

      // Quick Info Badges
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      
      // Station Badge
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(14, yPos, 40, 8, 2, 2, 'F');
      doc.setTextColor(72, 101, 129);
      doc.text(`STATION: ${recipe.station || 'N/A'}`, 18, yPos + 5.5);

      // Course Badge
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(60, yPos, 40, 8, 2, 2, 'F');
      doc.text(`COURSE: ${recipe.course || 'N/A'}`, 64, yPos + 5.5);

      yPos += 15;

      // Description
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "italic");
      const splitDesc = doc.splitTextToSize(recipe.description || 'No description available.', 100);
      doc.text(splitDesc, 14, yPos);
      yPos += (splitDesc.length * 5) + 10;

      // Pricing & Profit Section
      const cost = calculateTotalCost(recipe.ingredients);
      const priceExcVat = recipe.sellingPrice;
      const marginCash = priceExcVat - cost;
      const marginPercent = priceExcVat > 0 ? (marginCash / priceExcVat) * 100 : 0;

      doc.setFontSize(12);
      doc.setTextColor(15, 15, 15);
      doc.setFont("helvetica", "bold");
      doc.text("FINANCIAL OVERVIEW", 14, yPos);
      yPos += 5;
      doc.line(14, yPos, 110, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Cost of Goods (COGS):", 14, yPos);
      doc.text(`£${cost.toFixed(2)}`, 60, yPos);

      doc.text("Target Selling Price:", 14, yPos + 6);
      doc.text(`£${priceExcVat.toFixed(2)}`, 60, yPos + 6);

      doc.setFont("helvetica", "bold");
      doc.text("Gross Profit Margin:", 14, yPos + 12);
      if (marginPercent >= 70) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(220, 38, 38);
      doc.text(`${marginPercent.toFixed(1)}%`, 60, yPos + 12);
      doc.setTextColor(15, 15, 15);

      if (recipe.calories) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(72, 101, 129);
        doc.text(`CALORIES: ${recipe.calories} kcal`, 14, yPos + 18);
      }
      
      yPos += 25;

      // Allergens
      if (recipe.allergies && recipe.allergies.length > 0) {
        doc.setFillColor(254, 242, 242);
        doc.rect(14, yPos, 182, 12, 'F');
        doc.setDrawColor(252, 165, 165);
        doc.rect(14, yPos, 182, 12);
        
        doc.setFontSize(10);
        doc.setTextColor(185, 28, 28);
        doc.setFont("helvetica", "bold");
        doc.text(`ALLERGENS: ${recipe.allergies.join(', ')}`, 18, yPos + 7.5);
        yPos += 18;
      }

      // Ingredients Table
      doc.setFontSize(12);
      doc.setTextColor(15, 15, 15);
      doc.setFont("helvetica", "bold");
      doc.text("INGREDIENTS & SPECIFICATIONS", 14, yPos);
      yPos += 5;

      const ingredientRows = recipe.ingredients.map(ing => {
        const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
        return [item?.name || 'Unknown', `${ing.quantity} ${ing.unit || item?.unit || ''}`];
      });

      (doc as any).autoTable({
        startY: yPos,
        head: [['Ingredient Name', 'Measurement']],
        body: ingredientRows,
        theme: 'grid',
        headStyles: { fillGray: 240, textColor: 15, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14 },
        tableWidth: 100
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Training Steps
      if (recipe.trainingSteps && recipe.trainingSteps.length > 0) {
        if (yPos > 240) { doc.addPage(); yPos = 25; }
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("PREPARATION & TRAINING GUIDE", 14, yPos);
        yPos += 5;
        doc.line(14, yPos, 196, yPos);
        yPos += 8;

        for (const [idx, step] of recipe.trainingSteps.entries()) {
          const splitStep = doc.splitTextToSize(`${idx + 1}. ${step.description}`, 180);
          if (yPos + (splitStep.length * 5) > 280) { doc.addPage(); yPos = 25; }
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(splitStep, 14, yPos);
          yPos += (splitStep.length * 5) + 2;

          if (step.image && step.image.startsWith('data:image')) {
            try {
              const props = doc.getImageProperties(step.image);
              const ratio = props.width / props.height;
              const targetWidth = 40;
              const targetHeight = targetWidth / ratio;
              if (yPos + targetHeight > 280) { doc.addPage(); yPos = 25; }
              doc.addImage(step.image, 'JPEG', 14, yPos, targetWidth, targetHeight);
              yPos += targetHeight + 5;
            } catch (e) {}
          }
          yPos += 3;
        }
      }

      // Pairings
      const pairings = recipe.category === 'Beverage' 
        ? [
            { label: 'Starter Pairing', p: recipe.starterPairing },
            { label: 'Main Pairing', p: recipe.mainPairing },
            { label: 'Dessert Pairing', p: recipe.dessertPairing }
          ]
        : [
            { label: 'Wine Pairing', p: recipe.winePairing },
            { label: 'Tequila Pairing', p: recipe.tequilaPairing },
            { label: 'Mezcal Pairing', p: recipe.mezcalPairing },
            { label: 'Cocktail Pairing', p: recipe.cocktailPairing }
          ];

      const activePairings = pairings.filter(pair => pair.p && pair.p.name);
      
      if (activePairings.length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 25; }
        else yPos += 10;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("SOMMELIER & MIXOLOGY PAIRINGS", 14, yPos);
        yPos += 5;
        doc.line(14, yPos, 196, yPos);
        yPos += 8;

        for (const pair of activePairings) {
          if (yPos > 260) { doc.addPage(); yPos = 25; }
          
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(72, 101, 129);
          doc.text(`${pair.label}: ${pair.p!.name}`, 14, yPos);
          yPos += 5;
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          
          const notes = [];
          if (pair.p!.nose) notes.push(`Nose: ${pair.p!.nose}`);
          if (pair.p!.palate) notes.push(`Palate: ${pair.p!.palate}`);
          if (pair.p!.finish) notes.push(`Finish: ${pair.p!.finish}`);
          if (pair.p!.aromas) notes.push(`Aromas: ${pair.p!.aromas}`);
          
          const splitNotes = doc.splitTextToSize(notes.join(' | '), 180);
          doc.text(splitNotes, 14, yPos);
          yPos += (splitNotes.length * 5) + 5;
        }
      }
    }

    doc.save(`Backbone_Hub_Recipe_Book_${new Date().toISOString().split('T')[0]}.pdf`);
  };

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
      return url;
    }
  };

  const handleGenerateRecipeIdea = async () => {
    if (!recipeIdeaPrompt) return;
    setIsGeneratingIdea(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `
        Hi! I'm working on a new idea and I'd love your expert culinary input. 
        I'm looking for some creative recipe ideas, cost-saving tips, and perfect pairings.
        
        Context: ${recipeIdeaPrompt}
        Current Inventory: ${inventoryItems.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
        
        Could you give me a detailed, friendly, and actionable response? 
        Think like a passionate head chef sharing their knowledge. 
        I'd love to hear about:
        - Some exciting recipe concepts we could try.
        - How we can keep things cost-effective using what we have.
        - What drinks or sides would really make these dishes shine.
        
        Use a warm, encouraging tone and format it clearly so it's easy to read. Thanks a lot!
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setRecipeIdeaResult(response.text || 'No suggestions generated.');
    } catch (error) {
      const message = handleAiError(error);
      setRecipeIdeaResult(message);
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = (r.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    
    let matchesCategory = true;
    if (mainTab === 'batches' || mainTab === 'allergy_matrix') {
      matchesCategory = filterCategory === 'All' || r.category === filterCategory;
    } else if (mainTab === 'bar_menu') {
      matchesCategory = filterCategory === 'All' || r.subCategory === filterCategory;
    }
    
    let matchesType = false;
    if (mainTab === 'kitchen_menu') {
      matchesType = r.type === 'menu_item' && r.category === 'Food';
    } else if (mainTab === 'bar_menu') {
      matchesType = r.type === 'menu_item' && r.category === 'Beverage';
    } else if (mainTab === 'batches') {
      matchesType = r.type === 'recipe';
    } else if (mainTab === 'allergy_matrix') {
      matchesType = true;
    }
    
    return matchesSearch && matchesCategory && matchesType;
  });

  // Sorting ingredients for dropdown
  const ingredientOptions = [...inventoryItems]
    .filter(item => 
      !ingredientSearchTerm || 
      item.name.toLowerCase().includes(ingredientSearchTerm.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(ingredientSearchTerm.toLowerCase()))
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="space-y-6 bg-main-bg min-h-full p-6">
      {/* Header */}
      <div className="bg-card-bg shadow-xl rounded-2xl p-8 flex flex-col sm:flex-row justify-between items-center border border-border-grey">
        <div>
          <h2 className="text-3xl font-bold text-text-navy flex items-center tracking-tight">
            <ChefHat className="mr-3 h-8 w-8 text-accent" />
            Menu Recipes & Costing
          </h2>
          <p className="mt-2 text-sm text-text-muted font-medium uppercase tracking-widest">Create recipes, link ingredients, and track food costs with precision.</p>
        </div>
        <div className="mt-6 sm:mt-0 flex gap-3">
          <Button 
            onClick={downloadRecipeBook}
            variant="secondary"
            className="bg-transparent border border-border-grey text-text-navy hover:bg-secondary-surface px-6 py-3 rounded-xl shadow-lg transition-all flex items-center font-bold uppercase tracking-widest text-[10px]"
          >
            <Download className="mr-2 h-5 w-5" />
            Recipe Book
          </Button>
          <Button 
            onClick={() => {
              if (mainTab === 'modifiers') {
                setTriggerModifierCreate(prev => prev + 1);
              } else {
                handleOpenModal();
              }
            }}
            className="bg-accent hover:opacity-90 text-white px-8 py-3 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center font-bold uppercase tracking-widest text-[10px]"
          >
            <Plus className="mr-2 h-5 w-5" />
            {mainTab === 'kitchen_menu' ? 'Create Kitchen Item' : 
             mainTab === 'bar_menu' ? 'Create Bar Item' : 
             mainTab === 'modifiers' ? 'Create Modifier' : 
             'Create Batch Recipe'}
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-card-bg p-1.5 rounded-2xl border border-border-grey w-fit mb-8 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-2">
          {[
            { id: 'kitchen_menu', label: 'Kitchen Menu' },
            { id: 'bar_menu', label: 'Bar Menu' },
            { id: 'batches', label: 'Prep & Batches' },
            { id: 'allergy_matrix', label: 'Allergy Matrix' },
            { id: 'recipe_ai', label: 'Recipe AI' },
            { id: 'modifiers', label: 'Modifiers' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id as any)}
              className={`whitespace-nowrap py-3 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-200 ${
                mainTab === tab.id
                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                  : 'text-text-muted hover:text-text-navy hover:bg-secondary-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {mainTab === 'allergy_matrix' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card-bg p-4 rounded-xl border border-border-grey">
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="block w-full sm:w-48 pl-3 pr-10 py-2 text-sm border-border-grey focus:outline-none focus:ring-accent focus:border-accent rounded-xl bg-main-bg text-text-navy appearance-none"
              >
                <option value="All">All Categories</option>
                <option value="Food">Kitchen</option>
                <option value="Beverage">Bar</option>
              </select>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search matrix..."
                className="w-full pl-10 pr-4 py-2 border border-border-grey rounded-xl text-sm focus:ring-accent focus:border-accent bg-main-bg text-text-navy placeholder-text-muted/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={downloadPDF} variant="secondary" className="bg-transparent border border-border-grey text-text-navy hover:bg-secondary-surface rounded-xl font-bold uppercase tracking-widest text-[10px]">
                <Download className="mr-2 h-4 w-4" />
                Export Matrix
              </Button>
            </div>
          </div>
          {isDetectingMatrix && (
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-center text-text-navy">
              <Loader2 className="h-5 w-5 mr-3 animate-spin text-accent" />
              <div>
                <p className="font-bold">Detecting Allergies...</p>
                <p className="text-sm text-text-muted">Analyzing your inventory ingredients to build the allergy matrix.</p>
              </div>
            </div>
          )}
          <div id="allergy-matrix-table" className="overflow-x-auto bg-card-bg shadow-2xl rounded-2xl border border-border-grey">
            <table className="min-w-full divide-y divide-border-grey">
            <thead className="bg-main-bg">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider sticky left-0 bg-main-bg z-10 border-r border-border-grey">Menu Item</th>
                {ALLERGIES_LIST.map(allergy => (
                  <th key={allergy} className="px-4 py-4 text-center text-xs font-bold text-text-muted uppercase tracking-wider border-r border-border-grey min-w-[120px]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-2 bg-card-bg rounded-lg border border-border-grey">
                        {allergyIcons[allergy] || '⚠️'}
                      </div>
                      <span className="whitespace-normal text-center leading-tight">
                        {allergy}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card-bg divide-y divide-border-grey">
              {recipes.filter(r => r.type === 'menu_item' && (filterCategory === 'All' || r.category === filterCategory)).map((recipe, idx) => (
                <tr key={recipe.id} className="hover:bg-secondary-surface transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-navy sticky left-0 bg-card-bg z-10 border-r border-border-grey">
                    {recipe.name}
                  </td>
                  {ALLERGIES_LIST.map(allergy => {
                    let ingredientsWithAllergy: string[] = [];
                    
                    if (recipe.allergyIngredients && recipe.allergyIngredients[allergy]) {
                      ingredientsWithAllergy = recipe.allergyIngredients[allergy];
                    } else if (recipe.ingredients) {
                      ingredientsWithAllergy = recipe.ingredients.map(ing => {
                        const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
                        if (!item) return null;
                        
                        if (item.allergies?.includes(allergy)) return item.name;
                        if (ingredientAllergies[item.name]?.includes(allergy)) return item.name;
                        
                        return null;
                      }).filter(Boolean) as string[];
                    }

                    const hasAllergy = recipe.allergies?.includes(allergy) || ingredientsWithAllergy.length > 0;

                    return (
                      <td key={allergy} className={`px-2 py-4 text-center border-r border-border-grey align-top ${hasAllergy ? 'bg-error/5' : ''}`}>
                        {hasAllergy ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-error/20 text-error shrink-0 border border-error/30">
                              <Check className="h-5 w-5" />
                            </span>
                            {ingredientsWithAllergy.length > 0 && (
                              <div className="flex flex-col items-center mt-1 w-full space-y-1">
                                {ingredientsWithAllergy.map((ingName, i) => (
                                  <span key={i} className="text-[9px] leading-tight text-error/80 text-center w-full break-words px-1" title={ingName}>
                                    {ingName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-border-grey">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {recipes.filter(r => r.type === 'menu_item' && (filterCategory === 'All' || r.category === filterCategory)).length === 0 && (
                <tr>
                  <td colSpan={ALLERGIES_LIST.length + 1} className="px-4 py-12 text-center text-text-muted font-medium">
                    No menu items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      ) : mainTab === 'modifiers' ? (
        <ModifierManagement 
          inventoryItems={inventoryItems} 
          triggerCreate={triggerModifierCreate}
        />
      ) : mainTab === 'recipe_ai' ? (
        <div className="space-y-6">
          <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey">
            <h3 className="text-2xl font-bold text-text-navy mb-6 flex items-center">
              <Sparkles className="mr-3 h-6 w-6 text-accent" />
              Recipe AI Intelligence
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Recipe Idea Generator */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-text-navy">Advanced Recipe AI Analysis</h4>
                  <div className="px-2 py-1 bg-accent/10 text-accent text-[10px] font-bold rounded uppercase tracking-widest">Generative</div>
                </div>
                <p className="text-sm text-text-muted">Generate new recipe ideas or analyze existing ones based on your current inventory.</p>
                <textarea
                  className="w-full bg-main-bg border border-border-grey rounded-xl p-4 text-sm text-text-navy focus:ring-accent focus:border-accent focus:outline-none transition-all placeholder-text-muted/50"
                  rows={4}
                  placeholder="e.g., 'Suggest a new Mexican-inspired appetizer using my current excess of tomatoes and onions...'"
                  value={recipeIdeaPrompt}
                  onChange={(e) => setRecipeIdeaPrompt(e.target.value)}
                />
                <Button 
                  onClick={handleGenerateRecipeIdea} 
                  isLoading={isGeneratingIdea}
                  disabled={!recipeIdeaPrompt}
                  className="w-full bg-accent hover:opacity-90 text-white rounded-xl py-3 font-bold shadow-lg shadow-accent/20 uppercase tracking-widest text-[10px]"
                >
                  Generate Analysis
                </Button>
                
                {recipeIdeaResult && (
                  <div className="mt-6 p-6 bg-main-bg rounded-2xl border border-border-grey prose prose-invert prose-sm max-w-none overflow-auto max-h-[400px] shadow-inner">
                    <div className="text-text-navy" dangerouslySetInnerHTML={{ __html: recipeIdeaResult.replace(/\n/g, '<br/>') }} />
                  </div>
                )}
              </div>

              {/* Cost Efficiency Analysis */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-text-navy">AI Recipe Cost Efficiency Analysis</h4>
                  <div className="px-2 py-1 bg-accent/10 text-accent text-[10px] font-bold rounded uppercase tracking-widest">Analytical</div>
                </div>
                <p className="text-sm text-text-muted">Select an existing recipe to analyze its cost efficiency and get optimization suggestions.</p>
                <select 
                  className="w-full bg-main-bg border border-border-grey rounded-xl p-4 text-sm text-text-navy focus:ring-accent focus:border-accent focus:outline-none appearance-none"
                  onChange={(e) => {
                    const recipe = recipes.find(r => r.id === e.target.value);
                    if (recipe) setEditingRecipe(recipe);
                  }}
                >
                  <option value="">Select a recipe to analyze...</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <Button 
                  onClick={handleAnalyzeCost} 
                  isLoading={isAnalyzingCost}
                  disabled={!editingRecipe.id}
                  variant="secondary"
                  className="w-full bg-transparent border border-border-grey text-text-navy hover:bg-secondary-surface rounded-xl py-3 font-bold uppercase tracking-widest text-[10px]"
                >
                  Analyze Cost Efficiency
                </Button>

                {costAnalysisResult && (
                  <div className="mt-6 p-6 bg-accent/5 rounded-2xl border border-accent/20 text-sm text-text-navy overflow-auto max-h-[400px] shadow-inner">
                    <div className="font-bold mb-4 text-accent flex items-center uppercase tracking-widest text-[10px]">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Cost Optimization Suggestions
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-text-muted">{costAnalysisResult}</div>
                  </div>
                )}
              </div>

              {/* Sustainability Analysis */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-text-navy">AI Sustainability & Carbon Footprint</h4>
                  <div className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold rounded uppercase tracking-widest">Eco-Intelligence</div>
                </div>
                <p className="text-sm text-text-muted">Analyze the environmental impact of your recipe and get tips for a greener kitchen.</p>
                <select 
                  className="w-full bg-main-bg border border-border-grey rounded-xl p-4 text-sm text-text-navy focus:ring-accent focus:border-accent focus:outline-none appearance-none"
                  onChange={(e) => {
                    const recipe = recipes.find(r => r.id === e.target.value);
                    if (recipe) setEditingRecipe(recipe);
                  }}
                >
                  <option value="">Select a recipe to analyze...</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <Button 
                  onClick={handleAnalyzeSustainability} 
                  isLoading={isAnalyzingSustainability}
                  disabled={!editingRecipe.id}
                  variant="secondary"
                  className="w-full bg-transparent border border-border-grey text-text-navy hover:bg-secondary-surface rounded-xl py-3 font-bold uppercase tracking-widest text-[10px]"
                >
                  Analyze Sustainability
                </Button>

                {sustainabilityResult && (
                  <div className="mt-6 p-6 bg-success/5 rounded-2xl border border-success/20 text-sm text-text-navy overflow-auto max-h-[400px] shadow-inner">
                    <div className="font-bold mb-4 text-success flex items-center uppercase tracking-widest text-[10px]">
                      <Leaf className="w-4 h-4 mr-2" />
                      Sustainability Insights
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1">
                        <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Eco Score</span>
                        <div className="text-2xl font-bold text-success">{editingRecipe.sustainabilityScore}/100</div>
                      </div>
                      <div className="flex-1 text-right">
                        <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Footprint</span>
                        <div className={`text-lg font-bold ${
                          editingRecipe.carbonFootprint === 'Low' ? 'text-success' : 
                          editingRecipe.carbonFootprint === 'Medium' ? 'text-warning' : 'text-error'
                        }`}>{editingRecipe.carbonFootprint}</div>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-text-muted">{sustainabilityResult}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Recipe Grid Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-card-bg p-6 rounded-2xl border border-border-grey">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder={`Search ${mainTab === 'kitchen_menu' ? 'kitchen items' : mainTab === 'bar_menu' ? 'bar items' : 'batches'}...`}
                className="w-full bg-main-bg border border-border-grey rounded-xl py-3 pl-12 pr-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-sm placeholder-text-muted/50 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {mainTab === 'bar_menu' && (
              <select
                className="bg-main-bg border border-border-grey rounded-xl py-3 px-6 text-text-navy focus:ring-2 focus:ring-accent focus:outline-none text-sm transition-all min-w-[160px] appearance-none"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Wine">Wine</option>
                <option value="Spirits">Spirits</option>
                <option value="Cocktails">Cocktails</option>
                <option value="Beer">Beer</option>
                <option value="Non-Alcoholic">Non-Alcoholic</option>
              </select>
            )}
            {mainTab === 'batches' && (
              <select
                className="bg-main-bg border border-border-grey rounded-xl py-3 px-6 text-text-navy focus:ring-2 focus:ring-accent focus:outline-none text-sm transition-all min-w-[160px] appearance-none"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Food">Kitchen</option>
                <option value="Beverage">Bar</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredRecipes.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-card-bg rounded-3xl border-2 border-dashed border-border-grey">
                <ChefHat className="mx-auto h-16 w-16 text-border-grey" />
                <h3 className="mt-4 text-lg font-bold text-text-navy">No recipes yet</h3>
                <p className="mt-2 text-text-muted">Get started by creating a new menu item or batch recipe.</p>
              </div>
            ) : (
              filteredRecipes.map(recipe => {
                const cost = calculateTotalCost(recipe.ingredients);
                const priceExcVat = recipe.sellingPrice;
                const vatAmount = priceExcVat * ((recipe.vatRate || 0) / 100);
                const priceIncVat = priceExcVat + vatAmount;
                const marginCash = priceExcVat - cost;
                const marginPercent = priceExcVat > 0 ? (marginCash / priceExcVat) * 100 : 0;
                const isLowMargin = marginPercent < 65;

                return (
                  <div 
                    key={recipe.id} 
                    className="bg-card-bg rounded-3xl shadow-2xl hover:shadow-accent/10 transition-all duration-300 overflow-hidden border border-border-grey flex flex-col group cursor-pointer"
                    onClick={() => handleOpenModal(recipe)}
                  >
                    <div className="aspect-[4/3] w-full bg-main-bg flex items-center justify-center border-b border-border-grey overflow-hidden relative">
                      <img 
                        src={recipe.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(recipe.name)}/400/400`} 
                        alt={recipe.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        referrerPolicy="no-referrer" 
                      />
                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-white bg-accent px-3 py-1 rounded-full shadow-lg shadow-accent/20">
                          {recipe.type === 'menu_item' ? 'Menu Item' : 'Recipe'}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-text-navy truncate leading-tight">{recipe.name}</h3>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-accent mt-1">{recipe.category} • {recipe.subCategory || 'General'}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(recipe); }} className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all">
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {recipe.description && <p className="text-xs text-text-muted mb-6 line-clamp-2 leading-relaxed">{recipe.description}</p>}

                      <div className="grid grid-cols-2 gap-6 border-t border-border-grey pt-6 mb-6">
                        <div>
                          <span className="text-[10px] uppercase tracking-widest font-bold text-text-muted block mb-1">Cost (COGS)</span>
                          <p className="text-xl font-bold text-text-navy">£{cost.toFixed(2)}</p>
                          {recipe.type === 'recipe' && recipe.yieldAmount && recipe.yieldAmount > 0 && (
                            <p className="text-[10px] text-accent font-bold mt-0.5">£{(cost / recipe.yieldAmount).toFixed(2)} / {recipe.yieldUnit || 'unit'}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-widest font-bold text-text-muted block mb-1">Price (Inc VAT)</span>
                          <p className="text-xl font-bold text-text-navy">£{priceIncVat.toFixed(2)}</p>
                          <p className="text-[10px] text-text-muted font-bold mt-0.5">£{priceExcVat.toFixed(2)} exc. VAT</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-main-bg p-4 rounded-2xl border border-border-grey mb-6">
                        <div className="flex items-center">
                           <span className={`text-sm font-bold px-3 py-1 rounded-lg ${isLowMargin ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'}`}>
                             {marginPercent.toFixed(1)}% GP
                           </span>
                           {isLowMargin && <span title="Low Gross Profit Margin"><AlertCircle className="ml-2 h-4 w-4 text-error" /></span>}
                        </div>
                        <div className="flex flex-col items-end">
                          {recipe.calories && (
                            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                              {recipe.type === 'recipe' && recipe.yieldAmount && recipe.yieldAmount > 0 
                                ? `${Math.round(recipe.calories / recipe.yieldAmount)} kcal / ${recipe.yieldUnit || 'unit'}` 
                                : `${recipe.calories} kcal`}
                            </span>
                          )}
                          {recipe.type === 'recipe' && recipe.yieldAmount && (
                            <span className="text-[10px] text-accent font-bold uppercase tracking-wider mt-0.5">Yield: {recipe.yieldAmount} {recipe.yieldUnit || ''}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                        {recipe.type === 'recipe' && (
                          <Button 
                            onClick={() => {
                              setProducingBatch(recipe);
                              setProduceQuantity(1);
                            }}
                            className="flex-1 bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest"
                          >
                            Produce
                          </Button>
                        )}
                        <Button 
                          onClick={() => handleOpenModal(recipe)}
                          className="flex-1 bg-accent hover:opacity-90 text-white rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-accent/20"
                        >
                          View Details
                        </Button>
                      </div>

                      {recipe.sustainabilityScore !== undefined && (
                        <div className="mt-4 flex items-center justify-between bg-success/5 p-3 rounded-xl border border-success/20">
                          <div className="flex items-center gap-2">
                            <Leaf className="h-4 w-4 text-success" />
                            <span className="text-[10px] font-bold text-success uppercase tracking-widest">Eco Score: {recipe.sustainabilityScore}/100</span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${
                            recipe.carbonFootprint === 'Low' ? 'text-success' : 
                            recipe.carbonFootprint === 'Medium' ? 'text-warning' : 'text-error'
                          }`}>
                            {recipe.carbonFootprint} Footprint
                          </span>
                        </div>
                      )}
                      
                      {recipe.allergies && recipe.allergies.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-border-grey">
                          <div className="flex flex-wrap gap-2">
                            {recipe.allergies.map(allergy => (
                              <span key={allergy} className="text-[10px] font-bold bg-secondary-surface text-text-navy px-2 py-1 rounded-lg flex items-center gap-1.5 border border-border-grey">
                                <span className="opacity-70 scale-75">{allergyIcons[allergy] || '⚠️'}</span>
                                {allergy}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bg-main-bg px-6 py-4 flex justify-between items-center border-t border-border-grey">
                      <div className="flex gap-3">
                        {recipe.type === 'recipe' && (
                          <button
                            onClick={() => setProducingBatch(recipe)}
                            className="text-[10px] uppercase tracking-widest font-bold text-accent hover:text-text-navy flex items-center transition-colors"
                          >
                            <ChefHat className="h-3 w-3 mr-1.5" /> Produce Batch
                          </button>
                        )}
                        {recipe.trainingSteps && recipe.trainingSteps.length > 0 && (
                          <button
                            onClick={() => {
                              handleOpenModal(recipe);
                              setActiveTab('training');
                            }}
                            className="text-[10px] uppercase tracking-widest font-bold text-accent hover:text-text-navy flex items-center transition-colors"
                          >
                            <Sparkles className="h-3 w-3 mr-1.5" /> Training Guide
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={() => onDeleteRecipe(recipe.id)}
                        className="text-[10px] uppercase tracking-widest font-bold text-cta hover:opacity-80 flex items-center transition-colors"
                      >
                        <Trash2 className="h-3 w-3 mr-1.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-main-bg w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden border border-border-grey flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-8 py-6 bg-card-bg border-b border-border-grey flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-text-navy">
                    {editingRecipe.id 
                      ? `Edit ${mainTab === 'kitchen_menu' ? 'Kitchen Item' : mainTab === 'bar_menu' ? 'Bar Item' : 'Batch Recipe'}` 
                      : `Create New ${mainTab === 'kitchen_menu' ? 'Kitchen Item' : mainTab === 'bar_menu' ? 'Bar Item' : 'Batch Recipe'}`}
                  </h2>
                  <p className="text-[10px] text-accent uppercase tracking-widest font-bold mt-1">
                    {editingRecipe.type === 'menu_item' ? 'Menu Item' : 'Batch Recipe'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-text-muted hover:text-text-navy hover:bg-main-bg rounded-xl transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
                    
                    {/* Tabs */}
                    <div className="px-8 bg-card-bg border-b border-border-grey flex overflow-x-auto no-scrollbar gap-2">
                      {[
                        { id: 'basic', label: 'Basic Info', icon: Info },
                        { id: 'pricing', label: 'Pricing & Profit', icon: PoundSterling },
                        { id: 'ingredients', label: 'Ingredients', icon: ChefHat },
                        { id: 'allergies', label: 'Allergies', icon: AlertCircle },
                        { id: 'training', label: 'Training', icon: Sparkles },
                        { id: 'sustainability', label: 'Sustainability', icon: Leaf },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center px-6 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id
                              ? 'border-accent text-text-navy bg-accent/5'
                              : 'border-transparent text-text-muted hover:text-text-navy hover:bg-main-bg'
                          }`}
                        >
                          <tab.icon className={`w-4 h-4 mr-2 ${activeTab === tab.id ? 'text-accent' : ''}`} />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-main-bg">
                      {activeTab === 'basic' && (
                        <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Recipe Name</label>
                            <input
                              type="text"
                              className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all placeholder-text-muted/50"
                              value={editingRecipe.name}
                              onChange={(e) => setEditingRecipe(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g. Signature Burger"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Category</label>
                            <select
                              className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all appearance-none"
                              value={editingRecipe.category || 'Food'}
                              onChange={(e) => setEditingRecipe(prev => ({ ...prev, category: e.target.value }))}
                            >
                              <option value="Food">Kitchen</option>
                              <option value="Beverage">Bar</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Kitchen Display</label>
                            <select
                              className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all appearance-none"
                              value={editingRecipe.station || 'Grill'}
                              onChange={(e) => setEditingRecipe(prev => ({ ...prev, station: e.target.value as any }))}
                            >
                              <option value="Grill">Grill</option>
                              <option value="Cold">Cold</option>
                              <option value="Dessert">Dessert</option>
                              <option value="Bar">Bar</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Course</label>
                            <select
                              className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all appearance-none"
                              value={editingRecipe.course || '1st Course'}
                              onChange={(e) => setEditingRecipe(prev => ({ ...prev, course: e.target.value as any }))}
                            >
                              <option value="1st Course">1st Course</option>
                              <option value="2nd Course">2nd Course</option>
                              <option value="3rd Course">3rd Course</option>
                              <option value="Sides">Sides</option>
                              <option value="Desserts">Desserts</option>
                              <option value="Starters">Starters</option>
                              <option value="Mains">Mains</option>
                            </select>
                          </div>
                        </div>

                        <div className="bg-accent/5 p-6 rounded-2xl border border-accent/20">
                          <div className="flex items-center justify-between mb-4">
                            <label className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              Availability Tracking
                            </label>
                            <input
                              type="checkbox"
                              className="h-5 w-5 bg-main-bg border-border-grey rounded text-accent focus:ring-accent"
                              checked={editingRecipe.trackAvailability || false}
                              onChange={(e) => setEditingRecipe(prev => ({ ...prev, trackAvailability: e.target.checked }))}
                            />
                          </div>
                          {editingRecipe.trackAvailability && (
                            <div className="space-y-2">
                              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Portions Remaining</label>
                              <input
                                type="number"
                                className="w-full bg-main-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-accent focus:border-accent focus:outline-none"
                                value={editingRecipe.availabilityCount || 0}
                                onChange={(e) => setEditingRecipe(prev => ({ ...prev, availabilityCount: Number(e.target.value) }))}
                                placeholder="e.g. 20"
                                min="0"
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Sub-category</label>
                            <select
                              className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-accent focus:border-accent focus:outline-none appearance-none"
                              value={editingRecipe.subCategory || ''}
                              onChange={(e) => setEditingRecipe(prev => ({ ...prev, subCategory: e.target.value }))}
                            >
                              <option value="">Select Sub-category</option>
                              {editingRecipe.category === 'Beverage' ? (
                                <>
                                  <option value="Wine - Red">Wine - Red</option>
                                  <option value="Wine - White">Wine - White</option>
                                  <option value="Wine - Rosé">Wine - Rosé</option>
                                  <option value="Wine - Sparkling">Wine - Sparkling</option>
                                  <option value="Spirits - Gin">Spirits - Gin</option>
                                  <option value="Spirits - Vodka">Spirits - Vodka</option>
                                  <option value="Spirits - Whiskey">Spirits - Whiskey</option>
                                  <option value="Spirits - Rum">Spirits - Rum</option>
                                  <option value="Spirits - Tequila/Mezcal">Spirits - Tequila/Mezcal</option>
                                  <option value="Cocktails">Cocktails</option>
                                  <option value="Beer">Beer</option>
                                  <option value="Non-Alcoholic">Non-Alcoholic</option>
                                </>
                              ) : (
                                <>
                                  <option value="Starters">Starters</option>
                                  <option value="Mains">Mains</option>
                                  <option value="Desserts">Desserts</option>
                                  <option value="Sides">Sides</option>
                                  <option value="Snacks">Snacks</option>
                                  <option value="Modifiers">Modifiers</option>
                                </>
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">
                              {editingRecipe.type === 'recipe' ? 'Total Calories' : 'Calories'}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-accent focus:border-accent focus:outline-none"
                                value={editingRecipe.calories || ''}
                                onChange={(e) => setEditingRecipe(prev => ({ ...prev, calories: Number(e.target.value) }))}
                                placeholder="e.g. 450"
                              />
                              <Button 
                                onClick={handleCalculateCalories} 
                                disabled={isCalculatingCalories || !editingRecipe.ingredients?.length}
                                variant="secondary"
                                className="bg-transparent border border-border-grey text-text-navy hover:bg-card-bg rounded-xl px-4"
                                title="Estimate calories based on ingredients"
                              >
                                {isCalculatingCalories ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {mainTab === 'batches' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Yield Amount</label>
                              <input
                                type="number"
                                className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-accent focus:border-accent focus:outline-none transition-all"
                                value={editingRecipe.yieldAmount || ''}
                                onChange={(e) => setEditingRecipe(prev => ({ ...prev, yieldAmount: Number(e.target.value) }))}
                                placeholder="e.g. 10"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Yield Unit</label>
                              <input
                                type="text"
                                className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-accent focus:border-accent focus:outline-none transition-all"
                                value={editingRecipe.yieldUnit || ''}
                                onChange={(e) => setEditingRecipe(prev => ({ ...prev, yieldUnit: e.target.value }))}
                                placeholder="e.g. portions, L, kg"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 flex justify-between items-center">
                            Description / Menu Copy
                            <button 
                              onClick={handleGenerateTraining}
                              disabled={isGeneratingTraining}
                              className="text-accent hover:opacity-80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
                            >
                              {isGeneratingTraining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              AI Generate
                            </button>
                          </label>
                          <textarea
                            rows={3}
                            className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-accent focus:border-accent focus:outline-none transition-all placeholder-text-muted/50"
                            value={editingRecipe.description || ''}
                            onChange={(e) => setEditingRecipe(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Detailed, appetizing description for upselling..."
                          />
                        </div>

                        {mainTab !== 'batches' && (
                          <div className="bg-card-bg border border-border-grey rounded-2xl p-6">
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">Recipe Image</label>
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center gap-3">
                                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Enhancement Style:</label>
                                <select
                                  className="bg-main-bg border border-border-grey rounded-lg py-1 px-3 text-xs text-text-navy focus:ring-accent focus:border-accent focus:outline-none appearance-none"
                                  value={imageStyle}
                                  onChange={(e) => setImageStyle(e.target.value)}
                                >
                                  <option value="studio lighting">Studio Lighting</option>
                                  <option value="rustic">Rustic</option>
                                  <option value="minimalist">Minimalist</option>
                                  <option value="moody dark">Moody Dark</option>
                                  <option value="bright and airy">Bright & Airy</option>
                                </select>
                              </div>

                              <div className="flex gap-3">
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  ref={fileInputRef}
                                  onChange={handleImageUpload}
                                />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment"
                                  className="hidden" 
                                  ref={cameraInputRef}
                                  onChange={handleImageUpload}
                                />
                                <Button 
                                  variant="secondary" 
                                  className="flex-1 bg-transparent border border-border-grey text-text-navy hover:bg-card-bg rounded-xl" 
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isEnhancingImage}
                                >
                                  {isEnhancingImage ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : <><Upload className="h-4 w-4 mr-2" /> Upload</>}
                                </Button>
                                <Button 
                                  variant="secondary" 
                                  className="flex-1 bg-transparent border border-border-grey text-text-navy hover:bg-card-bg rounded-xl"
                                  onClick={() => cameraInputRef.current?.click()}
                                  disabled={isEnhancingImage}
                                >
                                  {isEnhancingImage ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : <><Camera className="h-4 w-4 mr-2" /> Camera</>}
                                </Button>
                              </div>
                              {isEnhancingImage && (
                                <p className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center justify-center animate-pulse">
                                  <Sparkles className="h-3 w-3 mr-1" /> AI Enhancing...
                                </p>
                              )}
                              {editingRecipe.imageUrl && (
                                <div className="relative group aspect-video w-full rounded-xl overflow-hidden border border-border-grey bg-main-bg flex items-center justify-center p-2">
                                  <img src={editingRecipe.imageUrl} alt="Preview" className="max-w-full max-h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button 
                                      variant="danger" 
                                      className="bg-cta/20 hover:bg-cta/40 border-cta/20 text-cta rounded-full p-2"
                                      onClick={() => setEditingRecipe(prev => ({ ...prev, imageUrl: '' }))}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'pricing' && (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Price (Exc. VAT) £</label>
                             <div className="relative">
                               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">£</span>
                               <input
                                type="number"
                                step="0.01"
                                className="w-full bg-card-bg border border-border-grey rounded-xl py-3 pl-8 pr-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all placeholder-text-muted/50"
                                value={editingRecipe.sellingPrice ?? ''}
                                onChange={(e) => setEditingRecipe(prev => ({ ...prev, sellingPrice: e.target.value === '' ? '' as any : parseFloat(e.target.value) }))}
                                placeholder="0.00"
                              />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">VAT Code</label>
                             <div className="relative">
                               <select
                                 className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all appearance-none"
                                 value={editingRecipe.vatCode || 'STANDARD_20'}
                                 onChange={(e) => {
                                   const code = e.target.value as any;
                                   let rate = 20;
                                   if (code === 'REDUCED_5') rate = 5;
                                   else if (code === 'ZERO_0' || code === 'EXEMPT') rate = 0;
                                   setEditingRecipe(prev => ({ ...prev, vatCode: code, vatRate: rate }));
                                 }}
                               >
                                 <option value="STANDARD_20">Standard (20%)</option>
                                 <option value="REDUCED_5">Reduced (5%)</option>
                                 <option value="ZERO_0">Zero Rated (0%)</option>
                                 <option value="EXEMPT">Exempt (0%)</option>
                               </select>
                               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none h-4 w-4" />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">VAT Rate (%)</label>
                             <div className="relative">
                               <input
                                type="number"
                                step="0.1"
                                className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all placeholder-text-muted/50"
                                value={editingRecipe.vatRate ?? ''}
                                onChange={(e) => setEditingRecipe(prev => ({ ...prev, vatRate: e.target.value === '' ? '' as any : parseFloat(e.target.value) }))}
                                placeholder="20.0"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">%</span>
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Service Charge (%)</label>
                             <div className="relative">
                               <input
                                type="number"
                                step="0.1"
                                className="w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all placeholder-text-muted/50"
                                value={editingRecipe.serviceChargeRate ?? ''}
                                onChange={(e) => setEditingRecipe(prev => ({ ...prev, serviceChargeRate: e.target.value === '' ? '' as any : parseFloat(e.target.value) }))}
                                placeholder="12.5"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">%</span>
                             </div>
                          </div>
                        </div>

                        {(() => {
                          const priceExcVat = Number(editingRecipe.sellingPrice) || 0;
                          const vatRate = Number(editingRecipe.vatRate) || 0;
                          const serviceChargeRate = Number(editingRecipe.serviceChargeRate) || 0;
                          
                          const vatAmount = priceExcVat * (vatRate / 100);
                          const priceIncVat = priceExcVat + vatAmount;
                          const serviceChargeAmount = priceIncVat * (serviceChargeRate / 100);
                          const totalToCustomer = priceIncVat + serviceChargeAmount;
                          
                          const cost = calculateTotalCost(editingRecipe.ingredients);
                          const grossProfitCash = priceExcVat - cost;
                          const grossProfitPercent = priceExcVat > 0 ? (grossProfitCash / priceExcVat) * 100 : 0;

                          return (
                            <div className="bg-card-bg p-8 rounded-3xl border border-border-grey shadow-sm">
                              <h4 className="text-[10px] font-bold text-accent uppercase tracking-widest mb-8 flex items-center gap-2">
                                <Calculator className="h-4 w-4" /> Profit Analysis
                              </h4>
                              <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 bg-main-bg rounded-2xl border border-border-grey">
                                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Cost of Goods (COGS)</span>
                                      <div className="text-right">
                                        <span className="text-lg font-bold text-text-navy">£{cost.toFixed(2)}</span>
                                        {editingRecipe.type === 'recipe' && editingRecipe.yieldAmount && editingRecipe.yieldAmount > 0 && (
                                          <div className="text-[10px] text-text-muted/70 uppercase tracking-widest">£{(cost / editingRecipe.yieldAmount).toFixed(2)} / {editingRecipe.yieldUnit || 'unit'}</div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center p-4 bg-main-bg rounded-2xl border border-border-grey">
                                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Price (Exc. VAT)</span>
                                      <span className="text-lg font-bold text-text-navy">£{priceExcVat.toFixed(2)}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center p-4 bg-main-bg rounded-2xl border border-border-grey">
                                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">VAT ({vatRate}%)</span>
                                      <span className="text-lg font-bold text-text-muted/70">+ £{vatAmount.toFixed(2)}</span>
                                    </div>
                                  </div>

                                  <div className="bg-accent p-8 rounded-3xl text-white flex flex-col justify-center shadow-lg shadow-accent/20">
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Total to Customer</span>
                                    <div className="text-5xl font-bold">£{totalToCustomer.toFixed(2)}</div>
                                    <div className="mt-6 space-y-2 opacity-80">
                                      <div className="flex justify-between text-sm">
                                        <span>Price (Inc. VAT)</span>
                                        <span className="font-bold">£{priceIncVat.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span>Service Charge ({serviceChargeRate}%)</span>
                                        <span className="font-bold">£{serviceChargeAmount.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                  <div className={`p-6 rounded-2xl border ${grossProfitCash < 0 ? 'bg-cta/5 border-cta/20' : 'bg-success/5 border-success/20'}`}>
                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Gross Profit (£)</p>
                                    <p className={`text-3xl font-bold ${grossProfitCash < 0 ? 'text-cta' : 'text-success'}`}>
                                      £{grossProfitCash.toFixed(2)}
                                    </p>
                                  </div>
                                  <div className={`p-6 rounded-2xl border ${grossProfitPercent < 65 ? 'bg-cta/5 border-cta/20' : 'bg-success/5 border-success/20'}`}>
                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">GP Margin (%)</p>
                                    <p className={`text-3xl font-bold ${grossProfitPercent < 65 ? 'text-cta' : 'text-success'}`}>
                                      {grossProfitPercent.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {activeTab === 'ingredients' && (
                      <div className="space-y-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                          <div className="flex-1 w-full">
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Recipe Ingredients</label>
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/50" />
                              <input
                                type="text"
                                placeholder="Search ingredients or batches..."
                                className="pl-11 pr-10 w-full bg-card-bg border border-border-grey rounded-xl py-3 px-4 text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all placeholder-text-muted/30 text-sm"
                                value={ingredientSearchTerm}
                                onChange={(e) => setIngredientSearchTerm(e.target.value)}
                              />
                              {ingredientSearchTerm && (
                                <button
                                  onClick={() => setIngredientSearchTerm('')}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/50 hover:text-text-muted transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 w-full sm:w-auto self-end">
                            <div className="flex items-center bg-card-bg rounded-xl border border-border-grey p-1 h-12">
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-3">Scale</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                className="w-12 bg-transparent text-sm font-bold text-text-navy focus:outline-none p-1 text-center"
                                value={scaleMultiplier}
                                onChange={(e) => setScaleMultiplier(e.target.value === '' ? '' : parseFloat(e.target.value))}
                              />
                              <span className="text-sm text-text-muted/50 px-1">x</span>
                              <Button 
                                onClick={handleScaleRecipe} 
                                variant="secondary" 
                                className="text-[10px] font-bold uppercase tracking-widest h-10 ml-1 px-4 bg-accent text-white hover:opacity-90 rounded-lg transition-all"
                              >
                                Apply
                              </Button>
                            </div>
                            <Button 
                              onClick={handleAddIngredientRow} 
                              variant="secondary" 
                              className="text-[10px] font-bold uppercase tracking-widest h-12 whitespace-nowrap bg-transparent border border-border-grey text-text-navy hover:bg-card-bg rounded-xl px-6 transition-all"
                            >
                              <Plus className="h-4 w-4 mr-2" /> Add Row
                            </Button>
                          </div>
                        </div>

                        <div className="bg-accent/5 p-6 rounded-3xl border border-accent/20 flex flex-col gap-4 shadow-sm">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="bg-accent/20 p-2 rounded-lg">
                                <Sparkles className="h-5 w-5 text-accent" />
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-accent uppercase tracking-widest block">AI Intelligence</span>
                                <span className="text-sm font-bold text-text-navy">Cost-Efficiency Analysis</span>
                              </div>
                            </div>
                            <Button 
                              onClick={handleAnalyzeCost} 
                              disabled={isAnalyzingCost || !editingRecipe.ingredients || editingRecipe.ingredients.length === 0} 
                              className="text-[10px] font-bold uppercase tracking-widest h-10 bg-accent text-white hover:opacity-90 rounded-xl px-6 transition-all shadow-md shadow-accent/20"
                            >
                              {isAnalyzingCost ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyze Cost'}
                            </Button>
                          </div>
                          {costAnalysisResult && (
                            <div className="p-6 bg-main-bg rounded-2xl border border-border-grey text-sm text-text-navy whitespace-pre-wrap leading-relaxed shadow-inner">
                              {costAnalysisResult}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto bg-main-bg p-6 rounded-3xl border border-border-grey shadow-inner custom-scrollbar">
                          {editingRecipe.ingredients?.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-text-muted/50">
                              <div className="bg-card-bg p-4 rounded-full mb-4">
                                <Plus className="h-8 w-8 opacity-20" />
                              </div>
                              <p className="text-sm uppercase tracking-widest font-bold">No ingredients added yet.</p>
                              <p className="text-xs mt-2 opacity-60">Click "Add Row" to start building your recipe.</p>
                            </div>
                          )}
                          {editingRecipe.ingredients?.map((ing, idx) => {
                            const selectedItem = inventoryItems.find(i => i.id === ing.inventoryItemId);
                            const lineCost = selectedItem ? selectedItem.pricePerUnit * ing.quantity : 0;
                            
                            return (
                              <div key={idx} className="flex flex-col lg:flex-row gap-4 lg:items-center bg-card-bg p-5 rounded-2xl border border-border-grey transition-all hover:border-accent/50 hover:shadow-md group">
                                <div className="flex-1">
                                    <select 
                                    className="w-full bg-main-bg border border-border-grey rounded-xl py-3 px-4 text-sm text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all appearance-none"
                                    value={ing.inventoryItemId}
                                    onChange={(e) => handleIngredientChange(idx, 'inventoryItemId', e.target.value)}
                                    >
                                    <option value="">Select Ingredient</option>
                                    {[...ingredientOptions, ...(ing.inventoryItemId && !ingredientOptions.find(opt => opt.id === ing.inventoryItemId) ? [inventoryItems.find(i => i.id === ing.inventoryItemId)].filter(Boolean) as InventoryItem[] : [])]
                                      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                      .map(item => (
                                        <option key={item.id} value={item.id}>
                                        {item.name} {(item.category === 'Batch' || item.category === 'Prep') ? `(${item.category})` : ''} (£{item.pricePerUnit}/{item.unit})
                                        </option>
                                    ))}
                                    </select>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="w-32 relative">
                                    <input
                                        type="number"
                                        step="0.001"
                                        className="w-full bg-main-bg border border-border-grey rounded-xl py-3 px-4 text-sm font-bold text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all text-center"
                                        value={ing.quantity ?? ''}
                                        onChange={(e) => handleIngredientChange(idx, 'quantity', e.target.value === '' ? '' as any : parseFloat(e.target.value))}
                                        placeholder="0.000"
                                    />
                                    <span className="absolute -top-2 left-3 bg-card-bg px-2 text-[8px] font-bold text-text-muted uppercase tracking-widest">Qty</span>
                                    </div>
                                    
                                    <div className="w-24">
                                    <select
                                        className="w-full bg-main-bg border border-border-grey rounded-xl py-3 px-4 text-sm text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none transition-all appearance-none"
                                        value={ing.unit || selectedItem?.unit || ''}
                                        onChange={(e) => handleIngredientChange(idx, 'unit', e.target.value)}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                        <option value="L">L</option>
                                        <option value="ml">ml</option>
                                        <option value="unit">unit</option>
                                        {selectedItem && !['kg', 'g', 'L', 'ml', 'unit'].includes(selectedItem.unit) && (
                                        <option value={selectedItem.unit}>{selectedItem.unit}</option>
                                        )}
                                    </select>
                                    </div>
                                    
                                    <div className="w-32 px-4 py-3 bg-accent/10 border border-accent/20 rounded-xl text-right">
                                      <span className="text-xs font-bold text-text-navy">£{lineCost.toFixed(2)}</span>
                                    </div>

                                    <Button 
                                      variant="danger" 
                                      size="sm" 
                                      className="h-11 w-11 bg-cta/10 hover:bg-cta/20 border border-cta/20 text-cta rounded-xl transition-all"
                                      onClick={() => handleRemoveIngredientRow(idx)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="flex justify-end pt-4">
                          <div className="bg-accent px-8 py-4 rounded-2xl shadow-md shadow-accent/20 flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 block mb-1 text-white">Total Recipe Cost (COGS)</span>
                            <div className="text-2xl font-bold text-white">£{calculateTotalCost(editingRecipe.ingredients).toFixed(2)}</div>
                            {editingRecipe.type === 'recipe' && editingRecipe.yieldAmount && editingRecipe.yieldAmount > 0 && (
                              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1 text-white">£{(calculateTotalCost(editingRecipe.ingredients) / editingRecipe.yieldAmount).toFixed(2)} / {editingRecipe.yieldUnit || 'unit'}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'allergies' && (
                      <div className="space-y-6">
                        <div className="bg-accent/5 p-6 rounded-2xl border border-accent/20 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center">
                                <Sparkles className="h-4 w-4 mr-2" />
                                AI Allergy Detection
                              </h4>
                              <p className="text-xs text-text-muted mt-1">
                                Allergies are automatically detected based on ingredients.
                              </p>
                            </div>
                            {isDetectingAllergies && (
                              <div className="flex items-center text-accent text-[10px] font-bold uppercase tracking-widest">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Detecting...
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">
                            Select Allergies
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {ALLERGIES_LIST.map(allergy => {
                              const isSelected = (editingRecipe.allergies || []).includes(allergy);

                              return (
                                <button
                                  key={allergy}
                                  type="button"
                                  onClick={() => {
                                    const checked = !isSelected;
                                    
                                    if (!checked) {
                                      setDismissedAllergies(prev => new Set(prev).add(allergy));
                                    } else {
                                      setDismissedAllergies(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(allergy);
                                        return newSet;
                                      });
                                    }

                                    const newAllergies = checked 
                                      ? [...(editingRecipe.allergies || []), allergy]
                                      : (editingRecipe.allergies || []).filter(a => a !== allergy);
                                    setEditingRecipe(prev => ({ ...prev, allergies: newAllergies }));
                                  }}
                                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 group relative ${
                                    isSelected 
                                      ? 'bg-accent border-accent shadow-md shadow-accent/20' 
                                      : 'bg-card-bg border-border-grey hover:border-accent/50'
                                  }`}
                                >
                                  {isSelected && (
                                    <div className="absolute top-2 right-2">
                                      <div className="bg-white rounded-full p-0.5">
                                        <Check className="h-3 w-3 text-accent" />
                                      </div>
                                    </div>
                                  )}
                                  <span className={`text-2xl mb-2 transition-transform duration-200 group-hover:scale-110 ${!isSelected && 'grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                                    {allergyIcons[allergy] || '⚠️'}
                                  </span>
                                  <span className={`text-[10px] font-bold uppercase tracking-widest text-center ${isSelected ? 'text-white' : 'text-text-muted group-hover:text-text-navy'}`}>
                                    {allergy}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'training' && (
                      <div className="space-y-8">
                        {mainTab !== 'batches' && (
                          <>
                            <div className="flex items-center justify-between">
                              <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Training Details</h3>
                              <Button
                                onClick={handleGenerateTraining}
                                disabled={isGeneratingTraining || !editingRecipe.name}
                                className="bg-accent text-white hover:opacity-90 rounded-xl px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all shadow-md shadow-accent/20"
                              >
                                {isGeneratingTraining ? (
                                  <>
                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    AI Generate
                                  </>
                                )}
                              </Button>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Description (Upselling)</label>
                              <textarea
                                className="block w-full bg-main-bg border border-border-grey rounded-xl text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-sm p-4 placeholder-text-muted/30 leading-relaxed transition-all"
                                rows={3}
                                value={editingRecipe.description || ''}
                                onChange={(e) => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                                placeholder="A professional description for staff to use when upselling..."
                              />
                            </div>

                            {/* Pairings Sections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {(editingRecipe.category === 'Beverage' ? [
                                { label: 'Starter', key: 'starterPairing', icon: '🥗', dot: 'bg-success' },
                                { label: 'Main', key: 'mainPairing', icon: '🍽️', dot: 'bg-accent' },
                                { label: 'Dessert', key: 'dessertPairing', icon: '🍰', dot: 'bg-accent' }
                              ] : [
                                { label: 'Wine', key: 'winePairing', icon: '🍷', dot: 'bg-cta' },
                                { label: 'Tequila', key: 'tequilaPairing', icon: '🥃', dot: 'bg-warning' },
                                { label: 'Mezcal', key: 'mezcalPairing', icon: '🌵', dot: 'bg-text-muted' },
                                { label: 'Cocktail', key: 'cocktailPairing', icon: '🍸', dot: 'bg-accent' }
                              ]).map((p) => (
                                <div key={p.key} className="bg-card-bg border border-border-grey p-6 rounded-2xl space-y-4 hover:border-accent/30 transition-all group">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest flex items-center text-text-muted group-hover:text-text-navy transition-colors">
                                      <span className={`w-2 h-2 ${p.dot} rounded-full mr-2`}></span>
                                      {p.label} Pairing
                                    </h4>
                                    <span className="text-xl opacity-50 group-hover:opacity-100 transition-opacity">{p.icon}</span>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-text-muted/70 uppercase tracking-widest mb-2">Suggested Item</label>
                                    <input
                                      type="text"
                                      className="block w-full bg-main-bg border border-border-grey rounded-xl text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-sm px-4 py-2 placeholder-text-muted/30"
                                      value={(editingRecipe[p.key as keyof Recipe] as any)?.name || ''}
                                      onChange={(e) => setEditingRecipe({ 
                                        ...editingRecipe, 
                                        [p.key]: { ...(editingRecipe[p.key as keyof Recipe] as any || {}), name: e.target.value } 
                                      })}
                                      placeholder={`e.g., A specific ${p.label}...`}
                                    />
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-[10px] font-bold text-text-muted/70 uppercase tracking-widest mb-2">Nose / Aroma</label>
                                      <textarea
                                        className="block w-full bg-main-bg border border-border-grey rounded-xl text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-sm px-4 py-2 placeholder-text-muted/30"
                                        rows={2}
                                        value={(editingRecipe[p.key as keyof Recipe] as any)?.nose || ''}
                                        onChange={(e) => setEditingRecipe({ 
                                          ...editingRecipe, 
                                          [p.key]: { ...(editingRecipe[p.key as keyof Recipe] as any || {}), nose: e.target.value } 
                                        })}
                                        placeholder="Describe the aroma..."
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-text-muted/70 uppercase tracking-widest mb-2">Palate / Taste</label>
                                      <textarea
                                        className="block w-full bg-main-bg border border-border-grey rounded-xl text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-sm px-4 py-2 placeholder-text-muted/30"
                                        rows={2}
                                        value={(editingRecipe[p.key as keyof Recipe] as any)?.palate || ''}
                                        onChange={(e) => setEditingRecipe({ 
                                          ...editingRecipe, 
                                          [p.key]: { ...(editingRecipe[p.key as keyof Recipe] as any || {}), palate: e.target.value } 
                                        })}
                                        placeholder="Describe the flavor profile..."
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-text-muted/70 uppercase tracking-widest mb-2">Finish</label>
                                      <textarea
                                        className="block w-full bg-main-bg border border-border-grey rounded-xl text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-sm px-4 py-2 placeholder-text-muted/30"
                                        rows={2}
                                        value={(editingRecipe[p.key as keyof Recipe] as any)?.finish || ''}
                                        onChange={(e) => setEditingRecipe({ 
                                          ...editingRecipe, 
                                          [p.key]: { ...(editingRecipe[p.key as keyof Recipe] as any || {}), finish: e.target.value } 
                                        })}
                                        placeholder="Describe the finish..."
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        <div className={mainTab !== 'batches' ? "mt-8 border-t border-border-grey pt-8" : ""}>
                          <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Step-by-Step Training Guide</h4>
                            <Button 
                              onClick={() => {
                                setEditingRecipe(prev => ({
                                  ...prev,
                                  trainingSteps: [...(prev.trainingSteps || []), { image: '', description: '' }]
                                }));
                              }}
                              variant="secondary"
                              className="border-border-grey text-text-navy hover:bg-card-bg rounded-xl"
                            >
                              <Plus className="h-4 w-4 mr-2" /> Add Step
                            </Button>
                          </div>
                          
                          <div className="space-y-6">
                            {(!editingRecipe.trainingSteps || editingRecipe.trainingSteps.length === 0) && (
                              <div className="text-center py-12 bg-card-bg rounded-2xl border border-dashed border-border-grey">
                                <Camera className="h-8 w-8 text-accent mx-auto mb-3 opacity-50" />
                                <p className="text-sm text-text-muted">
                                  No training steps added yet. Add steps with photos to create a training guide.
                                </p>
                              </div>
                            )}
                            
                            {editingRecipe.trainingSteps?.map((step, idx) => (
                              <div key={idx} className="bg-card-bg p-6 rounded-2xl border border-border-grey relative group hover:border-accent/30 transition-all">
                                <button
                                  onClick={() => {
                                    const newSteps = [...(editingRecipe.trainingSteps || [])];
                                    newSteps.splice(idx, 1);
                                    setEditingRecipe({ ...editingRecipe, trainingSteps: newSteps });
                                  }}
                                  className="absolute top-4 right-4 text-text-muted/50 hover:text-cta transition-colors z-10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                
                                <div className="flex flex-col sm:flex-row gap-6">
                                  <div className="w-full sm:w-1/3">
                                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Step {idx + 1} Image</label>
                                    <div className="h-40 sm:h-32 w-full rounded-xl border-2 border-dashed border-border-grey flex items-center justify-center relative overflow-hidden bg-main-bg hover:border-accent transition-colors group/upload">
                                      {step.image ? (
                                        <img src={step.image} alt={`Step ${idx + 1}`} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="text-center">
                                          <Camera className="h-8 w-8 text-accent mx-auto mb-2 opacity-50 group-hover/upload:opacity-100 transition-opacity" />
                                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Capture/Upload</span>
                                        </div>
                                      )}
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              const newSteps = [...(editingRecipe.trainingSteps || [])];
                                              newSteps[idx].image = reader.result as string;
                                              setEditingRecipe({ ...editingRecipe, trainingSteps: newSteps });
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="w-full sm:w-2/3">
                                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Instructions</label>
                                    <textarea
                                      className="block w-full bg-main-bg border-border-grey rounded-xl text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-sm px-4 py-2 placeholder-text-muted/30"
                                      rows={4}
                                      value={step.description}
                                      onChange={(e) => {
                                        const newSteps = [...(editingRecipe.trainingSteps || [])];
                                        newSteps[idx].description = e.target.value;
                                        setEditingRecipe({ ...editingRecipe, trainingSteps: newSteps });
                                      }}
                                      placeholder="Describe the step in detail..."
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'sustainability' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-success/10 p-3 rounded-2xl">
                              <Leaf className="h-6 w-6 text-success" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-text-navy uppercase tracking-widest">Sustainability Analysis</h3>
                              <p className="text-xs text-text-muted">Environmental impact and eco-friendly recommendations.</p>
                            </div>
                          </div>
                          <Button
                            onClick={handleAnalyzeSustainability}
                            disabled={isAnalyzingSustainability || !editingRecipe.ingredients?.length}
                            className="bg-success text-white hover:opacity-90 rounded-xl px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all shadow-md shadow-success/20"
                          >
                            {isAnalyzingSustainability ? (
                              <>
                                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI Analyze
                              </>
                            )}
                          </Button>
                        </div>

                        {editingRecipe.sustainabilityScore !== undefined ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-card-bg p-6 rounded-3xl border border-border-grey flex flex-col items-center justify-center text-center shadow-sm">
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Eco Score</span>
                              <div className="text-4xl font-black text-success mb-1">{editingRecipe.sustainabilityScore}</div>
                              <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">out of 100</div>
                              <div className="mt-4 w-full bg-main-bg rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-success h-full transition-all duration-1000" 
                                  style={{ width: `${editingRecipe.sustainabilityScore}%` }}
                                />
                              </div>
                            </div>

                            <div className="bg-card-bg p-6 rounded-3xl border border-border-grey flex flex-col items-center justify-center text-center shadow-sm">
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Carbon Footprint</span>
                              <div className={`text-3xl font-black mb-2 ${
                                editingRecipe.carbonFootprint === 'Low' ? 'text-success' : 
                                editingRecipe.carbonFootprint === 'Medium' ? 'text-warning' : 'text-error'
                              }`}>
                                {editingRecipe.carbonFootprint}
                              </div>
                              <p className="text-[10px] text-text-muted font-medium leading-tight">
                                Based on ingredient sourcing and production impact.
                              </p>
                            </div>

                            <div className="bg-card-bg p-6 rounded-3xl border border-border-grey shadow-sm md:col-span-1">
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 block">Eco-Friendly Tips</span>
                              <ul className="space-y-3">
                                {(editingRecipe.sustainabilityTips || []).map((tip, i) => (
                                  <li key={i} className="flex items-start gap-3 text-xs text-text-navy leading-relaxed">
                                    <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                                    {tip}
                                  </li>
                                ))}
                                {(!editingRecipe.sustainabilityTips || editingRecipe.sustainabilityTips.length === 0) && (
                                  <p className="text-xs text-text-muted italic">Run analysis to see tips.</p>
                                )}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-20 bg-card-bg rounded-3xl border-2 border-dashed border-border-grey">
                            <Leaf className="mx-auto h-16 w-16 text-border-grey mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-text-navy">No Sustainability Data</h3>
                            <p className="text-text-muted text-sm max-w-md mx-auto mt-2">
                              Click the "AI Analyze" button above to generate a sustainability score and eco-friendly tips for this recipe.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              <div className="bg-card-bg px-8 py-6 border-t border-border-grey flex flex-col sm:flex-row-reverse gap-3">
                <Button 
                  onClick={handleSave} 
                  variant="primary" 
                  className="w-full sm:w-auto bg-accent hover:opacity-90 text-white font-bold uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-md shadow-accent/20"
                >
                  Save Recipe
                </Button>
                <Button 
                  onClick={() => setIsModalOpen(false)} 
                  variant="secondary" 
                  className="w-full sm:w-auto bg-transparent border border-border-grey text-text-navy hover:bg-card-bg font-bold uppercase tracking-widest text-[10px] py-4 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Produce Batch Modal */}
      {producingBatch && (
        <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setProducingBatch(null)}></div>
            
            <div className="inline-block align-bottom bg-main-bg rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full border border-border-grey">
              <div className="bg-card-bg px-8 py-8">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl bg-accent/10 border border-accent/20">
                    <ChefHat className="h-7 w-7 text-accent" />
                  </div>
                  <div className="text-left w-full">
                    <h3 className="text-xl font-bold text-text-navy" id="modal-title">
                      Produce Batch
                    </h3>
                    <p className="text-sm text-text-muted mt-1">{producingBatch.name}</p>
                    
                    <div className="mt-8 space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">
                          Number of batches to produce
                        </label>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setProduceQuantity(Math.max(1, produceQuantity - 1))}
                            className="p-3 bg-card-bg border border-border-grey rounded-xl text-text-navy hover:bg-main-bg transition-all focus:ring-2 focus:ring-accent focus:outline-none"
                          >
                            <Minus className="h-5 w-5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={produceQuantity}
                            onChange={(e) => setProduceQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="block w-full bg-main-bg border border-border-grey rounded-xl text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent focus:outline-none text-center font-bold text-lg py-3"
                          />
                          <button
                            type="button"
                            onClick={() => setProduceQuantity(produceQuantity + 1)}
                            className="p-3 bg-card-bg border border-border-grey rounded-xl text-text-navy hover:bg-main-bg transition-all focus:ring-2 focus:ring-accent focus:outline-none"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-accent/5 p-6 rounded-2xl border border-accent/20">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Total Yield</span>
                          <span className="text-lg font-bold text-text-navy">
                            {producingBatch.yieldAmount ? producingBatch.yieldAmount * produceQuantity : produceQuantity} {producingBatch.yieldUnit || 'unit(s)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-card-bg px-8 py-6 border-t border-border-grey flex flex-col sm:flex-row-reverse gap-3">
                <Button 
                  onClick={handleProduceBatch} 
                  variant="primary" 
                  className="w-full sm:w-auto bg-accent hover:opacity-90 text-white font-bold uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-lg shadow-accent/20"
                >
                  Produce & Update Inventory
                </Button>
                <Button 
                  onClick={() => setProducingBatch(null)} 
                  variant="secondary" 
                  className="w-full sm:w-auto bg-transparent border border-border-grey text-text-navy hover:bg-card-bg font-bold uppercase tracking-widest text-[10px] py-4 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
