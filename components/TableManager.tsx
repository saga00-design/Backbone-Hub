import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Copy, 
  Filter, 
  CheckCircle, 
  XCircle,
  Users,
  Grid,
  MapPin,
  ChevronRight,
  MoreVertical,
  X,
  AlertTriangle
} from 'lucide-react';
import { Table } from '../types';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  handleFirestoreError, 
  OperationType, 
  cleanObject,
  LOCATION_ID 
} from '../firebase';
import { toast } from 'sonner';

interface TableManagerProps {
  tables: Table[];
  onTableClick?: (table: Table) => void;
}

const ZONES = [
  { id: 'main-room', name: 'Main Room' },
  { id: 'bar', name: 'Bar Area' },
  { id: 'terrace', name: 'Terrace' },
  { id: 'private', name: 'Private Room' }
];

export function TableManager({ tables, onTableClick }: TableManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    zoneId: 'main-room',
    seats: 2,
    active: true
  });

  const filteredTables = useMemo(() => {
    const seen = new Set<string>();
    return tables
      .filter(t => {
        if (!t.id || seen.has(t.id)) return false;
        seen.add(t.id);
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesZone = zoneFilter === 'all' || t.zoneId === zoneFilter;
        return matchesSearch && matchesZone;
      })
      .sort((a, b) => {
        // Sort by zoneId first, then by name
        if (a.zoneId < b.zoneId) return -1;
        if (a.zoneId > b.zoneId) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
  }, [tables, searchTerm, zoneFilter]);

  const handleOpenModal = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setFormData({
        name: table.name,
        zoneId: table.zoneId,
        seats: table.seats,
        active: table.active
      });
    } else {
      setEditingTable(null);
      setFormData({
        name: '',
        zoneId: 'main',
        seats: 2,
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Table name is required');
      return;
    }

    const id = editingTable?.id || `table-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const tableData: Partial<Table> = {
      id,
      name: formData.name,
      zoneId: formData.zoneId,
      seats: Number(formData.seats),
      active: formData.active,
      locationId: LOCATION_ID,
      status: editingTable?.status || 'available',
      lastUpdated: timestamp,
      // POS compatibility fields
      number: formData.name,
      capacity: Number(formData.seats),
      zone: ZONES.find(z => z.id === formData.zoneId)?.name || formData.zoneId,
    };

    if (!editingTable) {
      tableData.createdAt = timestamp;
    } else {
      tableData.createdAt = editingTable.createdAt;
    }

    try {
      await setDoc(doc(db, 'tables', id), cleanObject(tableData), { merge: true });
      toast.success(editingTable ? 'Table updated successfully' : 'Table created successfully');
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tables/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this table?')) {
      try {
        await deleteDoc(doc(db, 'tables', id));
        toast.success('Table deleted');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tables/${id}`);
      }
    }
  };

  const handleDuplicate = async (table: Table) => {
    const newId = `table-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const duplicatedData: Table = {
      ...table,
      id: newId,
      name: `${table.name} Copy`,
      number: `${table.name} Copy`,
      createdAt: timestamp,
      lastUpdated: timestamp,
      status: 'available'
    };

    try {
      await setDoc(doc(db, 'tables', newId), cleanObject(duplicatedData));
      toast.success('Table duplicated');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tables/${newId}`);
    }
  };

  const seedDefaultTables = async () => {
    const defaults = [
      { id: 't-1', name: 'T1', zoneId: 'main', seats: 2 },
      { id: 't-2', name: 'T2', zoneId: 'main', seats: 4 },
      { id: 't-3', name: 'T3', zoneId: 'bar', seats: 1 },
      { id: 't-4', name: 'T4', zoneId: 'terrace', seats: 4 },
    ];

    const timestamp = new Date().toISOString();
    
    try {
      const promises = defaults.map(d => {
        const table: Table = {
          ...d,
          active: true,
          locationId: LOCATION_ID,
          status: 'available',
          createdAt: timestamp,
          lastUpdated: timestamp,
          number: d.name,
          capacity: d.seats,
          zone: ZONES.find(z => z.id === d.zoneId)?.name || d.zoneId
        };
        return setDoc(doc(db, 'tables', d.id), cleanObject(table));
      });
      await Promise.all(promises);
      toast.success('Default tables seeded successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tables/seed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search tables by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card-bg border border-border-grey rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card-bg border border-border-grey rounded-xl px-3 py-2">
            <Filter className="h-4 w-4 text-text-muted" />
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="bg-transparent text-sm focus:outline-none"
            >
              <option value="all">All Zones</option>
              {ZONES.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={seedDefaultTables}
            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-navy transition-colors"
          >
            Seed Defaults
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Add Table
          </button>
        </div>
      </div>

      {/* Tables Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredTables.map((table, idx) => (
            <motion.div
              key={table.id || `table-idx-${idx}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => table.active && onTableClick?.(table)}
              className={`group bg-card-bg border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${!table.active ? 'opacity-75 border-dashed' : 'border-border-grey hover:border-accent/40'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-secondary-surface rounded-xl">
                  <Grid className="h-6 w-6 text-accent" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDuplicate(table)}
                    className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleOpenModal(table)}
                    className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(table.id)}
                    className="p-2 text-text-muted hover:text-cta hover:bg-cta/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <h3 className="text-lg font-bold text-text-navy flex items-center gap-2">
                  {table.name}
                  {!table.active && (
                    <span className="text-[10px] font-black uppercase tracking-tighter bg-border-grey px-1.5 py-0.5 rounded text-text-muted">
                      Inactive
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <MapPin className="h-3.5 w-3.5" />
                  {ZONES.find(z => z.id === table.zoneId)?.name || table.zoneId}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border-grey/50">
                <div className="flex items-center gap-2 text-sm font-medium text-text-navy">
                  <Users className="h-4 w-4 text-text-muted" />
                  {table.seats} Seats
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${table.status === 'available' ? 'bg-green-500' : 'bg-orange-500'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    {table.status}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredTables.length === 0 && (
          <div key="no-tables-message" className="col-span-full py-20 text-center">
            <Grid className="h-12 w-12 text-border-grey mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-navy">No tables found</h3>
            <p className="text-text-muted">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card-bg w-full max-w-md rounded-2xl shadow-2xl p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-text-navy">
                {editingTable ? 'Edit Table' : 'New Table'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-secondary-surface rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-1.5 ml-1">
                  Table Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Table 1, T10..."
                  className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-1.5 ml-1">
                    Zone
                  </label>
                  <select
                    value={formData.zoneId}
                    onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
                    className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {ZONES.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-1.5 ml-1">
                    Seats
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.seats}
                    onChange={(e) => setFormData({ ...formData, seats: parseInt(e.target.value) })}
                    className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-secondary-surface rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, active: !formData.active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.active ? 'bg-accent' : 'bg-border-grey'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.active ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-text-navy">Active Status</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                    {formData.active ? 'Table visible to POS staff' : 'Hidden from floor plan'}
                  </span>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-secondary-surface text-text-navy rounded-xl font-bold hover:bg-border-grey transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-accent text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-md"
                >
                  {editingTable ? 'Update Table' : 'Create Table'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
