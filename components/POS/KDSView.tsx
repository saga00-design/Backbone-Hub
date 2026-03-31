
import React, { useState, useMemo } from 'react';
import { POSOrder, POSOrderItem, OrderItemStatus, Station } from '../../types';
import { Clock, CheckCircle2, AlertCircle, ChefHat, Wine, Flame, Snowflake, IceCream, ChevronRight, Timer, History, Calendar, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db, doc, setDoc, handleFirestoreError, OperationType, cleanObject } from '../../firebase';

interface KDSViewProps {
  orders: POSOrder[];
}

export const KDSView: React.FC<KDSViewProps> = ({ orders }) => {
  const [activeStation, setActiveStation] = useState<Station | 'All'>('All');
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // Force re-render every minute to update timers live
  const [, setTick] = useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const stations: (Station | 'All')[] = ['All', 'Bar', 'Grill', 'Cold', 'Dessert'];

  const getStationIcon = (station: Station) => {
    switch (station) {
      case 'Bar': return <Wine className="w-5 h-5" />;
      case 'Grill': return <Flame className="w-5 h-5" />;
      case 'Cold': return <Snowflake className="w-5 h-5" />;
      case 'Dessert': return <IceCream className="w-5 h-5" />;
      default: return <ChefHat className="w-5 h-5" />;
    }
  };

  const activeTickets = useMemo(() => {
    return orders
      .filter(o => o.status === 'Open')
      .map(order => ({
        ...order,
        items: order.items.filter(item => 
          (activeStation === 'All' || item.station === activeStation) && 
          item.status !== 'Served' && 
          item.status !== 'Void'
        )
      }))
      .filter(order => order.items.length > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, activeStation]);

  const historyTickets = useMemo(() => {
    return orders
      .filter(o => {
        // Filter by date (YYYY-MM-DD)
        const orderDate = o.createdAt.split('T')[0];
        return orderDate === filterDate;
      })
      .map(order => ({
        ...order,
        items: order.items.filter(item => 
          (activeStation === 'All' || item.station === activeStation) && 
          item.status === 'Served'
        )
      }))
      .filter(order => order.items.length > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [orders, activeStation, filterDate]);

  const displayedTickets = viewMode === 'active' ? activeTickets : historyTickets;

  const updateItemStatus = async (orderId: string, itemId: string, newStatus: OrderItemStatus) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedItems = order.items.map(item => {
        if (item.id === itemId) {
          const now = new Date().toISOString();
          return { 
            ...item, 
            status: newStatus,
            readyAt: (newStatus === 'Ready' || (newStatus === 'Served' && !item.readyAt)) ? now : item.readyAt,
            servedAt: newStatus === 'Served' ? now : item.servedAt
          };
        }
        return item;
      });

      await setDoc(doc(db, `users/${userId}/posOrders/${orderId}`), cleanObject({
        items: updatedItems,
        updatedAt: new Date().toISOString()
      }), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'posOrders');
    }
  };

  const getTicketAge = (createdAt: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
    return diff;
  };

  const getAgeColor = (age: number) => {
    if (age > 15) return 'text-red-500';
    if (age > 8) return 'text-[#d4af37]';
    return 'text-[#666]';
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f] p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center space-x-8">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[#d9e2ec] tracking-tight">Kitchen Display</h1>
            <p className="text-[#666] mt-1 italic font-serif">Real-time Order Management</p>
          </div>

          <div className="flex bg-[#1a1a1a] p-1 rounded-2xl border border-[#2a2a2a]">
            <button
              onClick={() => setViewMode('active')}
              className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest ${viewMode === 'active' ? 'bg-[#486581] text-white shadow-lg shadow-[#486581]/20' : 'text-[#666] hover:text-[#d9e2ec]'}`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Active</span>
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest ${viewMode === 'history' ? 'bg-[#486581] text-white shadow-lg shadow-[#486581]/20' : 'text-[#666] hover:text-[#d9e2ec]'}`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
          </div>

          {viewMode === 'history' && (
            <div className="flex items-center space-x-3 bg-[#1a1a1a] px-4 py-2 rounded-2xl border border-[#2a2a2a]">
              <Calendar className="w-4 h-4 text-[#486581]" />
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-transparent text-[#d9e2ec] text-xs font-bold focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex space-x-4">
          {stations.map(station => (
            <button
              key={station}
              onClick={() => setActiveStation(station)}
              className={`flex items-center space-x-3 px-8 py-3 rounded-xl border transition-all text-xs uppercase tracking-widest font-bold ${activeStation === station ? 'bg-[#486581] border-[#486581] text-white shadow-lg shadow-[#486581]/20' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a]'}`}
            >
              {station !== 'All' && getStationIcon(station as Station)}
              <span>{station}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Tickets Grid */}
      <div className="flex-1 overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex space-x-8 h-full min-w-max">
          <AnimatePresence>
            {displayedTickets.map((order) => (
              <motion.div
                key={order.id}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-96 flex flex-col bg-[#1a1a1a] border border-[#2a2a2a] rounded-3xl overflow-hidden shadow-2xl"
              >
                {/* Ticket Header */}
                <div className={`p-6 border-b border-[#2a2a2a] flex items-center justify-between ${viewMode === 'active' && getTicketAge(order.createdAt) > 15 ? 'bg-red-900/30 border-red-900/50' : ''}`}>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-[#d9e2ec]">Table {order.tableNumber || 'T/A'}</h3>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#666] mt-1">Order #{order.id.slice(-4)}</p>
                  </div>
                  {viewMode === 'active' ? (
                    <div className={`flex items-center space-x-2 font-bold ${getAgeColor(getTicketAge(order.createdAt))}`}>
                      <Timer className="w-4 h-4" />
                      <span className="text-lg font-serif">{getTicketAge(order.createdAt)}m</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-[#666] font-bold">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-serif">{new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                {/* Ticket Items */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-[#2a2a2a]">
                  {order.items.map((item, idx) => (
                    <div key={`${order.id}-${item.id}-${idx}`} className="group relative">
                      <div className={`p-4 rounded-2xl border transition-all ${item.status === 'Served' ? 'bg-green-900/10 border-green-900/30 opacity-50' : item.status === 'Ready' ? 'bg-green-900/10 border-green-900/30' : 'bg-[#0f0f0f] border-[#2a2a2a]'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-lg font-serif font-bold text-[#486581]">{item.quantity}x</span>
                              <h4 className="text-sm font-bold text-[#d9e2ec]">{item.name}</h4>
                            </div>
                            
                            {item.modifiers.length > 0 && (
                              <ul className="mt-2 space-y-1 pl-8">
                                {item.modifiers.map(mod => (
                                  <li key={mod.id} className="text-[10px] uppercase tracking-widest font-bold text-[#666] flex items-center space-x-2">
                                    <ChevronRight className="w-3 h-3 text-[#486581]" />
                                    <span>{mod.name}</span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {item.notes && (
                              <div className="mt-2 pl-8 flex items-start space-x-2 text-[10px] italic text-[#d4af37]">
                                <AlertCircle className="w-3 h-3 mt-0.5" />
                                <span>{item.notes}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end space-y-2">
                            <span className="text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 bg-[#1a1a1a] text-[#666] rounded-full">
                              {item.station}
                            </span>
                            <span className="text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 bg-[#486581]/10 text-[#486581] rounded-full">
                              {item.course}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex space-x-2">
                          {item.status !== 'Served' && item.status !== 'Void' && (
                            <button 
                              onDoubleClick={() => updateItemStatus(order.id, item.id, 'Served')}
                              className="flex-1 py-6 bg-green-900/40 text-green-400 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-green-900/60 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                              title="Double click to complete"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Complete</span>
                            </button>
                          )}
                          {item.status === 'Served' && (
                            <div className="flex-1 py-2 bg-green-900/20 text-green-400/50 text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center justify-center space-x-2">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Served</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ticket Footer */}
                <div className="p-6 bg-[#141414] border-t border-[#2a2a2a] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${viewMode === 'active' ? 'bg-[#486581] animate-pulse' : 'bg-[#666]'}`}></div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#666]">{viewMode === 'active' ? 'Active' : 'Completed'}</span>
                  </div>
                  <button className="text-[10px] uppercase tracking-widest font-bold text-[#666] hover:text-[#d9e2ec]">
                    Print Ticket
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
