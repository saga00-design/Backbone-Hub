
import React, { useState } from 'react';
import { Table, TableStatus, TableShape } from '../../types';
import { Users, Clock, Plus, Minus, Move, Trash2, X, Square, Circle, RectangleHorizontal, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloorPlanProps {
  tables: Table[];
  onTableSelect: (table: Table) => void;
  onAddTable: (table: Omit<Table, 'id'>) => void;
  onUpdateTable: (tableId: string, tableData: Partial<Table>) => void;
  onDeleteTable: (tableId: string) => void;
  userId: string;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({ tables, onTableSelect, onAddTable, onUpdateTable, onDeleteTable, userId }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [resizingTable, setResizingTable] = useState<{ id: string, width: number, height: number } | null>(null);
  const [newTable, setNewTable] = useState<{
    number: string;
    capacity: number;
    shape: TableShape;
    width: number;
    height: number;
    zone?: string;
  }>({ 
    number: '', 
    capacity: 4, 
    shape: 'Square', 
    width: 1, 
    height: 1,
    zone: ''
  });

  const handleOpenAddModal = () => {
    setEditingTableId(null);
    setNewTable({ number: '', capacity: 4, shape: 'Square', width: 1, height: 1, zone: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (table: Table) => {
    setEditingTableId(table.id);
    setNewTable({
      number: table.number,
      capacity: table.capacity,
      shape: table.shape || 'Square',
      width: table.width || (table.capacity > 4 ? 2 : 1),
      height: table.height || (table.capacity > 4 ? 2 : 1),
      zone: table.zone || '',
    });
    setIsAddModalOpen(true);
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'Available': return 'bg-card-bg border-border-grey text-text-muted';
      case 'Seated': return 'bg-accent/10 border-accent text-accent';
      case 'Ordered': return 'bg-warning/10 border-warning text-warning';
      case 'Served': return 'bg-success/10 border-success text-success';
      case 'Paid': return 'bg-secondary-surface border-border-grey text-text-navy';
      default: return 'bg-card-bg border-border-grey text-text-muted';
    }
  };

  const getShapeStyles = (shape?: TableShape) => {
    switch (shape) {
      case 'Round': return 'rounded-full';
      case 'Booth': return 'rounded-xl border-l-8 border-l-accent';
      case 'Rectangle': return 'rounded-xl';
      case 'Square': return 'rounded-2xl';
      default: return 'rounded-2xl';
    }
  };

  return (
    <div className="h-full flex flex-col p-8 bg-main-bg">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold text-text-navy tracking-tight">Main Floor</h1>
          <p className="text-text-muted mt-1 font-medium">Tulum-inspired Dining Area</p>
        </div>
        
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center space-x-2 px-6 py-3 rounded-full border transition-all font-bold uppercase tracking-widest text-[10px] ${isEditMode ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-card-bg border-border-grey text-text-muted hover:text-text-navy hover:bg-secondary-surface'}`}
          >
            {isEditMode ? <Move className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isEditMode ? 'Save Layout' : 'Edit Layout'}</span>
          </button>

          {isEditMode && (
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center space-x-2 px-6 py-3 bg-cta border border-cta text-white rounded-full transition-all font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-cta/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Table</span>
            </button>
          )}
        </div>
      </header>

      {/* Floor Grid */}
      <div id="floor-plan-container" className="flex-1 relative bg-secondary-surface rounded-3xl border border-border-grey overflow-hidden shadow-inner">
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--color-text-muted) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        {/* Tables Container */}
        <div className="absolute inset-0 p-12">
          {tables.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-xl italic">No tables configured yet</p>
              <button 
                onClick={() => {
                  setIsEditMode(true);
                  setIsAddModalOpen(true);
                }}
                className="mt-6 px-8 py-3 bg-cta text-white rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-cta/20"
              >
                Add First Table
              </button>
            </div>
          ) : (
            tables.map((table) => (
              <motion.div
                key={table.id}
                drag={isEditMode}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (isEditMode) {
                    const container = document.getElementById('floor-plan-container');
                    const element = document.getElementById(`table-${table.id}`);
                    if (container && element) {
                      const rect = container.getBoundingClientRect();
                      const elRect = element.getBoundingClientRect();
                      
                      // Calculate position as percentage of container
                      const newX = ((elRect.left - rect.left) / rect.width) * 100;
                      const newY = ((elRect.top - rect.top) / rect.height) * 100;
                      
                      onUpdateTable(table.id, { 
                        x: Math.max(0, Math.min(95, newX)), 
                        y: Math.max(0, Math.min(95, newY)) 
                      });
                    }
                  }
                }}
                whileHover={isEditMode ? { cursor: 'move' } : { scale: 1.05 }}
                whileTap={isEditMode ? { cursor: 'grabbing', scale: 1.02 } : { scale: 0.95 }}
                onClick={() => !isEditMode && onTableSelect(table)}
                onDoubleClick={() => isEditMode && handleOpenEditModal(table)}
                className={`absolute flex flex-col items-center justify-center border-2 transition-all p-4 ${getStatusColor(table.status)} ${getShapeStyles(table.shape)} shadow-lg ${isEditMode ? 'cursor-move select-none' : 'cursor-pointer'}`}
                style={{
                  left: `${table.x}%`,
                  top: `${table.y}%`,
                  width: `${(resizingTable?.id === table.id ? resizingTable.width : (table.width || 1)) * 10}%`,
                  height: `${(resizingTable?.id === table.id ? resizingTable.height : (table.height || 1)) * 15}%`,
                  zIndex: isEditMode ? 50 : 10,
                }}
                id={`table-${table.id}`}
              >
                <span className="text-xl font-bold mb-1">{table.number}</span>
                <div className="flex items-center space-x-2 opacity-60">
                  <Users className="w-3 h-3" />
                  <span className="text-[8px] font-bold uppercase tracking-tighter">{table.capacity} PAX</span>
                </div>
                
                {table.status !== 'Available' && (
                  <div className="mt-2 flex items-center space-x-1 text-[8px] font-bold">
                    <Clock className="w-2 h-2" />
                    <span>24m</span>
                  </div>
                )}

                {isEditMode && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTable(table.id);
                      }}
                      className="absolute -top-2 -right-2 p-1.5 bg-cta text-white rounded-full shadow-lg z-10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    
                    {/* Resize Handle */}
                    <div 
                      className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startWidth = table.width || 1;
                        const startHeight = table.height || 1;

                        const onMouseMove = (moveEvent: MouseEvent) => {
                          const deltaX = moveEvent.clientX - startX;
                          const deltaY = moveEvent.clientY - startY;
                          
                          const container = document.getElementById('floor-plan-container');
                          if (container) {
                            const rect = container.getBoundingClientRect();
                            const newWidth = Math.max(0.5, startWidth + (deltaX / (rect.width * 0.1)));
                            const newHeight = Math.max(0.5, startHeight + (deltaY / (rect.height * 0.15)));
                            setResizingTable({ id: table.id, width: newWidth, height: newHeight });
                          }
                        };

                        const onMouseUp = (upEvent: MouseEvent) => {
                          window.removeEventListener('mousemove', onMouseMove);
                          window.removeEventListener('mouseup', onMouseUp);
                          
                          const deltaX = upEvent.clientX - startX;
                          const deltaY = upEvent.clientY - startY;
                          const container = document.getElementById('floor-plan-container');
                          if (container) {
                            const rect = container.getBoundingClientRect();
                            const newWidth = Number(Math.max(0.5, startWidth + (deltaX / (rect.width * 0.1))).toFixed(1));
                            const newHeight = Number(Math.max(0.5, startHeight + (deltaY / (rect.height * 0.15))).toFixed(1));
                            onUpdateTable(table.id, { width: newWidth, height: newHeight });
                          }
                          setResizingTable(null);
                        };

                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);
                      }}
                    >
                      <div className="w-2 h-2 bg-accent rounded-sm"></div>
                    </div>
                  </>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Add Table Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card-bg border border-border-grey rounded-[2rem] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-text-navy">{editingTableId ? 'Edit Table' : 'Add New Table'}</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="text-text-muted hover:text-text-navy">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">Zone</label>
                  <input 
                    type="text"
                    value={newTable.zone || ''}
                    onChange={(e) => setNewTable({ ...newTable, zone: e.target.value })}
                    className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:border-accent"
                    placeholder="e.g. Patio, Main, Bar"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">Table Number</label>
                  <input 
                    type="text"
                    value={newTable.number}
                    onChange={(e) => setNewTable({ ...newTable, number: e.target.value })}
                    className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:border-accent"
                    placeholder="e.g. 12, T1, VIP-1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">Shape</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'Square', icon: Square },
                      { id: 'Round', icon: Circle },
                      { id: 'Rectangle', icon: RectangleHorizontal },
                      { id: 'Booth', icon: Layout }
                    ].map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => setNewTable({ ...newTable, shape: shape.id as TableShape })}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${newTable.shape === shape.id ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-secondary-surface border-border-grey text-text-muted hover:text-text-navy'}`}
                      >
                        <shape.icon className="w-5 h-5 mb-1" />
                        <span className="text-[8px] font-bold uppercase tracking-tighter">{shape.id}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">Width (Grid)</label>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setNewTable({ ...newTable, width: Math.max(0.5, Number((newTable.width - 0.1).toFixed(1))) })}
                        className="p-2 bg-secondary-surface rounded-lg text-text-navy hover:bg-primary-surface transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-lg font-bold text-text-navy w-12 text-center">{newTable.width}</span>
                      <button 
                        onClick={() => setNewTable({ ...newTable, width: Math.min(6, Number((newTable.width + 0.1).toFixed(1))) })}
                        className="p-2 bg-secondary-surface rounded-lg text-text-navy hover:bg-primary-surface transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">Height (Grid)</label>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setNewTable({ ...newTable, height: Math.max(0.5, Number((newTable.height - 0.1).toFixed(1))) })}
                        className="p-2 bg-secondary-surface rounded-lg text-text-navy hover:bg-primary-surface transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-lg font-bold text-text-navy w-12 text-center">{newTable.height}</span>
                      <button 
                        onClick={() => setNewTable({ ...newTable, height: Math.min(6, Number((newTable.height + 0.1).toFixed(1))) })}
                        className="p-2 bg-secondary-surface rounded-lg text-text-navy hover:bg-primary-surface transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">Capacity (PAX)</label>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => setNewTable({ ...newTable, capacity: Math.max(1, newTable.capacity - 1) })}
                      className="p-3 bg-secondary-surface rounded-xl text-text-navy hover:bg-primary-surface transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-bold text-text-navy w-12 text-center">{newTable.capacity}</span>
                    <button 
                      onClick={() => setNewTable({ ...newTable, capacity: newTable.capacity + 1 })}
                      className="p-3 bg-secondary-surface rounded-xl text-text-navy hover:bg-primary-surface transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (newTable.number) {
                      if (editingTableId) {
                        onUpdateTable(editingTableId, {
                          number: newTable.number,
                          capacity: newTable.capacity,
                          shape: newTable.shape,
                          width: newTable.width,
                          height: newTable.height,
                          zone: newTable.zone,
                        });
                      } else {
                        onAddTable({
                          number: newTable.number,
                          capacity: newTable.capacity,
                          shape: newTable.shape,
                          width: newTable.width,
                          height: newTable.height,
                          zone: newTable.zone,
                          status: 'Available',
                          x: 10,
                          y: 10
                        });
                      }
                      setNewTable({ number: '', capacity: 4, shape: 'Square', width: 1, height: 1, zone: '' });
                      setIsAddModalOpen(false);
                      setEditingTableId(null);
                    }
                  }}
                  className="w-full py-4 bg-cta text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-xl shadow-cta/20 hover:opacity-90 transition-all"
                >
                  {editingTableId ? 'Update Table' : 'Create Table'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Stats */}
      <footer className="mt-8 flex items-center justify-between text-text-muted">
        <div className="flex space-x-12">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-1">Occupancy</p>
            <p className="text-2xl font-bold text-text-navy">64% <span className="text-sm text-text-muted">/ 82 PAX</span></p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-1">Avg. Turn Time</p>
            <p className="text-2xl font-bold text-text-navy">52m</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold mb-1">Active Waiters</p>
            <p className="text-sm font-medium text-text-navy">Carlos, Sofia, Marco</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
