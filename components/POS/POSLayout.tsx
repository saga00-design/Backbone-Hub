
import React, { useState, useEffect } from 'react';
import { Table, POSOrder, StaffMember, Recipe, InventoryItem, MenuCategory } from '../../types';
import { FloorPlan } from './FloorPlan';
import { OrderEntry } from './OrderEntry';
import { KDSView } from './KDSView';
import { StaffTraining } from './StaffTraining';
import { MenuManagement } from './MenuManagement';
import { PasscodeEntry } from './PasscodeEntry';
import { LayoutGrid, Utensils, ClipboardList, GraduationCap, Settings, LogOut, User, Bell, BarChart3, Search } from 'lucide-react';
import { Reporting } from './Reporting';
import { auth, db, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, handleFirestoreError, OperationType, cleanObject } from '../../firebase';

interface POSLayoutProps {
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  menuCategories: MenuCategory[];
  onProcessSales: (deductions: { inventoryItemId: string; quantity: number }[], revenue: number) => void;
}

type Tab = 'floor' | 'order' | 'kds' | 'staff' | 'menu' | 'reporting';

export const POSLayout: React.FC<POSLayoutProps> = ({ recipes, inventoryItems, menuCategories, onProcessSales }) => {
  const [activeTab, setActiveTab] = useState<Tab>('floor');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [authenticatedStaff, setAuthenticatedStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    
    const unsubTables = onSnapshot(collection(db, `users/${userId}/tables`), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'tables'));

    const unsubOrders = onSnapshot(collection(db, `users/${userId}/posOrders`), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as POSOrder)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'posOrders'));

    const unsubStaff = onSnapshot(collection(db, `users/${userId}/staff`), (snapshot) => {
      const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));
      setStaff(staffList);
      if (!authenticatedStaff && staffList.length > 0) {
        setAuthenticatedStaff(staffList[0]);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'staff'));

    return () => {
      unsubTables();
      unsubOrders();
      unsubStaff();
    };
  }, []);

  // if (!authenticatedStaff) {
  //   return <PasscodeEntry staff={staff} onAuthenticate={setAuthenticatedStaff} />;
  // }

  const handleTableSelect = (table: Table) => {
    setSelectedTable(table);
    setActiveTab('order');
  };

  const handleAddTable = async (tableData: Omit<Table, 'id'>) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    try {
      await addDoc(collection(db, `users/${userId}/tables`), cleanObject(tableData));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tables');
    }
  };

  const handleUpdateTable = async (tableId: string, tableData: Partial<Table>) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    try {
      await setDoc(doc(db, `users/${userId}/tables`, tableId), cleanObject(tableData), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tables/${tableId}`);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    try {
      await deleteDoc(doc(db, `users/${userId}/tables`, tableId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tables/${tableId}`);
    }
  };

  const closeOrder = () => {
    setSelectedTable(null);
    setActiveTab('floor');
  };

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-200 bg-main-bg text-text-navy font-sans">
      {/* Sidebar Navigation */}
      <nav className="w-64 border-r flex flex-col transition-colors duration-200 bg-card-bg border-border-grey">
        <div className="p-6 flex items-center space-x-3 mb-4">
          <div className="p-2 bg-accent rounded-xl shadow-lg shadow-accent/20">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-text-navy">RestroBit</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-8 py-4 scrollbar-hide">
          {/* Main Menu */}
          <div className="space-y-1">
            <button 
              onClick={() => setActiveTab('reporting')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reporting' ? 'bg-accent/10 text-accent font-bold' : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm">Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab('order')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'order' ? 'bg-accent/10 text-accent font-bold' : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'}`}
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm">Pos</span>
            </button>
            <button 
              onClick={() => setActiveTab('floor')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'floor' ? 'bg-accent/10 text-accent font-bold' : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'}`}
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="text-sm">Table</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <Bell className="w-5 h-5" />
              <span className="text-sm">Reservations</span>
            </button>
          </div>

          {/* Offering Section */}
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-text-muted/50 mb-2">Offering</p>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <User className="w-5 h-5" />
              <span className="text-sm">Delivery Executive</span>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5" />
                <span className="text-sm">Payments</span>
              </div>
              <span className="px-2 py-0.5 bg-accent text-white text-[8px] font-bold rounded-full">New</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <User className="w-5 h-5" />
              <span className="text-sm">Customer</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm">Invoice</span>
            </button>
          </div>

          {/* Back Office Section */}
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-text-muted/50 mb-2">Back Office</p>
            <button 
              onClick={() => setActiveTab('kds')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'kds' ? 'bg-accent/10 text-accent font-bold' : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'}`}
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm">KDS View</span>
            </button>
            <button 
              onClick={() => setActiveTab('menu')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'menu' ? 'bg-accent/10 text-accent font-bold' : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'}`}
            >
              <Utensils className="w-5 h-5" />
              <span className="text-sm">Menu Management</span>
            </button>
            <button 
              onClick={() => setActiveTab('staff')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'staff' ? 'bg-accent/10 text-accent font-bold' : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'}`}
            >
              <GraduationCap className="w-5 h-5" />
              <span className="text-sm">Staff Training</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm">Testimonial</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <User className="w-5 h-5" />
              <span className="text-sm">User</span>
            </button>
            <button 
              onClick={() => setActiveTab('reporting')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reporting' ? 'bg-accent/10 text-accent font-bold' : 'text-text-muted hover:bg-secondary-surface hover:text-text-navy'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm">Reports</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-secondary-surface hover:text-text-navy transition-all">
              <Settings className="w-5 h-5" />
              <span className="text-sm">Setting</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-border-grey">
          <button 
            onClick={() => setAuthenticatedStaff(null)}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-text-muted hover:bg-error/10 hover:text-error transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-bold">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-card-bg border-b border-border-grey flex items-center justify-between px-8">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search (Ctrl+/)"
              className="w-full pl-12 pr-4 py-2.5 bg-secondary-surface border border-border-grey rounded-xl text-sm focus:outline-none focus:border-accent transition-all"
            />
          </div>

          <div className="flex items-center space-x-6">
            <button className="p-2 text-text-muted hover:text-accent transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 pl-6 border-l border-border-grey">
              <div className="text-right">
                <p className="text-sm font-bold text-text-navy">{authenticatedStaff ? `${authenticatedStaff.firstName} ${authenticatedStaff.lastName}` : 'User'}</p>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{authenticatedStaff?.role || 'Staff'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                {authenticatedStaff?.firstName?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden bg-main-bg">
          {activeTab === 'floor' && (
            <FloorPlan 
              tables={tables} 
              onTableSelect={handleTableSelect} 
              onAddTable={handleAddTable}
              onUpdateTable={handleUpdateTable}
              onDeleteTable={handleDeleteTable}
              userId={auth.currentUser?.uid || ''}
            />
          )}
          
          {activeTab === 'order' && (
            <OrderEntry 
              table={selectedTable || tables[0] || { id: 'temp', number: '1', capacity: 4, status: 'Available', x: 0, y: 0 }} 
              recipes={recipes}
              inventoryItems={inventoryItems}
              menuCategories={menuCategories}
              onClose={closeOrder}
              orders={orders}
              onProcessSales={onProcessSales}
              staff={staff}
            />
          )}

        {activeTab === 'kds' && (
          <KDSView orders={orders} />
        )}

        {activeTab === 'staff' && (
          <StaffTraining staff={staff} />
        )}
        
        {activeTab === 'menu' && (
          <MenuManagement menuCategories={menuCategories} userId={auth.currentUser?.uid || ''} />
        )}
        
        {activeTab === 'reporting' && (
          <Reporting orders={orders} inventoryItems={inventoryItems} />
        )}
        </main>
      </div>
    </div>
  );
};
