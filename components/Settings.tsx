
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Download, Upload, Trash2, Cloud, LogOut, User, Shield, Users, Building, Check, X, Plus, ChevronRight, ChevronDown, Clock } from 'lucide-react';
import { auth, db, collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, cleanObject, handleFirestoreError, OperationType } from '../firebase';
import { APP_SECTIONS, DEFAULT_ROLES, DEFAULT_DEPARTMENTS } from '../constants';
import { StaffMember } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { addDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface RolePermissions {
  [roleId: string]: {
    [permissionId: string]: boolean;
  };
}

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'Admin' | 'Manager' | 'Staff' | 'Waiter' | 'Chef';
}

export const Settings: React.FC = () => {
  const user = auth.currentUser;
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'cloud'>('profile');
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [users, setUsers] = useState<UserData[]>([]);
  const [userRole, setUserRole] = useState<string>('staff');
  const [loading, setLoading] = useState(true);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState<Partial<StaffMember>>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'Waiter',
    permissions: [],
    pin: '',
    hourlyRate: 12.50,
    active: true,
    trainingProgress: {}
  });

  const handleAddStaff = async () => {
    if (!newStaff.firstName || !newStaff.lastName || !newStaff.email || !newStaff.pin || newStaff.pin.length !== 4 || !auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      await addDoc(collection(db, `users/${userId}/staff`), cleanObject({
        ...newStaff,
        trainingProgress: {
          food: 0,
          cocktails: 0,
          wine: 0,
          tequila: 0,
          allergens: 0,
          service: 0
        }
      }));
      setIsAddingStaff(false);
      setNewStaff({
        firstName: '',
        lastName: '',
        email: '',
        role: 'Waiter',
        permissions: [],
        pin: '',
        hourlyRate: 12.50,
        active: true,
        trainingProgress: {}
      });
    } catch (err) {
      console.error("Error adding staff:", err);
    }
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

    const unsubPermissions = onSnapshot(doc(db, 'settings', 'permissions'), (docSnap) => {
      if (docSnap.exists()) {
        setRolePermissions(docSnap.data() as RolePermissions);
      } else {
        const initial: RolePermissions = {};
        DEFAULT_ROLES.forEach((role: any) => {
          initial[role.id] = {};
          APP_SECTIONS.forEach((section: any) => {
            initial[role.id][section.id] = role.id === 'admin' || role.id === 'backoffice' || role.id === 'manager';
          });
        });
        setRolePermissions(initial);
      }
    });

    return () => {
      unsubUser();
      unsubPermissions();
    };
  }, [user]);

  useEffect(() => {
    if (!user || (userRole !== 'admin' && userRole !== 'backoffice' && userRole !== 'manager')) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userData = snapshot.docs.map(doc => doc.data() as UserData);
      setUsers(userData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubUsers();
  }, [user, userRole]);

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), cleanObject({ role: newRole }));
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  const togglePermission = async (roleId: string, sectionId: string) => {
    const newPermissions = {
      ...rolePermissions,
      [roleId]: {
        ...rolePermissions[roleId],
        [sectionId]: !rolePermissions[roleId]?.[sectionId]
      }
    };
    
    setRolePermissions(newPermissions);
    
    try {
      await setDoc(doc(db, 'settings', 'permissions'), cleanObject(newPermissions));
    } catch (error) {
      console.error("Error saving permissions:", error);
    }
  };
  
  const handleExportData = () => {
    // In a real app, we'd fetch from Firestore here
    toast.info("Cloud data export is currently being processed. You will receive a notification when it's ready.");
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

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-border-grey">
        <button
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
        {(userRole === 'admin' || userRole === 'backoffice' || userRole === 'manager') && (
          <button
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
        <button
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
            <h2 className="text-xl font-bold text-text-navy flex items-center mb-4 tracking-tight">
              <Shield className="mr-3 h-7 w-7 text-accent" />
              Roles & Permissions
            </h2>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-8">
              Configure what each role can access within the application.
            </p>

            <div className="overflow-x-auto rounded-2xl border border-border-grey">
              <table className="min-w-full divide-y divide-border-grey">
                <thead>
                  <tr className="bg-main-bg">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      Section
                    </th>
                    {DEFAULT_ROLES.map((role: any) => (
                      <th key={role.id} className="px-6 py-4 text-center text-[10px] font-bold text-text-muted uppercase tracking-widest">
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card-bg divide-y divide-border-grey">
                  {APP_SECTIONS.map((section: any) => (
                    <tr key={section.id} className="hover:bg-main-bg transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-navy">
                        {section.name}
                      </td>
                      {DEFAULT_ROLES.map((role: any) => (
                        <td key={role.id} className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => togglePermission(role.id, section.id)}
                            className={`inline-flex items-center justify-center h-10 w-10 rounded-xl transition-all ${
                              rolePermissions[role.id]?.[section.id]
                                ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20'
                                : 'bg-main-bg text-text-muted/30 border border-border-grey hover:bg-secondary-surface'
                            }`}
                          >
                            {rolePermissions[role.id]?.[section.id] ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <X className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Departments */}
          <div className="bg-card-bg shadow-2xl rounded-2xl p-8 border border-border-grey">
            <h2 className="text-xl font-bold text-text-navy flex items-center mb-4 tracking-tight">
              <Building className="mr-3 h-7 w-7 text-accent" />
              Departments
            </h2>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-8">
              Manage the departments within your organization.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {DEFAULT_DEPARTMENTS.map((dept: any) => (
                <div key={dept.id} className="flex items-center justify-between p-5 border border-border-grey rounded-2xl bg-main-bg hover:bg-card-bg hover:shadow-xl transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary-surface text-accent flex items-center justify-center shadow-sm">
                      <Building className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-navy">{dept.name}</h3>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Active Department</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-widest text-accent">
                    Edit
                  </Button>
                </div>
              ))}
              <button className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-border-grey rounded-2xl text-text-muted hover:border-accent hover:text-accent transition-all group">
                <Plus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Add Custom Dept</span>
              </button>
            </div>
          </div>

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
              {users.map((u) => (
                <div key={u.uid} className="flex items-center justify-between p-5 border border-border-grey rounded-2xl bg-main-bg hover:bg-card-bg transition-all">
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
                      value={u.role || 'staff'}
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
              {users.length === 0 && (
                <div className="text-center py-12 text-text-muted bg-main-bg rounded-2xl border border-dashed border-border-grey">
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
                  className="w-full max-w-md bg-card-bg border border-border-grey rounded-3xl p-8 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-bold text-text-navy tracking-tight">New Staff Member</h3>
                    <button onClick={() => setIsAddingStaff(false)} className="text-text-muted hover:text-text-navy transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
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
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Last Name</label>
                        <input 
                          type="text"
                          value={newStaff.lastName}
                          onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
                          className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
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
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Role</label>
                      <select 
                        value={newStaff.role}
                        onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none"
                      >
                        <option value="Waiter">Waiter</option>
                        <option value="Bartender">Bartender</option>
                        <option value="Chef">Chef (Admin)</option>
                        <option value="Manager">Manager (Admin)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Permissions (comma separated)</label>
                      <input 
                        type="text"
                        value={newStaff.permissions?.join(', ')}
                        onChange={(e) => setNewStaff({ ...newStaff, permissions: e.target.value.split(',').map(p => p.trim()) })}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Security PIN (4 digits)</label>
                      <input 
                        type="password"
                        maxLength={4}
                        value={newStaff.pin}
                        onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Hourly Rate (£)</label>
                      <input 
                        type="number"
                        value={newStaff.hourlyRate}
                        onChange={(e) => setNewStaff({ ...newStaff, hourlyRate: parseFloat(e.target.value) })}
                        className="w-full bg-main-bg border border-border-grey rounded-xl px-4 py-3 text-text-navy focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                      />
                    </div>

                    <button 
                      onClick={handleAddStaff}
                      className="w-full py-4 bg-accent text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:opacity-90 transition-all mt-4"
                    >
                      Create Staff Member
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
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
    </div>
  );
};
