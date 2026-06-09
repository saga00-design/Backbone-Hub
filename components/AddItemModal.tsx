
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { InventoryCategory, Unit, InventoryItem, Supplier, ALLERGIES_LIST, InventoryType } from '../types';
import { X, Upload, Image as ImageIcon, ScanBarcode, TrendingUp, Camera, Calculator, Check, ChevronDown, Info } from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";
import { toast } from 'sonner';
import { DEFAULT_DEPARTMENTS, DEFAULT_CATEGORIES } from '../constants';
import { convertToBaseUnit, formatDisplayValue, calculateTotalBaseQuantity, UNIT_TYPES, BASE_UNITS, CONVERSION_FACTORS, roundTo } from '../utils/unitConversions';
import { Combobox } from './Combobox';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: {
    name: string;
    category: InventoryCategory;
    subCategory?: string;
    department?: string;
    quantity: number; // total base quantity
    unit: Unit; // display unit
    unitSize: number; // pack size
    packaging?: string;
    inventoryType: InventoryType;
    baseUnit: Unit;
    minStockLevel: number;
    pricePerUnit: number; // cost per base unit
    isActive: boolean;
    retailPrice?: number;
    imageUrl?: string;
    supplier?: string;
    supplierContact?: string;
    expiryDate?: string;
    totalOwned?: number;
    brokenQuantity?: number;
    barcode?: string;
    dailyUsageRate?: number;
    allergies?: string[];
    vatCode?: string;
    vatRate?: number;
    yieldFactor?: number;
    storageLocation?: string;
  }) => void;
  itemToEdit?: InventoryItem;
  suppliers?: Supplier[];
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSave, itemToEdit, suppliers = [] }) => {
  const [inventoryType, setInventoryType] = useState<InventoryType>('SOLID');
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('Ingredient');
  const [subCategory, setSubCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit>('kg');
  const [unitSize, setUnitSize] = useState('1');
  const [packaging, setPackaging] = useState<string>('box');
  const [price, setPrice] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [minStock, setMinStock] = useState('');
  const [supplier, setSupplier] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [dailyUsageRate, setDailyUsageRate] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);
  
  // New fields
  const [totalOwned, setTotalOwned] = useState('');
  const [brokenQuantity, setBrokenQuantity] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [targetMargin, setTargetMargin] = useState('80');
  const [vatCode, setVatCode] = useState('STANDARD_20');
  const [vatRate, setVatRate] = useState('20');
  const [yieldFactor, setYieldFactor] = useState('1');
  const [storageLocation, setStorageLocation] = useState('');
  const [showRetailCalculator, setShowRetailCalculator] = useState(false);
  const [showUnitCalculator, setShowUnitCalculator] = useState(false);
  const [calcData, setCalcData] = useState({
    bulkQty: '',
    bulkUnit: 'kg' as Unit,
    totalCost: '',
    targetPackSize: '',
    targetPackUnit: 'g' as Unit,
  });
  const [availableCameras, setAvailableCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Auto-calculate retail price when calculator fields change
  useEffect(() => {
    if (showRetailCalculator) {
      const cogs = parseFloat(price) || 0;
      const margin = parseFloat(targetMargin) || 0;
      const vat = parseFloat(vatRate) || 0;
      
      if (margin < 100 && margin >= 0) {
        const exclVat = cogs / (1 - margin / 100);
        const inclVat = exclVat * (1 + vat / 100);
        setRetailPrice(inclVat.toFixed(2));
      }
    }
  }, [price, targetMargin, vatRate, showRetailCalculator]);

  useEffect(() => {
    if (isOpen && !itemToEdit) {
      if (inventoryType === 'LIQUID') setUnit('bottles');
      else if (inventoryType === 'SOLID') setUnit('bags');
      else if (inventoryType === 'UNIT') setUnit('pcs');
    }
  }, [inventoryType, isOpen, itemToEdit]);

  useEffect(() => {
    if (isOpen && itemToEdit) {
      setName(itemToEdit.name);
      setBarcode(itemToEdit.barcode || '');
      setCategory(itemToEdit.category);
      setSubCategory(itemToEdit.subCategory || '');
      setDepartment(itemToEdit.department || '');
      setInventoryType(itemToEdit.inventoryType || 'SOLID');
      
      // For editing, we show the quantity in the unit it was saved in
      const baseQtyPerPack = convertToBaseUnit(itemToEdit.unitSize || 1, itemToEdit.unit || 'pcs');
      const qtyPacks = itemToEdit.quantity / (baseQtyPerPack || 1);
      
      setQuantity(qtyPacks.toString());
      setUnit(itemToEdit.unit || 'pcs');
      setUnitSize(itemToEdit.unitSize?.toString() || '1');
      setPackaging(itemToEdit.packaging || 'box');
      
      // Price per display unit
      const factor = convertToBaseUnit(1, itemToEdit.unit || 'pcs');
      const pricePerDisplayUnit = itemToEdit.pricePerUnit * factor;
      setPrice(pricePerDisplayUnit.toFixed(4));
      
      setTotalCost((itemToEdit.quantity * itemToEdit.pricePerUnit).toFixed(2));
      setMinStock(itemToEdit.minStockLevel.toString());
      setSupplier(itemToEdit.supplier || '');
      setSupplierContact(itemToEdit.supplierContact || '');
      setExpiryDate(itemToEdit.expiryDate || '');
      setDailyUsageRate(itemToEdit.dailyUsageRate?.toString() || '');
      setImagePreview(itemToEdit.imageUrl || null);
      setTotalOwned(itemToEdit.totalOwned?.toString() || '');
      setBrokenQuantity(itemToEdit.brokenQuantity?.toString() || '');
      setRetailPrice(itemToEdit.retailPrice?.toString() || '');
      setVatCode(itemToEdit.vatCode || 'STANDARD_20');
      setVatRate(itemToEdit.vatRate?.toString() || '20');
      setYieldFactor(itemToEdit.yieldFactor?.toString() || '1');
      setStorageLocation(itemToEdit.storageLocation || '');
      setAllergies(itemToEdit.allergies || []);
    } else if (isOpen && !itemToEdit) {
      // Reset form for new item
      setName('');
      setBarcode('');
      setCategory('Ingredient');
      setSubCategory('');
      setDepartment('Food');
      setQuantity('');
      setUnit('kg');
      setUnitSize('1');
      setPackaging('box');
      setPrice('');
      setTotalCost('');
      setMinStock('');
      setSupplier('');
      setSupplierContact('');
      setExpiryDate('');
      setDailyUsageRate('');
      setImagePreview(null);
      setTotalOwned('');
      setBrokenQuantity('');
      setRetailPrice('');
      setStorageLocation('');
      setAllergies([]);
    }
  }, [isOpen, itemToEdit]);

  // Scanner cleanup and init
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isScanning) {
        // Get available cameras first
        Html5Qrcode.getCameras().then(cameras => {
            if (cameras && cameras.length > 0) {
                setAvailableCameras(cameras);
                if (!selectedCameraId) setSelectedCameraId(cameras[0].id);
            }
        }).catch(err => {
            console.error("Error getting cameras", err);
        });

        // Short timeout to ensure DOM element exists
        const timer = setTimeout(() => {
            try {
                html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;
                
                const config = { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };
                
                const cameraConfig = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: "environment" };

                html5QrCode.start(
                    cameraConfig, 
                    config, 
                    (decodedText) => {
                        setBarcode(decodedText);
                        toast.success(`Scanned: ${decodedText}`);
                        stopScanner();
                    },
                    (errorMessage) => {
                        // ignore errors for each frame
                    }
                ).catch(err => {
                    console.error("Error starting scanner:", err);
                    setIsScanning(false);
                    toast.error("Could not start camera. Please ensure you have granted camera permissions.");
                });
            } catch (e) {
                console.error("Scanner initialization failed", e);
                setIsScanning(false);
            }
        }, 300); // Increased timeout for better reliability
        return () => {
            clearTimeout(timer);
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(console.error);
            }
        };
    }

    return () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(console.error);
        }
    };
  }, [isScanning, selectedCameraId]);

  const stopScanner = () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
              setIsScanning(false);
          }).catch(err => {
              console.error("Failed to stop scanner", err);
              setIsScanning(false);
          });
      } else {
          setIsScanning(false);
      }
  };

  if (!isOpen) return null;

  const isTrackingItem = ['Crockery', 'Utensil', 'Equipment'].includes(category);

  const calculateCalcResults = () => {
    const bulkQty = parseFloat(calcData.bulkQty) || 0;
    const bulkFactor = convertToBaseUnit(1, calcData.bulkUnit);
    const totalBaseQty = bulkQty * bulkFactor;
    const totalCost = parseFloat(calcData.totalCost) || 0;
    
    const targetPackSize = parseFloat(calcData.targetPackSize) || 1;
    const targetPackFactor = convertToBaseUnit(1, calcData.targetPackUnit);
    const targetBaseSize = targetPackSize * targetPackFactor;
    
    const pricePerBase = totalBaseQty > 0 ? totalCost / totalBaseQty : 0;
    const pricePerPack = pricePerBase * targetBaseSize;
    
    return {
      pricePerBase,
      pricePerPack,
      totalBaseQty
    };
  };

  const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Safety Check: Max File Size (original before compression)
      if (file.size > 5 * 1024 * 1024) { // 5MB limit for raw upload
        toast.error("File is too large. Please select an image smaller than 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const compressed = await compressImage(base64);
          // Safety Check: Compressed Size
          const compressedSize = (compressed.length * (3/4)) / 1024; // KB approx
          if (compressedSize > 800) {
            // If even after compression it's too big, compress more
            const veryCompressed = await compressImage(base64, 600, 600, 0.4);
            setImagePreview(veryCompressed);
          } else {
            setImagePreview(compressed);
          }
        } catch (err) {
          console.error("Compression failed:", err);
          toast.error("Failed to process image.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSupplier(val);
      // Try to autofill contact info if match found
      const match = suppliers.find(s => s.name === val);
      if (match) {
          if (match.contactName && !supplierContact) setSupplierContact(match.contactName);
          else if (match.email && !supplierContact) setSupplierContact(match.email);
          else if (match.phone && !supplierContact) setSupplierContact(match.phone);
      }
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const qty = parseFloat(val);
    const p = parseFloat(price);
    if (!isNaN(qty) && !isNaN(p)) {
      setTotalCost(roundTo(qty * p, 2).toString());
    }
  };

  const handleUnitSizeChange = (val: string) => {
    setUnitSize(val);
    // When unit size changes, we often want to re-calculate price if total cost is known
    const qty = parseFloat(quantity);
    const total = parseFloat(totalCost);
    if (!isNaN(qty) && !isNaN(total) && qty > 0) {
      setPrice(roundTo(total / qty, 4).toString());
    }
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const p = parseFloat(val);
    const qty = parseFloat(quantity);
    if (!isNaN(p) && !isNaN(qty)) {
      setTotalCost(roundTo(qty * p, 2).toString());
    }
  };

  const handleTotalCostChange = (val: string) => {
    setTotalCost(val);
    const total = parseFloat(val);
    const qty = parseFloat(quantity);
    if (!isNaN(total) && !isNaN(qty) && qty !== 0) {
      setPrice(roundTo(total / qty, 4).toString());
    }
  };

  const handleUnitChange = (newUnit: Unit) => {
    const oldUnit = unit;
    
    if (unitSize) {
      const currentSize = parseFloat(unitSize);
      const currentPrice = parseFloat(price);
      
      const oldFactor = CONVERSION_FACTORS[oldUnit] || 1;
      const newFactor = CONVERSION_FACTORS[newUnit] || 1;
      
      // Adjust unit size based on conversion factor
      // Example: 1000g (old: g, factor 1) -> 1kg (new: kg, factor 1000)
      const newSize = roundTo(currentSize * (oldFactor / newFactor), 6);
      setUnitSize(newSize.toString());

      // Adjust price per unit too
      // If the physical item is the same, £ price stays same but scales with unit
      if (!isNaN(currentPrice)) {
        const newPrice = roundTo(currentPrice * (newFactor / oldFactor), 6);
        setPrice(newPrice.toString());
        
        const qty = parseFloat(quantity);
        if (!isNaN(qty)) {
          setTotalCost(roundTo(qty * newPrice, 2).toString());
        }
      }
      
      const isWeight = (u: Unit) => ['kg', 'g'].includes(u);
      const isVolume = (u: Unit) => ['L', 'ml'].includes(u);

      // Compatibility Check
      if ((isWeight(oldUnit) && isVolume(newUnit)) || (isVolume(oldUnit) && isWeight(newUnit))) {
        toast.warning("Estimate Conversion: Converting between weight and volume (1kg ≈ 1L).", { 
          description: "Verify actual product density for accuracy.",
          duration: 4000 
        });
      } else if (UNIT_TYPES[oldUnit] !== UNIT_TYPES[newUnit] && oldUnit !== 'pcs' && newUnit !== 'pcs' && oldUnit !== 'custom' && newUnit !== 'custom') {
        toast.error(`Incompatible Types: Converting ${oldUnit} to ${newUnit} is not recommended.`, { 
          position: 'top-center'
        });
      }
    }
    
    setUnit(newUnit);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qtyPacks = parseFloat(quantity) || 0;
    const sizePerPack = parseFloat(unitSize) || 1;
    const pricePerPack = parseFloat(price) || 0;
    
    // Calculate base values
    // 1. Total quantity in base units (e.g. total grams)
    const baseQtyPerPack = convertToBaseUnit(sizePerPack, unit);
    const totalBaseQty = qtyPacks * baseQtyPerPack;
    
    // 2. Price per base unit (e.g. price per gram)
    // The price entered is "Price / {unit}", so we divide by the factor of that unit
    const unitFactor = convertToBaseUnit(1, unit);
    const pPerBaseUnit = unitFactor > 0 ? pricePerPack / unitFactor : 0;
    
    onSave({
      name,
      barcode: barcode || undefined,
      category,
      subCategory: subCategory || undefined,
      department,
      inventoryType,
      baseUnit: BASE_UNITS[inventoryType],
      quantity: totalBaseQty,
      unit,
      unitSize: baseQtyPerPack, // Save in base units (e.g. 1000g for 1kg)
      packaging,
      pricePerUnit: pPerBaseUnit,
      isActive: true,
      retailPrice: retailPrice ? parseFloat(retailPrice) : undefined,
      minStockLevel: parseFloat(minStock) || 0,
      imageUrl: imagePreview || undefined,
      supplier: supplier || undefined,
      supplierContact: supplierContact || undefined,
      expiryDate: expiryDate || undefined,
      totalOwned: totalOwned ? parseFloat(totalOwned) : undefined,
      brokenQuantity: brokenQuantity ? parseFloat(brokenQuantity) : undefined,
      dailyUsageRate: dailyUsageRate ? parseFloat(dailyUsageRate) : undefined,
      allergies: allergies.length > 0 ? allergies : undefined,
      vatCode,
      vatRate: parseFloat(vatRate) || 0,
      yieldFactor: parseFloat(yieldFactor) || 1,
      storageLocation: storageLocation || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-card-bg rounded-3xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-8 border border-border-grey">
          <div className="hidden sm:block absolute top-0 right-0 pt-6 pr-6">
            <button
              type="button"
              className="bg-secondary-surface rounded-xl p-2 text-text-muted hover:text-text-navy focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="sm:flex sm:items-start w-full">
            <div className="mt-3 text-center sm:mt-0 sm:ml-0 sm:text-left w-full">
              <h3 className="text-xl font-bold text-text-navy tracking-tight" id="modal-title">
                {itemToEdit ? 'Edit Inventory Item' : 'Add New Inventory Item'}
              </h3>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1 mb-6">Enter item details below</p>
              
              <div className="mt-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Image Upload - Compact Version */}
                  <div className="flex items-center space-x-6 mb-6 p-4 bg-secondary-surface rounded-2xl border border-border-grey">
                    <div 
                      className="h-20 w-20 rounded-xl border-2 border-dashed border-border-grey flex items-center justify-center cursor-pointer hover:border-accent hover:bg-accent/5 overflow-hidden relative flex-shrink-0 transition-all group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="h-8 w-8 text-text-muted group-hover:text-accent transition-colors" />
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageChange}
                      />
                    </div>
                    <div className="flex-1">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-accent uppercase tracking-widest hover:text-accent/80 transition-colors">
                        {itemToEdit ? 'Change photo' : 'Upload photo'}
                      </button>
                      <p className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest mt-1">PNG, JPG up to 5MB</p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="name" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Item Name</label>
                    <input
                      type="text"
                      id="name"
                      required
                      className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter item name"
                    />
                  </div>

                  <div>
                    <label htmlFor="barcode" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Barcode / SKU (Optional)</label>
                    <div className="mt-1.5 relative rounded-xl shadow-sm">
                        <button
                          type="button"
                          onClick={() => setIsScanning(true)}
                          className="absolute inset-y-0 left-0 pl-4 flex items-center cursor-pointer text-text-muted hover:text-accent z-10 transition-colors"
                          title="Click to scan barcode"
                        >
                            <ScanBarcode className="h-5 w-5" />
                        </button>
                        <input
                        type="text"
                        id="barcode"
                        className="bg-secondary-surface border-border-grey text-text-navy focus:ring-2 focus:ring-accent focus:border-transparent block w-full pl-12 sm:text-sm rounded-xl py-3 px-4 border transition-all placeholder-text-muted/50"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="Scan or enter barcode"
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <Combobox
                      id="inventoryType"
                      label="Inventory Type"
                      required
                      value={inventoryType}
                      onChange={(newType) => {
                        setInventoryType(newType);
                        if (newType === 'SOLID') setUnit('g');
                        else if (newType === 'LIQUID') setUnit('ml');
                        else if (newType === 'UNIT') setUnit('pcs');
                      }}
                      options={[
                        { value: 'SOLID', label: 'SOLID', description: 'Solid (g, kg)' },
                        { value: 'LIQUID', label: 'LIQUID', description: 'Liquid (ml, L)' },
                        { value: 'UNIT', label: 'UNIT', description: 'Unit (pcs, box)' },
                        { value: 'GAS', label: 'GAS', description: 'Gas (CO2, Nitrogen)' },
                        { value: 'SERVICE', label: 'SERVICE', description: 'Service/Labour' },
                        { value: 'CUSTOM', label: 'CUSTOM', description: 'Any other type' },
                      ]}
                    />
                    <div className="flex flex-col">
                      <label htmlFor="department" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">Department</label>
                      <div className="relative">
                        <select
                          id="department"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        >
                          {DEFAULT_DEPARTMENTS.filter(d => d.id !== 'custom').map(dept => (
                            <option key={dept.id} value={dept.name}>{dept.name}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <Combobox
                      id="category"
                      label="Category"
                      required
                      value={category}
                      onChange={(val) => setCategory(val as InventoryCategory)}
                      options={DEFAULT_CATEGORIES.map(cat => ({ value: cat }))}
                    />
                    <Combobox
                      id="subCategory"
                      label="Sub Category"
                      value={subCategory}
                      onChange={setSubCategory}
                      options={[
                        { value: 'Dairy' },
                        { value: 'Produce' },
                        { value: 'Meat' },
                        { value: 'Fish' },
                        { value: 'Dry Goods' },
                        { value: 'Spirits' },
                        { value: 'Wine' },
                        { value: 'Beer' },
                        { value: 'Soft Drinks' },
                        { value: 'Cleaning' },
                        { value: 'Equipment' },
                        { value: 'Crockery' },
                        { value: 'Utensils' },
                        { value: 'Packaging' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4 items-start">
                    <div className="flex flex-col">
                      <label htmlFor="quantity" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">
                        STOCK QTY
                      </label>
                      <input
                        type="number"
                        id="quantity"
                        required
                        min="0"
                        step="any"
                        className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50 h-[46px]"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        placeholder="e.g. 5"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="packaging" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">Packaging</label>
                      <div className="relative">
                        <select
                          id="packaging"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none h-[46px]"
                          value={packaging}
                          onChange={(e) => setPackaging(e.target.value)}
                        >
                          <option value="box">Box</option>
                          <option value="pack">Pack</option>
                          <option value="tray">Tray</option>
                          <option value="bag">Bag</option>
                          <option value="case">Case</option>
                          <option value="bottle">Bottle</option>
                          <option value="tin">Tin</option>
                          <option value="jar">Jar</option>
                          <option value="tub">Tub</option>
                          <option value="sachet">Sachet</option>
                          <option value="pcs">Pcs</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="unitSize" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">
                        Base Size
                      </label>
                      <input
                        type="number"
                        id="unitSize"
                        required
                        min="0"
                        step="any"
                        className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50 h-[46px]"
                        value={unitSize}
                        onChange={(e) => handleUnitSizeChange(e.target.value)}
                        placeholder="e.g. 700"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="unit" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">Base Unit</label>
                      <div className="relative">
                        <select
                          id="unit"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none h-[46px]"
                          value={unit}
                          onChange={(e) => handleUnitChange(e.target.value as Unit)}
                        >
                          <option value="kg">KG</option>
                          <option value="g">GR / G</option>
                          <option value="L">L</option>
                          <option value="ml">ML</option>
                          <option value="pcs">UNIT / PCS</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Special Fields for Crockery/Equipment */}
                  {isTrackingItem && (
                    <div className="bg-accent/5 p-4 rounded-2xl border border-accent/20 grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Asset Tracking</span>
                      </div>
                      <div>
                        <label htmlFor="totalOwned" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">Total Owned (Par)</label>
                        <input
                          type="number"
                          id="totalOwned"
                          min="0"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                          value={totalOwned}
                          onChange={(e) => setTotalOwned(e.target.value)}
                          placeholder="Max Qty"
                        />
                      </div>
                      <div>
                        <label htmlFor="brokenQuantity" className="text-[10px] font-bold text-error uppercase tracking-widest ml-1 mb-1.5">Broken / Missing</label>
                        <input
                          type="number"
                          id="brokenQuantity"
                          min="0"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                          value={brokenQuantity}
                          onChange={(e) => setBrokenQuantity(e.target.value)}
                          placeholder="Loss Count"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-6">
                     <div>
                      <label htmlFor="price" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">Price / {unit} (£)</label>
                      <input
                        type="number"
                        id="price"
                        required
                        min="0"
                        step="any"
                        className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={price}
                        onChange={(e) => handlePriceChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="totalCost" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">Total Cost (£)</label>
                      <input
                        type="number"
                        id="totalCost"
                        min="0"
                        step="0.01"
                        className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={totalCost}
                        onChange={(e) => handleTotalCostChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="retailPrice" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5">Retail Price (£)</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          id="retailPrice"
                          min="0"
                          step="0.01"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                          value={retailPrice}
                          onChange={(e) => setRetailPrice(e.target.value)}
                          placeholder="Optional"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRetailCalculator(!showRetailCalculator)}
                          className={`mt-1.5 p-3 rounded-xl border transition-all ${showRetailCalculator ? 'bg-accent border-accent text-white' : 'bg-secondary-surface border-border-grey text-text-muted hover:text-text-navy'}`}
                          title="Retail Price Calculator"
                        >
                          <Calculator className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Unit/Price Conversion Calculator */}
                  <div className="bg-secondary-surface rounded-2xl p-6 border border-border-grey">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-accent/10 rounded-lg mr-3">
                          <Calculator className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-navy uppercase tracking-tight">Unit/Price Conversion Calculator</h4>
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Calculate costs from bulk purchases</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-card-bg border-border-grey"
                        onClick={() => setShowUnitCalculator(!showUnitCalculator)}
                      >
                        {showUnitCalculator ? 'Hide' : 'Show'}
                      </Button>
                    </div>

                    {showUnitCalculator && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Bulk Qty</label>
                            <input
                              type="number"
                              className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full sm:text-sm rounded-xl p-3 border"
                              placeholder="e.g. 10"
                              value={calcData.bulkQty}
                              onChange={(e) => setCalcData({ ...calcData, bulkQty: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Bulk Unit</label>
                            <select
                              className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full sm:text-sm rounded-xl p-3 border"
                              value={calcData.bulkUnit}
                              onChange={(e) => setCalcData({ ...calcData, bulkUnit: e.target.value as Unit })}
                            >
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="L">L</option>
                              <option value="ml">ml</option>
                              <option value="pcs">pcs</option>
                              <option value="cases">cases</option>
                              <option value="packs">packs</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Total Cost (£)</label>
                            <input
                              type="number"
                              className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full sm:text-sm rounded-xl p-3 border"
                              placeholder="e.g. 50"
                              value={calcData.totalCost}
                              onChange={(e) => setCalcData({ ...calcData, totalCost: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Target Pack Size</label>
                            <input
                              type="number"
                              className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full sm:text-sm rounded-xl p-3 border"
                              placeholder="e.g. 500"
                              value={calcData.targetPackSize}
                              onChange={(e) => setCalcData({ ...calcData, targetPackSize: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Target Pack Unit</label>
                            <select
                              className="bg-card-bg border-border-grey text-text-navy focus:ring-accent focus:border-accent block w-full sm:text-sm rounded-xl p-3 border"
                              value={calcData.targetPackUnit}
                              onChange={(e) => setCalcData({ ...calcData, targetPackUnit: e.target.value as Unit })}
                            >
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                              <option value="pcs">pcs</option>
                            </select>
                          </div>
                        </div>

                        {/* Calculator Results */}
                        <div className="bg-primary-surface rounded-xl p-4 border border-accent/20">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Price per {calcData.targetPackUnit}</p>
                              <p className="text-sm font-bold text-text-navy">£{calculateCalcResults().pricePerBase.toFixed(4)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Price per {calcData.targetPackSize}{calcData.targetPackUnit} Pack</p>
                              <p className="text-sm font-bold text-text-navy">£{calculateCalcResults().pricePerPack.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Total Base Qty</p>
                              <p className="text-sm font-bold text-text-navy">{calculateCalcResults().totalBaseQty} {calcData.targetPackUnit}</p>
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                className="w-full bg-accent text-white text-[9px] font-bold uppercase tracking-widest py-2 rounded-lg"
                                onClick={() => {
                                  const results = calculateCalcResults();
                                  setPrice(results.pricePerPack.toFixed(4));
                                  setUnitSize(calcData.targetPackSize);
                                  toast.success('Calculator values applied to form');
                                }}
                              >
                                Apply to Form
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {showRetailCalculator && (
                    <div className="bg-secondary-surface p-6 rounded-2xl border border-border-grey space-y-4 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Retail Price Calculator</span>
                        <button type="button" onClick={() => setShowRetailCalculator(false)} className="text-text-muted hover:text-text-navy transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Target Margin (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            className="mt-1.5 block w-full bg-card-bg border-border-grey rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all"
                            value={targetMargin}
                            onChange={(e) => setTargetMargin(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">VAT Rate (%)</label>
                          <input
                            type="number"
                            min="0"
                            className="mt-1.5 block w-full bg-card-bg border-border-grey rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-border-grey">
                        <div className="w-full">
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Suggested Price (Incl. VAT)</p>
                          <div className="flex items-baseline justify-between mt-1">
                            <p className="text-2xl font-black text-accent">
                              £{retailPrice || '0.00'}
                            </p>
                            <p className="text-[10px] font-bold text-text-muted/40 uppercase tracking-widest">
                              Auto-applied
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label htmlFor="vatCode" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">VAT Code</label>
                      <div className="relative mt-1.5">
                        <select
                          id="vatCode"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none pr-10"
                          value={vatCode}
                          onChange={(e) => {
                            setVatCode(e.target.value);
                            if (e.target.value === 'STANDARD_20') setVatRate('20');
                            else if (e.target.value === 'REDUCED_5') setVatRate('5');
                            else if (e.target.value === 'ZERO_0') setVatRate('0');
                            else if (e.target.value === 'EXEMPT') setVatRate('0');
                          }}
                        >
                          <option value="STANDARD_20">Standard (20%)</option>
                          <option value="REDUCED_5">Reduced (5%)</option>
                          <option value="ZERO_0">Zero Rated (0%)</option>
                          <option value="EXEMPT">Exempt (0%)</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="minStock" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Min Stock Alert</label>
                      <input
                        type="number"
                        id="minStock"
                        required
                        min="0"
                        step="any"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center px-1">
                        <label htmlFor="yieldFactor" className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Yield Factor</label>
                        <div title="Percentage of usable product (e.g. 0.8 for 80%)">
                            <Info className="h-3 w-3 text-text-muted cursor-help" />
                        </div>
                      </div>
                      <input
                        type="number"
                        id="yieldFactor"
                        min="0"
                        max="1"
                        step="0.01"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={yieldFactor}
                        onChange={(e) => setYieldFactor(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="storageLocation" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Storage Location</label>
                      <input
                        type="text"
                        id="storageLocation"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={storageLocation}
                        onChange={(e) => setStorageLocation(e.target.value)}
                        placeholder="e.g. Dry Store, Section A"
                      />
                    </div>
                    <div>
                        <div className="flex justify-between items-center px-1">
                            <label htmlFor="dailyUsageRate" className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Est. Daily Usage</label>
                            <TrendingUp className="h-3 w-3 text-accent" />
                        </div>
                        <input
                            type="number"
                            id="dailyUsageRate"
                            min="0"
                            step="0.01"
                            className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                            value={dailyUsageRate}
                            onChange={(e) => setDailyUsageRate(e.target.value)}
                            placeholder="e.g. 5"
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="expiry" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Expiry Date (Optional)</label>
                      <input
                        type="date"
                        id="expiry"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Supplier Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border-grey">
                    <div>
                        <label htmlFor="supplier" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Supplier Name</label>
                        <input
                            list="supplier-options"
                            type="text"
                            id="supplier"
                            className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                            value={supplier}
                            onChange={handleSupplierChange}
                            placeholder="Select or type..."
                        />
                        <datalist id="supplier-options">
                            {suppliers.map(s => (
                                <option key={s.id} value={s.name} />
                            ))}
                        </datalist>
                    </div>
                     <div>
                        <label htmlFor="supplierContact" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Supplier Contact</label>
                        <input
                        type="text"
                        id="supplierContact"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={supplierContact}
                        onChange={(e) => setSupplierContact(e.target.value)}
                        placeholder="e.g. bob@sysco.com, 555-0123"
                        />
                    </div>
                  </div>

                  {/* Allergies */}
                  {category === 'Ingredient' && (
                    <div className="pt-6 border-t border-border-grey">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-3 block">Allergens</label>
                      <div className="flex flex-wrap gap-2">
                        {ALLERGIES_LIST.map(allergy => (
                          <label key={allergy} className={`flex items-center px-3 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${allergies.includes(allergy) ? 'bg-orange-400/10 border-orange-400/20 text-orange-400' : 'bg-secondary-surface border-border-grey text-text-muted hover:bg-secondary-surface/80'}`}>
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                className="peer h-4 w-4 bg-secondary-surface border-border-grey text-orange-600 focus:ring-orange-500 rounded-lg transition-all"
                                checked={allergies.includes(allergy)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAllergies(prev => [...prev, allergy]);
                                  } else {
                                    setAllergies(prev => prev.filter(a => a !== allergy));
                                  }
                                }}
                              />
                              <Check className="absolute h-2.5 w-2.5 text-white left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                            <span className="ml-2">{allergy}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-8 sm:flex sm:flex-row-reverse gap-3">
                    <Button type="submit" variant="primary" className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                      {itemToEdit ? 'Save Changes' : 'Add Item'}
                    </Button>
                    <Button type="button" variant="secondary" className="mt-3 w-full sm:mt-0 sm:w-auto px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={onClose}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[60] bg-main-bg bg-opacity-95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
            <div className="text-white text-xl font-bold mb-6 flex items-center uppercase tracking-widest">
                <ScanBarcode className="mr-3 h-8 w-8 text-accent animate-pulse" /> Barcode Scanner
            </div>
            
            <div className="w-full max-w-md relative">
                <div id="reader" className="w-full aspect-square bg-card-bg rounded-3xl overflow-hidden border-4 border-accent shadow-2xl shadow-accent/20 relative"></div>
                
                {/* Scanner Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-accent/50 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-lg"></div>
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-accent/30 animate-scan"></div>
                    </div>
                </div>
            </div>

            <div className="mt-8 w-full max-w-xs space-y-4">
                {availableCameras.length > 1 && (
                    <select 
                        className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent appearance-none text-sm font-bold uppercase tracking-widest"
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                    >
                        {availableCameras.map(camera => (
                            <option key={camera.id} value={camera.id} className="bg-card-bg text-text-navy">{camera.label || `Camera ${camera.id}`}</option>
                        ))}
                    </select>
                )}
                
                <p className="text-text-muted text-xs text-center font-bold uppercase tracking-widest">Point camera at a barcode</p>
                
                <button 
                    type="button" 
                    onClick={stopScanner}
                    className="w-full py-4 bg-cta text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-cta/20 uppercase tracking-widest text-xs"
                >
                    Cancel Scanning
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
