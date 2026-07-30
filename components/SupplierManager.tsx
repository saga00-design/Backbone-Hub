
import React, { useState } from 'react';
import { Supplier, InventoryItem, Invoice } from '../types';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { Plus, Trash2, Edit2, Phone, Mail, MapPin, Truck, Package, Search, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

import { ConfirmationModal } from './ConfirmationModal';

interface SupplierManagerProps {
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  invoices: Invoice[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => void;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({ 
  suppliers, 
  inventoryItems, 
  invoices,
  onSaveSupplier, 
  onDeleteSupplier,
  onUpdateInvoice
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier>>({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier({ ...supplier });
    } else {
      setEditingSupplier({
        name: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier.name) return;

    const supplierToSave: Supplier = {
      id: editingSupplier.id || Date.now().toString(),
      name: editingSupplier.name,
      contactName: editingSupplier.contactName,
      email: editingSupplier.email,
      phone: editingSupplier.phone,
      address: editingSupplier.address,
      notes: editingSupplier.notes
    };

    onSaveSupplier(supplierToSave);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ isOpen: true, id });
  };

  const executeDelete = () => {
    if (confirmDelete.id) {
      onDeleteSupplier(confirmDelete.id);
      setConfirmDelete({ isOpen: false, id: null });
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    (s.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    s.contactName?.toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Truck}
        title="Supplier Management"
        subtitle="Manage vendor contact details and view supplied items"
        actions={
          <>
            <div className="relative rounded-xl shadow-sm w-full sm:w-64 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-accent transition-colors" />
              </div>
              <input
                type="text"
                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full pl-11 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => handleOpenModal()} className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20">
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </>
        }
      />

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800">
            <Truck className="mx-auto h-16 w-16 text-gray-200 dark:text-slate-800" />
            <h3 className="mt-4 text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">No suppliers found</h3>
            <p className="mt-2 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Add your first vendor to get started.</p>
          </div>
        ) : (
          filteredSuppliers.map(supplier => {
            // Find items associated with this supplier name
            const suppliedItems = inventoryItems.filter(item => 
              item.supplier && item.supplier.toLowerCase() === (supplier.name || '').toLowerCase()
            );
            
            // Find invoices associated with this supplier
            const supplierInvoices = invoices.filter(inv => inv.supplierId === supplier.id);
            const unpaidCount = supplierInvoices.filter(inv => inv.paymentStatus === 'Unpaid').length;
            const totalSpend = supplierInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
            
            return (
              <div key={supplier.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-slate-800 flex flex-col group">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white truncate group-hover:text-accent transition-colors uppercase tracking-tight">{supplier.name}</h3>
                        {supplier.contactName && <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">{supplier.contactName}</p>}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                        {unpaidCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
                                {unpaidCount} Unpaid
                            </span>
                        )}
                        <button onClick={() => handleOpenModal(supplier)} className="text-gray-400 hover:text-accent transition-colors">
                            <Edit2 className="h-4 w-4" />
                        </button>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex-1 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                        <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Total Spend</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">£{totalSpend.toFixed(2)}</p>
                    </div>
                    <div className="flex-1 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                        <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Invoices</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{supplierInvoices.length}</p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    {supplier.email && (
                        <div className="flex items-center text-xs font-bold text-gray-600 dark:text-slate-300">
                            <Mail className="h-4 w-4 mr-3 text-accent" />
                            <a href={`mailto:${supplier.email}`} className="hover:text-accent truncate transition-colors">{supplier.email}</a>
                        </div>
                    )}
                    {supplier.phone && (
                        <div className="flex items-center text-xs font-bold text-gray-600 dark:text-slate-300">
                            <Phone className="h-4 w-4 mr-3 text-accent" />
                            <a href={`tel:${supplier.phone}`} className="hover:text-accent transition-colors">{supplier.phone}</a>
                        </div>
                    )}
                    {supplier.address && (
                        <div className="flex items-start text-xs font-bold text-gray-600 dark:text-slate-300">
                            <MapPin className="h-4 w-4 mr-3 text-accent mt-0.5" />
                            <span className="line-clamp-2 text-gray-500 dark:text-slate-400">{supplier.address}</span>
                        </div>
                    )}
                  </div>
                  
                  {supplierInvoices.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-gray-100 dark:border-slate-800">
                          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                              <FileText className="h-3 w-3 mr-2 text-accent" />
                              Invoice History
                          </p>
                          <div className="space-y-3 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                              {supplierInvoices.map(inv => (
                                  <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs">
                                      <div className="flex flex-col">
                                          <span className="font-black text-gray-900 dark:text-slate-200 uppercase tracking-tight">{inv.date}</span>
                                          <span className="text-gray-500 dark:text-slate-400 font-bold mt-0.5">£{inv.totalAmount.toFixed(2)}</span>
                                      </div>
                                      <button 
                                        onClick={() => onUpdateInvoice(inv.id, { paymentStatus: inv.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid' })}
                                        className={`flex items-center px-4 py-1.5 rounded-lg font-black uppercase tracking-widest text-[9px] transition-all ${
                                            inv.paymentStatus === 'Paid' 
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' 
                                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                                        }`}
                                      >
                                          {inv.paymentStatus === 'Paid' ? (
                                              <CheckCircle className="h-3 w-3 mr-1.5" />
                                          ) : (
                                              <Clock className="h-3 w-3 mr-1.5" />
                                          )}
                                          {inv.paymentStatus}
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
                  
                  {suppliedItems.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-gray-100 dark:border-slate-800">
                          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                              <Package className="h-3 w-3 mr-2 text-accent" />
                              Supplied Items ({suppliedItems.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                              {suppliedItems.slice(0, 3).map(item => (
                                  <span key={item.id} className="inline-flex items-center px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-300 border border-gray-100 dark:border-slate-700 shadow-sm">
                                      {item.name}
                                  </span>
                              ))}
                              {suppliedItems.length > 3 && (
                                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-100 dark:border-slate-700">
                                      +{suppliedItems.length - 3} more
                                  </span>
                              )}
                          </div>
                      </div>
                  )}
                  
                  {supplier.notes && (
                      <div className="mt-8 bg-accent/5 p-4 rounded-xl text-[10px] font-bold text-accent/80 border border-accent/10 italic">
                          "{supplier.notes}"
                      </div>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-slate-800/30 px-8 py-5 flex justify-end border-t border-gray-100 dark:border-slate-800">
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors flex items-center"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Supplier
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This will not delete the associated inventory items."
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
        variant="danger"
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-slate-900 rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <form onSubmit={handleSave}>
                <div className="bg-white dark:bg-slate-900 px-10 pt-10 pb-8">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-8 tracking-tight uppercase">
                    {editingSupplier.id ? 'Edit Supplier' : 'Add New Supplier'}
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Company Name</label>
                      <input
                        type="text"
                        required
                        className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full px-5 py-3.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600"
                        value={editingSupplier.name}
                        onChange={(e) => setEditingSupplier(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Fresh Produce Co."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Contact Person</label>
                      <input
                        type="text"
                        className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full px-5 py-3.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600"
                        value={editingSupplier.contactName || ''}
                        onChange={(e) => setEditingSupplier(prev => ({ ...prev, contactName: e.target.value }))}
                        placeholder="e.g. John Smith"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                        <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Email</label>
                        <input
                            type="email"
                            className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full px-5 py-3.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600"
                            value={editingSupplier.email || ''}
                            onChange={(e) => setEditingSupplier(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="orders@vendor.com"
                        />
                        </div>
                        <div>
                        <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Phone</label>
                        <input
                            type="tel"
                            className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full px-5 py-3.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600"
                            value={editingSupplier.phone || ''}
                            onChange={(e) => setEditingSupplier(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="+44 20 1234 5678"
                        />
                        </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Address</label>
                      <textarea
                        rows={2}
                        className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full px-5 py-3.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600 resize-none"
                        value={editingSupplier.address || ''}
                        onChange={(e) => setEditingSupplier(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="123 Market St, London..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Notes</label>
                      <textarea
                        rows={2}
                        className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white block w-full px-5 py-3.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder-gray-400 dark:placeholder-slate-600 resize-none"
                        value={editingSupplier.notes || ''}
                        onChange={(e) => setEditingSupplier(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Payment terms, delivery days, etc."
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 px-10 py-8 flex flex-col sm:flex-row-reverse gap-4 border-t border-gray-100 dark:border-slate-700">
                  <Button type="submit" className="w-full sm:w-auto px-10 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20">
                    Save Supplier
                  </Button>
                  <Button type="button" onClick={() => setIsModalOpen(false)} variant="secondary" className="w-full sm:w-auto px-10 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
