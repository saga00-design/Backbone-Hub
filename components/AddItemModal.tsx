
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { InventoryCategory, Unit, InventoryItem, Supplier, ALLERGIES_LIST } from '../types';
import { X, Upload, Image as ImageIcon, ScanBarcode, TrendingUp, Camera, Calculator, Check, ChevronDown } from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";
import { toast } from 'sonner';
import { DEFAULT_DEPARTMENTS, DEFAULT_CATEGORIES } from '../constants';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: {
    name: string;
    category: InventoryCategory;
    subCategory?: string;
    department?: string;
    quantity: number;
    unit: Unit;
    minStockLevel: number;
    pricePerUnit: number;
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
  }) => void;
  itemToEdit?: InventoryItem;
  suppliers?: Supplier[];
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSave, itemToEdit, suppliers = [] }) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('Ingredient');
  const [subCategory, setSubCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit>('kg');
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
  const [showCalculator, setShowCalculator] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Auto-calculate retail price when calculator fields change
  useEffect(() => {
    if (showCalculator) {
      const cogs = parseFloat(price) || 0;
      const margin = parseFloat(targetMargin) || 0;
      const vat = parseFloat(vatRate) || 0;
      
      if (margin < 100 && margin >= 0) {
        const exclVat = cogs / (1 - margin / 100);
        const inclVat = exclVat * (1 + vat / 100);
        setRetailPrice(inclVat.toFixed(2));
      }
    }
  }, [price, targetMargin, vatRate, showCalculator]);

  useEffect(() => {
    if (isOpen && itemToEdit) {
      setName(itemToEdit.name);
      setBarcode(itemToEdit.barcode || '');
      setCategory(itemToEdit.category);
      setSubCategory(itemToEdit.subCategory || '');
      setDepartment(itemToEdit.department || '');
      setQuantity(itemToEdit.quantity.toString());
      setUnit(itemToEdit.unit);
      setPrice(itemToEdit.pricePerUnit.toString());
      const initialTotalCost = itemToEdit.quantity * itemToEdit.pricePerUnit;
      setTotalCost(initialTotalCost.toFixed(2));
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
      setAllergies(itemToEdit.allergies || []);
    } else if (isOpen && !itemToEdit) {
      // Reset form for new item
      setName('');
      setBarcode('');
      setCategory('Ingredient');
      setSubCategory('');
      setDepartment('Kitchen');
      setQuantity('');
      setUnit('kg');
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
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
      setTotalCost((qty * p).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const p = parseFloat(val);
    const qty = parseFloat(quantity);
    if (!isNaN(p) && !isNaN(qty)) {
      setTotalCost((qty * p).toFixed(2));
    }
  };

  const handleTotalCostChange = (val: string) => {
    setTotalCost(val);
    const total = parseFloat(val);
    const qty = parseFloat(quantity);
    if (!isNaN(total) && !isNaN(qty) && qty !== 0) {
      setPrice((total / qty).toFixed(4));
    }
  };

  const handleUnitChange = (newUnit: Unit) => {
    const oldUnit = unit;
    const currentQty = parseFloat(quantity);
    const currentPrice = parseFloat(price);
    
    if (!isNaN(currentQty) && currentQty !== 0) {
      let newQty = currentQty;
      let newPrice = currentPrice;
      
      const isWeight = (u: Unit) => ['kg', 'g'].includes(u);
      const isVolume = (u: Unit) => ['L', 'ml'].includes(u);

      // Weight conversions
      if (oldUnit === 'kg' && newUnit === 'g') {
        newQty = currentQty * 1000;
        if (!isNaN(currentPrice)) newPrice = currentPrice / 1000;
      }
      else if (oldUnit === 'g' && newUnit === 'kg') {
        newQty = currentQty / 1000;
        if (!isNaN(currentPrice)) newPrice = currentPrice * 1000;
      }
      
      // Volume conversions
      else if (oldUnit === 'L' && newUnit === 'ml') {
        newQty = currentQty * 1000;
        if (!isNaN(currentPrice)) newPrice = currentPrice / 1000;
      }
      else if (oldUnit === 'ml' && newUnit === 'L') {
        newQty = currentQty / 1000;
        if (!isNaN(currentPrice)) newPrice = currentPrice * 1000;
      }
      
      // Cross-category warnings
      if ((isWeight(oldUnit) && isVolume(newUnit)) || (isVolume(oldUnit) && isWeight(newUnit))) {
        toast.warning("Converting between weight and volume is an estimate (1kg ≈ 1L).", { duration: 3000 });
        if (oldUnit === 'kg' && newUnit === 'ml') {
            newQty = currentQty * 1000;
            if (!isNaN(currentPrice)) newPrice = currentPrice / 1000;
        } else if (oldUnit === 'ml' && newUnit === 'kg') {
            newQty = currentQty / 1000;
            if (!isNaN(currentPrice)) newPrice = currentPrice * 1000;
        } else if (oldUnit === 'L' && newUnit === 'g') {
            newQty = currentQty * 1000;
            if (!isNaN(currentPrice)) newPrice = currentPrice / 1000;
        } else if (oldUnit === 'g' && newUnit === 'L') {
            newQty = currentQty / 1000;
            if (!isNaN(currentPrice)) newPrice = currentPrice * 1000;
        }
      }
      
      if (newQty !== currentQty) {
        const roundedQty = Number(newQty.toFixed(4));
        const roundedPrice = Number(newPrice.toFixed(6));
        setQuantity(roundedQty.toString());
        setPrice(roundedPrice.toString());
        toast.info(`Converted: ${currentQty}${oldUnit} → ${roundedQty}${newUnit}`, {
          duration: 2000,
        });
      }
    }
    
    setUnit(newUnit);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      barcode: barcode || undefined,
      category,
      subCategory: subCategory || undefined,
      department,
      quantity: parseFloat(quantity) || 0,
      unit,
      pricePerUnit: parseFloat(price) || 0,
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
                    <div>
                      <label htmlFor="department" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Department</label>
                      <div className="relative mt-1.5">
                        <select
                          id="department"
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        >
                          <option value="">Select Department</option>
                          {DEFAULT_DEPARTMENTS.map(dept => (
                            <option key={dept.id} value={dept.name}>{dept.name}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="category" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Category</label>
                      <div className="relative mt-1.5">
                        <select
                          id="category"
                          required
                          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none"
                          value={category}
                          onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                        >
                          <option value="">Select Category</option>
                          {DEFAULT_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subCategory" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Sub Category</label>
                    <input
                      type="text"
                      id="subCategory"
                      className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      placeholder="e.g. Dairy, Plates, Knives"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="quantity" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                        {isTrackingItem ? 'Currently Available' : 'Quantity'}
                      </label>
                      <input
                        type="number"
                        id="quantity"
                        required
                        min="0"
                        step="any"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                      />
                    </div>
                     <div>
                        <label htmlFor="unit" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Unit</label>
                        <select
                            id="unit"
                            className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all appearance-none"
                            value={unit}
                            onChange={(e) => handleUnitChange(e.target.value as Unit)}
                        >
                            <option value="pcs">pcs</option>
                            <option value="box">box</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="ml">ml</option>
                            <option value="bottles">bottles</option>
                        </select>
                    </div>
                  </div>

                  {/* Special Fields for Crockery/Equipment */}
                  {isTrackingItem && (
                    <div className="bg-accent/5 p-4 rounded-2xl border border-accent/20 grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Asset Tracking</span>
                      </div>
                      <div>
                        <label htmlFor="totalOwned" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Total Owned (Par)</label>
                        <input
                          type="number"
                          id="totalOwned"
                          min="0"
                          className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                          value={totalOwned}
                          onChange={(e) => setTotalOwned(e.target.value)}
                          placeholder="Max Qty"
                        />
                      </div>
                      <div>
                        <label htmlFor="brokenQuantity" className="text-[10px] font-bold text-error uppercase tracking-widest ml-1">Broken / Missing</label>
                        <input
                          type="number"
                          id="brokenQuantity"
                          min="0"
                          className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                          value={brokenQuantity}
                          onChange={(e) => setBrokenQuantity(e.target.value)}
                          placeholder="Loss Count"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-6">
                     <div>
                      <label htmlFor="price" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Price / {unit} (£)</label>
                      <input
                        type="number"
                        id="price"
                        required
                        min="0"
                        step="any"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={price}
                        onChange={(e) => handlePriceChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="totalCost" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Total Cost (£)</label>
                      <input
                        type="number"
                        id="totalCost"
                        min="0"
                        step="0.01"
                        className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                        value={totalCost}
                        onChange={(e) => handleTotalCostChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="retailPrice" className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Retail Price (£)</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          id="retailPrice"
                          min="0"
                          step="0.01"
                          className="mt-1.5 block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
                          value={retailPrice}
                          onChange={(e) => setRetailPrice(e.target.value)}
                          placeholder="Optional"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCalculator(!showCalculator)}
                          className={`mt-1.5 p-3 rounded-xl border transition-all ${showCalculator ? 'bg-accent border-accent text-white' : 'bg-secondary-surface border-border-grey text-text-muted hover:text-text-navy'}`}
                          title="Price Calculator"
                        >
                          <Calculator className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {showCalculator && (
                    <div className="bg-secondary-surface p-6 rounded-2xl border border-border-grey space-y-4 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Retail Price Calculator</span>
                        <button type="button" onClick={() => setShowCalculator(false)} className="text-text-muted hover:text-text-navy transition-colors">
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

                  <div className="grid grid-cols-2 gap-6">
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
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
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
                        <p className="text-[10px] font-bold text-text-muted/40 uppercase tracking-widest mt-1.5 ml-1">Used for AI predictions</p>
                    </div>
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
