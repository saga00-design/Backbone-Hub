
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Download, Upload, Trash2, Cloud, LogOut, User, Shield, Users, Building, Check, X, Plus, ChevronRight, ChevronDown, Clock, Package, Copy, Pencil, RefreshCw, AlertTriangle, ClipboardCheck, Settings as SettingsIcon } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { auth, db, collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, cleanObject, handleFirestoreError, OperationType, query, where } from '../firebase';
import { APP_SECTIONS, DEFAULT_ROLES, DEFAULT_DEPARTMENTS, DEFAULT_PERMISSIONS } from '../constants';
import { StaffMember, StaffSecret, AppPermissions, AuditLog } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { addDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';
import { performSystemResetAndRebuild } from '../utils/resetSystem';

interface RolePermissionsConfig {
  [roleId: string]: AppPermissions;
}

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'Admin' | 'Manager' | 'Waiter' | 'Chef' | 'Bartender';
  department?: string;
}

const LOCATION_ID = 'loc_camden';


interface SettingsProps {
  auditLogs?: AuditLog[];
}

export const Settings: React.FC<SettingsProps> = ({ auditLogs = [] }) => {
  const user = auth.currentUser;
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'inventory' | 'cloud' | 'system' | 'logs'>('profile');
  const [settings, setSettings] = useState({
    allowNegativeStock: false,
    autoUpdateFromInvoices: true,
    lowStockAlertThreshold: 20
  });
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsConfig>({});
  const [users, setUsers] = useState<UserData[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<any[]>(DEFAULT_DEPARTMENTS);
  const [userRole, setUserRole] = useState<string>('Waiter');
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<keyof AppPermissions>('inventory');
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [newDept, setNewDept] = useState({ name: '' });
  const [newStaff, setNewStaff] = useState<Partial<StaffMember> & Partial<StaffSecret>>({
    firstName: '',
    lastName: '',
    middleName: '',
    mobileNumber: '',
    email: '',
    role: 'Waiter',
    department: 'foh',
    permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS.Waiter)),
    allowedStations: [],
    trainingSummary: {
      level: 1,
      completedModules: 0,
      totalModules: 0,
      requiredOutstanding: 0,
      lastUpdated: null
    },
    certifications: [],
    pin: '',
    hourlyRate: 12.50,
    employmentType: 'Hourly',
    active: true,
    trainingAccessGranted: true,
  });

  const getRolePermissions = (role: string): AppPermissions => {
    return JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.Waiter));
  };

  // Backbone POS reads a SEPARATE, flat set of permission fields (canVoid,
  // canDiscount, canRefund, canManageFloor, canVoidItem, canApplyDiscount) -
  // different from Hub's own nested AppPermissions structure above. Hub used
  // to never set these at all, meaning any Hub-created staff member had them
  // all undefined/falsy in Firestore - the nav sidebar bug (case-sensitive role
  // matching) has already been fixed in POS's App.tsx, but that only restored
  // *navigation*; these specific feature flags (void/discount/refund/floor)
  // still needed to be set from Hub's side too. This mirrors POS's own
  // role->permission mapping (src/App.tsx / StaffManagement.tsx) exactly, so
  // both apps agree regardless of which one created the staff member.
  const getPosPermissionsForRole = (role: string) => {
    const r = (role || '').toLowerCase();
    return {
      canVoid: ['manager', 'admin', 'supervisor'].includes(r),
      canDiscount: ['manager', 'admin', 'supervisor'].includes(r),
      canRefund: ['manager', 'admin'].includes(r),
      canManageFloor: ['waiter', 'bartender', 'supervisor', 'manager', 'admin'].includes(r),
      canVoidItem: ['manager', 'admin', 'supervisor'].includes(r),
      canApplyDiscount: ['manager', 'admin', 'supervisor'].includes(r),
    };
  };

  const handleRoleChange = (role: StaffMember['role']) => {
    // Merge Hub's own nested permissions with POS's flat fields into the SAME
    // object - Firestore has no schema, and the key names don't collide, so
    // both apps can read the subset they each care about from one document.
    const permissions = { ...getRolePermissions(role), ...getPosPermissionsForRole(role) };
    setNewStaff(prev => ({
      ...prev,
      role,
      permissions
    }));
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  const handleAddStaff = async () => {
    if (!newStaff.firstName || !newStaff.lastName || !newStaff.role || !newStaff.pin || newStaff.pin.length !== 4 || !auth.currentUser) {
      toast.error('Required: Name, Role, and 4-digit PIN');
      return;
    }

    const staffIdTrimmed = (newStaff.staffId || '').trim();
    if (staffIdTrimmed && staffMembers.some(s => s.staffId === staffIdTrimmed && s.id !== editingStaffId)) {
      toast.error(`Staff ID "${staffIdTrimmed}" is already in use by another staff member.`);
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const completed = newStaff.trainingSummary?.completedModules || 0;
      const total = newStaff.trainingSummary?.totalModules || 0;

      // pin, hourlyRate, and annualSalary are NOT written to staffProfiles -
      // that collection is broadly readable (any authenticated user, for the
      // PIN-pad UI to show names) so those fields live in the separate
      // manager-only staffSecrets/{staffId} collection instead. See
      // types.ts's StaffSecret interface and firestore.rules.
      const staffPayload = {
        firstName: newStaff.firstName,
        lastName: newStaff.lastName,
        middleName: newStaff.middleName || '',
        mobileNumber: newStaff.mobileNumber || '',
        name: `${newStaff.firstName} ${newStaff.lastName}`.trim(),
        email: newStaff.email || '',
        staffId: staffIdTrimmed || undefined,
        role: newStaff.role,
        active: newStaff.active ?? true,
        locationId: LOCATION_ID,
        department: newStaff.department || 'foh',
        employmentType: newStaff.employmentType || 'Hourly',

        permissions: newStaff.permissions || {},
        allowedStations: newStaff.allowedStations || [],
        
        trainingSummary: {
          ...newStaff.trainingSummary,
          requiredOutstanding: Math.max(0, total - completed),
          lastUpdated: timestamp
        },

        certifications: newStaff.certifications || [],
        trainingAccessGranted: newStaff.trainingAccessGranted ?? true,
        lastUpdated: timestamp,
        ...(editingStaffId ? {} : { createdAt: timestamp })
      };

      const secretPayload = {
        pin: newStaff.pin,
        hourlyRate: newStaff.hourlyRate || 12.5,
        annualSalary: newStaff.employmentType === 'Salaried' ? (newStaff.annualSalary || 0) : undefined,
      };

      if (editingStaffId) {
        await updateDoc(doc(db, 'staffProfiles', editingStaffId), cleanObject(staffPayload));
        await setDoc(doc(db, 'staffSecrets', editingStaffId), cleanObject(secretPayload), { merge: true });
        toast.success('Staff member updated');
      } else {
        const newDocRef = doc(collection(db, 'staffProfiles'));
        await setDoc(newDocRef, cleanObject(staffPayload));
        await setDoc(doc(db, 'staffSecrets', newDocRef.id), cleanObject(secretPayload));
        toast.success('Staff member added');
      }

      // Reset form
      setIsAddingStaff(false);
      setEditingStaffId(null);
      setNewStaff({
        firstName: '',
        lastName: '',
        middleName: '',
        mobileNumber: '',
        email: '',
        role: 'Waiter',
        department: 'foh',
        permissions: { ...getRolePermissions('Waiter'), ...getPosPermissionsForRole('Waiter') },
        allowedStations: [],
        trainingSummary: {
          level: 1,
          completedModules: 0,
          totalModules: 0,
          requiredOutstanding: 0,
          lastUpdated: null
        },
        certifications: [],
        pin: '',
        hourlyRate: 12.5,
        employmentType: 'Hourly',
        active: true,
        trainingAccessGranted: true,
      });

  } catch (err) {
    console.error('Error saving staff:', err);
    toast.error('Failed to save staff member');
  }
};

  const handleEditStaff = async (staff: StaffMember) => {
    let permissions = JSON.parse(JSON.stringify(staff.permissions || {}));
    if (Array.isArray(permissions)) {
      permissions = getRolePermissions(staff.role);
    }
    // Backfill POS-specific fields (canVoid/canDiscount/canRefund/
    // canManageFloor/canVoidItem/canApplyDiscount) if any are missing -
    // self-heals staff records created before Hub knew about POS's
    // separate permission schema, the moment someone opens them to edit.
    if (permissions.canVoid === undefined || permissions.canManageFloor === undefined) {
      permissions = { ...getPosPermissionsForRole(staff.role), ...permissions };
    }

    // pin/hourlyRate/annualSalary live in the separate staffSecrets/{id}
    // doc now, not on the staffProfiles object passed in here - fetch it
    // so the edit form actually shows the existing PIN/pay instead of
    // silently blanking them out.
    let secretData: Partial<StaffSecret> = {};
    try {
      const secretSnap = await getDoc(doc(db, 'staffSecrets', staff.id));
      if (secretSnap.exists()) {
        secretData = secretSnap.data() as StaffSecret;
      }
    } catch (err) {
      console.error('Failed to load staff secret data:', err);
    }

    setNewStaff({
      ...staff,
      ...secretData,
      permissions,
      allowedStations: staff.allowedStations || [],
      trainingSummary: staff.trainingSummary || {
        level: 1,
        completedModules: 0,
        totalModules: 0,
        requiredOutstanding: 0,
        lastUpdated: null
      },
      certifications: staff.certifications || []
    });
    setEditingStaffId(staff.id);
    setIsAddingStaff(true);
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!user) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Staff Member',
      message: 'Are you sure you want to delete this staff member? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'staffProfiles', staffId));
          toast.success('Staff member deleted');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error("Error deleting staff:", err);
          toast.error('Failed to delete staff member');
        }
      }
    });
  };

  const handleCopyStaff = (staff: StaffMember) => {
    const { id, ...rest } = staff;
    setNewStaff({ ...rest, firstName: `${rest.firstName} (Copy)` });
    setEditingStaffId(null);
    setIsAddingStaff(true);
  };

  const handleAddDept = async () => {
    if (!newDept.name || !user) return;
    try {
      const userId = user.uid;
      const deptId = editingDeptId || `dept-${Date.now()}`;
      const updatedDepts = editingDeptId 
        ? departments.map(d => d.id === editingDeptId ? { ...d, name: newDept.name } : d)
        : [...departments.filter(d => d.id !== 'custom'), { id: deptId, name: newDept.name }];
      
      await setDoc(doc(db, `users/${userId}/settings`, 'departments'), { departments: updatedDepts });
      setIsAddingDept(false);
      setEditingDeptId(null);
      setNewDept({ name: '' });
      toast.success(editingDeptId ? 'Department updated' : 'Department added');
    } catch (err) {
      console.error("Error adding department:", err);
      toast.error('Failed to save department');
    }
  };

  const handleEditDept = (dept: any) => {
    setNewDept({ name: dept.name });
    setEditingDeptId(dept.id);
    setIsAddingDept(true);
  };

  const handleDeleteDept = async (deptId: string) => {
    if (!user) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Department',
      message: 'Are you sure you want to delete this department? This may affect staff assignments.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const updatedDepts = departments.filter(d => d.id !== deptId);
          await setDoc(doc(db, `users/${user.uid}/settings`, 'departments'), { departments: updatedDepts });
          toast.success('Department deleted');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error("Error deleting department:", err);
          toast.error('Failed to delete department');
        }
      }
    });
  };

  const handleCopyDept = async (dept: any) => {
    if (!user) return;
    try {
      const newDeptObj = { id: `dept-${Date.now()}`, name: `${dept.name} (Copy)` };
      const updatedDepts = [...departments, newDeptObj];
      await setDoc(doc(db, `users/${user.uid}/settings`, 'departments'), { departments: updatedDepts });
      toast.success('Department copied');
    } catch (err) {
      console.error("Error copying department:", err);
      toast.error('Failed to copy department');
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    try {
      const collections = ['inventory', 'recipes', 'suppliers', 'invoices', 'expenses', 'waste', 'posOrders'];
      const exportData: any = {};
      
      for (const col of collections) {
        const snapshot = await getDocs(collection(db, `users/${user.uid}/${col}`));
        exportData[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backbone-hub-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!user) return;
        
        for (const col in data) {
          for (const item of data[col]) {
            const { id, ...rest } = item;
            await setDoc(doc(db, `users/${user.uid}/${col}`, id), cleanObject(rest));
          }
        }
        toast.success('Data imported successfully');
      } catch (error) {
        console.error('Import failed:', error);
        toast.error('Failed to import data');
      }
    };
    reader.readAsText(file);
  };

  // Load permissions and users from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, `users/${user.uid}`), (snapshot: any) => {
      const data = snapshot.data();
      if (data?.role) {
        setUserRole(data.role);
      }
      if (data?.passcode) {
        setPasscode(data.passcode);
      }
    });

    const unsubPermissions = onSnapshot(doc(db, 'settings', `permissions_${LOCATION_ID}`), (docSnap) => {
      const data = docSnap.exists() ? docSnap.data() : { roles: {} };
      setRolePermissions({ ...DEFAULT_PERMISSIONS, ...(data.roles || {}) });
    });

    const unsubSettings = onSnapshot(doc(db, `users/${user.uid}/settings`, 'inventory'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as any);
      }
    });

    const unsubDepts = onSnapshot(doc(db, `users/${user.uid}/settings`, 'departments'), (docSnap) => {
      if (docSnap.exists()) {
        setDepartments(docSnap.data().departments);
      }
    });

    const unsubStaff = onSnapshot(query(collection(db, 'staffProfiles'), where('locationId', '==', LOCATION_ID)), (snapshot: any) => {
      const staffData = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as StaffMember));
      setStaffMembers(staffData);
    });

    return () => {
      unsubUser();
      unsubPermissions();
      unsubSettings();
      unsubDepts();
      unsubStaff();
    };
  }, [user]);

  useEffect(() => {
    if (!user || (userRole !== 'admin' && userRole !== 'backoffice' && userRole !== 'manager')) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData));
      setUsers(userData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubUsers();
  }, [user, userRole]);

  // Security Guard: Prevent non-admins from accessing sensitive tabs via state manipulation
  useEffect(() => {
    if (activeTab !== 'profile' && !loading && userRole !== 'admin' && userRole !== 'backoffice' && userRole !== 'manager' && userRole !== 'Admin' && userRole !== 'Manager') {
      setActiveTab('profile');
    }
  }, [activeTab, userRole, loading]);

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), cleanObject({ role: newRole }));
      toast.success('User role updated');
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error('Failed to update role');
    }
  };

  const updateUserDepartment = async (userId: string, newDept: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), cleanObject({ department: newDept }));
      toast.success('User department updated');
    } catch (error) {
      console.error("Error updating user department:", error);
      toast.error('Failed to update department');
    }
  };

  const MODULE_NAMES: Record<string, string> = {
    inventory: 'Inventory & Procurement',
    orders: 'POS & Stock Orders',
    recipes: 'Menu & Recipe Engineering',
    reports: 'Business Intelligence & Reports',
    staff: 'Staff, Training & Briefing',
    settings: 'System Configuration',
    stockCount: 'Stock Count',
    tables: 'Table Manager'
  };

  const togglePermission = async (roleId: string, module: keyof AppPermissions, action: string) => {
    const currentPerms = rolePermissions[roleId] || DEFAULT_PERMISSIONS[roleId];
    if (!currentPerms) return;

    const modulePerms = (currentPerms[module] as any) || (DEFAULT_PERMISSIONS[roleId]?.[module] as any) || {};
    const newPermissions = {
      ...rolePermissions,
      [roleId]: {
        ...currentPerms,
        [module]: {
          ...modulePerms,
          [action]: !modulePerms[action]
        }
      }
    };
    
    setRolePermissions(newPermissions);
    
    try {
      await setDoc(doc(db, 'settings', `permissions_${LOCATION_ID}`), cleanObject({
        roles: newPermissions,
        updatedAt: new Date().toISOString(),
        locationId: LOCATION_ID
      }));
      toast.success('Permissions updated');
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error('Failed to save permissions');
    }
  };
  
  const toggleInventorySetting = async (key: keyof typeof settings) => {
    if (!user) return;
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    try {
      await setDoc(doc(db, `users/${user.uid}/settings`, 'inventory'), cleanObject(newSettings));
    } catch (error) {
      console.error("Error saving inventory settings:", error);
    }
  };

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [passcode, setPasscode] = useState('');

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), cleanObject({ displayName, photoURL, passcode }));
      toast.success('Profile updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogout = () => {
    auth.signOut().then(() => {
      window.location.reload();
    });
  };

  const handleResetSystem = () => {
    if (!user) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'CRITICAL: System Reset & Rebuild',
      message: 'This will PERMANENTLY DELETE all inventory items, recipes, menu items, batches, and modifiers. The system will then be rebuilt with a fresh dataset. This operation cannot be undone. Are you absolutely sure?',
      variant: 'danger',
      onConfirm: async () => {
        await performSystemResetAndRebuild(user.uid);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Account, team, and system configuration"
      />

      {/* Tabs */}
      <div className="flex border-b border-border-grey">
        <button
          key="tab-profile"
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-navy hover:border-border-grey'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </div>
        </button>
        {(userRole === 'Admin' || userRole === 'Manager') && (
          <button
            key="tab-team"
            onClick={() => setActiveTab('team')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'team'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-navy hover:border-border-grey'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team & Access
            </div>
          </button>
        )}
        {(userRole === 'Admin' || userRole === 'Manager') && (
          <button
            key="tab-inventory"
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'inventory'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-navy hover:border-border-grey'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventory
            </div>
          </button>
        )}
        {(userRole === 'Admin' || userRole === 'Manager') && (
          <button
            key="tab-cloud"
            onClick={() => setActiveTab('cloud')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cloud'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-navy hover:border-border-grey'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Cloud Sync
            </div>
          </button>
        )}
        {(userRole === 'Admin' || userRole === 'Manager') && (
          <button
            key="tab-system"
            onClick={() => setActiveTab('system')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-navy hover:border-border-grey'
            }`}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              System
            </div>
          </button>
        )}
        {(userRole === 'Admin' || userRole === 'Manager') && (
          <button
            key="tab-logs"
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-navy hover:border-border-grey'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Audit Logs
            </div>
          </button>
        )}
      </div>

      {activeTab === 'profile' && (
        <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey">
          <h2 className="text-xl font-bold text-text-navy flex items-center mb-6 tracking-tight">
            <User className="mr-3 h-7 w-7 text-accent" />
            Account Profile
          </h2>
          <div className="space-y-6">
            <div className="flex items-center gap-6 p-6 bg-main-bg rounded-2xl border border-border-grey">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="h-20 w-20 rounded-full border-2 border-card-bg shadow-lg" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary-surface flex items-center justify-center text-accent font-bold text-2xl">
                  {displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-text-navy">{displayName || 'User'}</h3>
                <p className="text-sm text-text-muted">{user?.email}</p>
                <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-2">Role: {userRole}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Display Name</label>
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-card-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Photo URL</label>
                <input 
                  type="text"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full bg-card-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Passcode (4 digits)</label>
                <input 
                  type="password"
                  maxLength={4}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-card-bg border border-border-grey rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button onClick={handleLogout} variant="secondary" className="px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-border-grey text-text-navy hover:bg-main-bg">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
              <Button onClick={handleUpdateProfile} className="px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-accent text-white hover:opacity-90">
                <Check className="mr-2 h-4 w-4" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Roles & Permissions */}
          <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-xl font-bold text-text-navy flex items-center mb-1 tracking-tight">
                  <Shield className="mr-3 h-7 w-7 text-accent" />
                  Roles & Permissions
                </h2>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  Configure access levels for each module.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">
                  Select Module:
                </label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value as keyof AppPermissions)}
                  className="bg-main-bg border-2 border-border-grey rounded-xl px-4 py-2 text-xs font-bold text-text-navy focus:outline-none focus:border-accent transition-all min-w-[200px] cursor-pointer appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 12px center',
                    backgroundRepeat: 'no-repeat',
                    paddingRight: '40px'
                  }}
                >
                  {Object.keys(DEFAULT_PERMISSIONS.Admin).map((m) => (
                    <option key={m} value={m}>
                      {MODULE_NAMES[m] || m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border-grey">
              <table className="min-w-full divide-y divide-border-grey">
                <thead>
                  <tr className="bg-main-bg">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest min-w-[200px]">
                      Action in {MODULE_NAMES[selectedModule] || (selectedModule.charAt(0).toUpperCase() + selectedModule.slice(1))}
                    </th>
                    {DEFAULT_ROLES.filter(r => r.id !== 'Admin').map((role) => (
                      <th key={role.id} className="px-6 py-4 text-center text-[10px] font-bold text-text-muted uppercase tracking-widest">
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card-bg divide-y divide-border-grey">
                  {(() => {
                    const module = selectedModule;
                    const actions = Object.keys(DEFAULT_PERMISSIONS.Admin[module]);
                    
                    return (
                      <>
                        {actions.map((action) => (
                          <tr key={`${module}-${action}`} className="hover:bg-main-bg transition-colors">
                            <td className="px-8 py-3 whitespace-nowrap text-xs font-bold text-text-navy capitalize">
                              {action.replace(/([A-Z])/g, ' $1').trim()}
                            </td>
                            {DEFAULT_ROLES.filter(r => r.id !== 'Admin').map((role) => (
                              <td key={role.id} className="px-6 py-3 whitespace-nowrap text-center">
                                <button
                                  onClick={() => togglePermission(role.id, module, action)}
                                  className={`inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all ${
                                    ((rolePermissions[role.id] || DEFAULT_PERMISSIONS[role.id])?.[module] as any)?.[action]
                                      ? 'bg-success/10 text-success border border-success/20 shadow-sm'
                                      : 'bg-main-bg text-text-muted/20 border border-border-grey hover:bg-secondary-surface'
                                  }`}
                                >
                                  {((rolePermissions[role.id] || DEFAULT_PERMISSIONS[role.id])?.[module] as any)?.[action] ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-accent/5 rounded-xl border border-accent/20">
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-2">
                <Shield className="h-3 w-3" />
                Note: Admin role always has all permissions enabled.
              </p>
            </div>
          </div>

          {/* Departments */}
          <div className="bg-card-bg shadow-2xl rounded-2xl p-6 border border-border-grey">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-text-navy flex items-center tracking-tight">
                  <Building className="mr-2 h-5 w-5 text-accent" />
                  Departments
                </h2>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
                  Manage organization structure
                </p>
              </div>
              <Button 
                size="sm"
                onClick={() => {
                  setEditingDeptId(null);
                  setNewDept({ name: '' });
                  setIsAddingDept(true);
                }}
                className="bg-accent/10 text-accent hover:bg-accent hover:text-white border-none rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" />
                Add Dept
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {departments.map((dept: any) => (
                <div key={dept.id} className="flex items-center justify-between p-3 border border-border-grey rounded-xl bg-main-bg hover:bg-card-bg hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-primary-surface text-accent flex items-center justify-center shadow-sm">
                      <Building className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-text-navy truncate">{dept.name}</h3>
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 bg-card-bg/95 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleCopyDept(dept)}
                      className="p-1.5 text-text-muted hover:text-accent transition-colors"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleEditDept(dept)}
                      className="p-1.5 text-text-muted hover:text-accent transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDept(dept.id)}
                      className="p-1.5 text-text-muted hover:text-cta transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Department Modal */}
          <AnimatePresence>
            {isAddingDept && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-md bg-card-bg border border-border-grey rounded-3xl p-8 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-bold text-text-navy tracking-tight">
                      {editingDeptId ? 'Edit Department' : 'New Department'}
                    </h3>
                    <button onClick={() => setIsAddingDept(false)} className="text-text-muted hover:text-text-navy transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Department Name</label>
                      <input 
                        type="text"
                        value={newDept.name}
                        onChange={(e) => setNewDept({ name: e.target.value })}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        placeholder="e.g. Terrace, Basement Bar"
                      />
                    </div>

                    <button 
                      onClick={handleAddDept}
                      className="w-full py-4 bg-accent text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:opacity-90 transition-all mt-4"
                    >
                      {editingDeptId ? 'Update Department' : 'Create Department'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* User Management */}
          <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey">
            <h2 className="text-xl font-bold text-text-navy flex items-center mb-4 tracking-tight">
              <Users className="mr-3 h-7 w-7 text-accent" />
              User Management
            </h2>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-8">
              Assign roles to team members to control their access level.
            </p>

            <div className="space-y-4">
              {/* Root Users */}
              {users.map((u) => (
                <div key={`user-row-${u.uid}`} className="flex items-center justify-between p-5 border border-border-grey rounded-2xl bg-main-bg hover:bg-card-bg transition-all">
                  <div className="flex items-center gap-4">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt={u.displayName} className="h-12 w-12 rounded-full border border-border-grey shadow-sm" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary-surface text-accent flex items-center justify-center font-bold shadow-sm">
                        {u.displayName?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-text-navy">{u.displayName || 'User'}</h3>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={u.department || ''}
                      onChange={(e) => updateUserDepartment(u.uid, e.target.value)}
                      className="text-[10px] font-bold uppercase tracking-widest border-border-grey rounded-xl focus:ring-accent focus:border-accent bg-card-bg py-2 px-4 transition-all"
                    >
                      <option value="">No Dept</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                    <select
                      value={u.role || 'Waiter'}
                      onChange={(e) => updateUserRole(u.uid, e.target.value)}
                      className="text-[10px] font-bold uppercase tracking-widest border-border-grey rounded-xl focus:ring-accent focus:border-accent bg-card-bg py-2 px-4 transition-all"
                    >
                      {DEFAULT_ROLES.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {/* Local Staff Members */}
              {staffMembers.filter(s => s.active).map((s) => (
                <div key={`staff-row-${s.id}`} className="flex items-center justify-between p-5 border border-border-grey rounded-2xl bg-main-bg hover:bg-card-bg transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold shadow-sm">
                      {s.firstName?.charAt(0)}{s.lastName?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-text-navy">{s.firstName || s.lastName ? `${s.firstName} ${s.lastName}`.trim() : 'Unknown Staff'}</h3>
                      <p className="text-xs text-text-muted">
                        {s.email} • {s.role}
                        {userRole === 'Admin' && ` • PIN: ••••`}
                        {userRole === 'Admin' && s.staffId && ` • ID: ${s.staffId}`}
                        {s.department && ` • ${departments.find(d => d.id === s.department)?.name || s.department}`}
                      </p>
                    </div>
                  </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleCopyStaff(s)}
                        className="text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-accent"
                      >
                        Copy
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditStaff(s)}
                        className="text-[10px] font-bold uppercase tracking-widest text-accent"
                      >
                        Edit
                      </Button>
                      {userRole === 'Admin' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteStaff(s.id)}
                          className="text-[10px] font-bold uppercase tracking-widest text-cta"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                </div>
              ))}

              {users.length === 0 && staffMembers.length === 0 && (
                <div key="no-team-users" className="text-center py-12 text-text-muted bg-main-bg rounded-2xl border border-dashed border-border-grey">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No other users found. Invite your team to join Backbone Hub.</p>
                </div>
              )}
              <button 
                onClick={() => setIsAddingStaff(true)}
                className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-border-grey rounded-2xl text-text-muted hover:border-accent hover:text-accent transition-all group"
              >
                <Plus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Add Staff Member</span>
              </button>
            </div>
          </div>

          {/* Add Staff Modal */}
          <AnimatePresence>
            {isAddingStaff && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-2xl bg-card-bg border border-border-grey rounded-3xl p-8 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-bold text-text-navy tracking-tight">
                      {editingStaffId ? 'Edit Staff Member' : 'New Staff Member'}
                    </h3>
                    <button onClick={() => {
                      setIsAddingStaff(false);
                      setEditingStaffId(null);
                    }} className="text-text-muted hover:text-text-navy transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar overflow-x-hidden">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">First Name</label>
                        <input 
                          type="text"
                          value={newStaff.firstName}
                          onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })}
                          className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Middle Name</label>
                        <input 
                          type="text"
                          value={newStaff.middleName || ''}
                          onChange={(e) => setNewStaff({ ...newStaff, middleName: e.target.value })}
                          className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Last Name</label>
                        <input 
                          type="text"
                          value={newStaff.lastName}
                          onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
                          className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Email</label>
                        <input 
                          type="email"
                          value={newStaff.email}
                          onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                          className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Mobile Number</label>
                        <input 
                          type="tel"
                          value={newStaff.mobileNumber || ''}
                          onChange={(e) => setNewStaff({ ...newStaff, mobileNumber: e.target.value })}
                          className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Department</label>
                      <select 
                        value={newStaff.department}
                        onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none"
                      >
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Role</label>
                      <select 
                        value={newStaff.role}
                        onChange={(e) => handleRoleChange(e.target.value as any)}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none"
                      >
                        <option value="Waiter">Waiter</option>
                        <option value="Bartender">Bartender</option>
                        <option value="Chef">Chef</option>
                        <option value="Manager">Manager</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide mt-1.5 normal-case">
                        Role drives system access on both Hub and POS - Station Access has been removed as a separate setting since it was never actually used for anything.
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Employment Type</label>
                      <select
                        value={newStaff.employmentType || 'Hourly'}
                        onChange={(e) => setNewStaff({ ...newStaff, employmentType: e.target.value as 'Hourly' | 'Salaried' })}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none"
                      >
                        <option value="Hourly">Hourly</option>
                        <option value="Salaried">Salaried</option>
                      </select>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide mt-1.5 normal-case">
                        Hourly rate is now managed in TTP, not here. Salaried staff still clock in/out for hours tracking, but their pay comes from the Annual Salary below - their shifts are excluded from the automated Wages cost total.
                      </p>
                    </div>
                    {newStaff.employmentType === 'Salaried' && (
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Annual Salary (£)</label>
                        <input
                          type="number"
                          value={newStaff.annualSalary ?? ''}
                          onChange={(e) => setNewStaff({ ...newStaff, annualSalary: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        />
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide mt-1.5 normal-case">
                          Prorated per fiscal Period as Annual Salary ÷ 13.
                        </p>
                      </div>
                    )}

                    <div className="bg-main-bg/50 p-4 rounded-2xl border border-border-grey flex items-center justify-between">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">Grant Training Access</label>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide mt-1 normal-case">
                          Lets this staff member use the Training feature. Their actual progress is tracked separately once they start.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input
                          type="checkbox"
                          checked={newStaff.trainingAccessGranted ?? true}
                          onChange={(e) => setNewStaff({ ...newStaff, trainingAccessGranted: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-border-grey rounded-full peer peer-checked:bg-accent transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                      </label>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Staff ID + Security PIN</label>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide mb-2 normal-case">
                        This is the one 4-digit code this person uses everywhere - Hub, POS, and Labour Import matching. TTP assigns this when the employee is set up there - type in the same ID and PIN they already have, don't make up new ones here.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="e.g. 4821 (from TTP)"
                        value={newStaff.staffId || newStaff.pin || ''}
                        onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setNewStaff({ ...newStaff, staffId: v, pin: v }); }}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                      />
                    </div>

                    <button 
                      onClick={handleAddStaff}
                      className="w-full py-4 bg-accent text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:opacity-90 transition-all mt-4"
                    >
                      {editingStaffId ? 'Update Staff Member' : 'Create Staff Member'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey">
          <h2 className="text-xl font-bold text-text-navy flex items-center mb-6 tracking-tight">
            <Package className="mr-3 h-7 w-7 text-accent" />
            Inventory Settings
          </h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 bg-main-bg rounded-2xl border border-border-grey">
              <div>
                <h3 className="font-bold text-text-navy">Allow Negative Stock</h3>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Allow POS sales even if stock is 0. Items will show in red.</p>
              </div>
              <button 
                onClick={() => toggleInventorySetting('allowNegativeStock')}
                className={`w-14 h-7 rounded-full transition-all relative ${settings.allowNegativeStock ? 'bg-success' : 'bg-border-grey'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${settings.allowNegativeStock ? 'left-8' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between p-6 bg-main-bg rounded-2xl border border-border-grey">
              <div>
                <h3 className="font-bold text-text-navy">Auto-update from Invoices</h3>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Automatically update prices and catalogue new items when an invoice is approved. Stock levels are never touched here — only Receive Goods updates stock.</p>
              </div>
              <button 
                onClick={() => toggleInventorySetting('autoUpdateFromInvoices')}
                className={`w-14 h-7 rounded-full transition-all relative ${settings.autoUpdateFromInvoices ? 'bg-success' : 'bg-border-grey'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${settings.autoUpdateFromInvoices ? 'left-8' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cloud' && (
        <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey">
          <h2 className="text-xl font-bold text-text-navy flex items-center mb-4 tracking-tight">
            <Cloud className="mr-3 h-7 w-7 text-accent" />
            Cloud Data Management
          </h2>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-8">
            Your data is now securely stored in the cloud. This allows you to access your recipes and inventory from any device and prevents data loss from browser storage limits.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 border border-border-grey rounded-2xl bg-main-bg flex flex-col hover:bg-card-bg transition-colors">
              <h3 className="font-bold text-text-navy mb-2">Backup Cloud Data</h3>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-6 flex-1">Request a full export of your cloud-stored inventory, recipes, and history.</p>
              <Button onClick={handleExportData} variant="secondary" className="w-full px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-border-grey text-text-navy hover:bg-main-bg">
                <Download className="mr-2 h-4 w-4" /> Request Export
              </Button>
            </div>

            <div className="p-6 border border-cta/20 rounded-2xl bg-cta/5 flex flex-col">
              <h3 className="font-bold text-cta mb-2">System Status</h3>
              <p className="text-[10px] font-bold text-cta/70 uppercase tracking-widest mb-6 flex-1">Your account is currently active and syncing in real-time with our secure database.</p>
              <div className="flex items-center gap-3 text-success text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2.5 h-2.5 bg-success rounded-full animate-pulse shadow-[0_0_8px_rgba(168,198,108,0.5)]"></div>
                Connected & Synced
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey"
        >
          <h2 className="text-xl font-bold text-text-navy flex items-center mb-4 tracking-tight">
            <AlertTriangle className="mr-3 h-7 w-7 text-danger" />
            System Maintenance
          </h2>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-8">
            Critical operations for system management. These actions are destructive and should be used with extreme caution.
          </p>
          
          <div className="p-6 border border-danger/20 rounded-2xl bg-danger/5 flex flex-col">
            <h3 className="font-bold text-danger mb-2">Reset & Rebuild System</h3>
            <p className="text-[10px] font-bold text-danger/70 uppercase tracking-widest mb-6 flex-1">
              This will wipe all existing inventory, recipes, and menu data and rebuild them with a fresh, structured dataset. 
              Use this only if you want to start over with a clean slate.
            </p>
            <Button
              variant="danger"
              onClick={handleResetSystem}
              className="w-full px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-danger/20 text-danger hover:bg-danger/10"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Reset & Rebuild Now
            </Button>
          </div>
        </motion.div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-text-navy flex items-center tracking-tight">
                <ClipboardCheck className="mr-3 h-7 w-7 text-accent" />
                Audit Trail & Historical Records
              </h2>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                Real-time feed of all administrative actions and data modifications.
              </p>
            </div>
            <div className="flex gap-2">
               <span className="px-3 py-1 bg-success/10 text-success rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-success/20">
                 <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" /> Live Monitoring
               </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-grey">
            <table className="min-w-full divide-y divide-border-grey">
              <thead>
                <tr className="bg-main-bg">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Timestamp</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Action</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Target</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">Changes</th>
                </tr>
              </thead>
              <tbody className="bg-card-bg divide-y divide-border-grey">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-main-bg transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col text-[10px] font-medium text-text-muted">
                          <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                          <span className="text-accent font-bold tracking-widest">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-[10px]">
                            {log.userName?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-text-navy">{log.userName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border ${
                          log.action === 'CREATE' ? 'bg-success/5 text-success border-success/20' : 
                          log.action === 'UPDATE' ? 'bg-accent/5 text-accent border-accent/20' : 
                          'bg-cta/5 text-cta border-cta/20'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">{log.targetType}</span>
                          <span className="text-xs font-black text-text-navy">{log.targetName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 max-w-md overflow-hidden text-ellipsis">
                          {log.action === 'UPDATE' ? (
                            <span className="text-[10px] font-medium text-text-muted line-clamp-1">
                              Modified existing {log.targetType.toLowerCase()}
                            </span>
                          ) : log.action === 'CREATE' ? (
                            <span className="text-[10px] font-medium text-success">
                              Created new entry
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-cta">
                              Removed entry
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted italic text-sm">
                      No logs found. All future administrative actions will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        variant={confirmModal.variant}
      />
    </div>
  );
};
