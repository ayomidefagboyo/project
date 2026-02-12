import React, { useState, useEffect } from 'react';
import { Plus, User, Shield, Eye, EyeOff, Trash2, Edit, CheckCircle, X } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { staffService, rolePermissions, StaffProfile, CreateStaffData } from '@/lib/staffService';
import Toast from '@/components/ui/Toast';

interface NewStaffForm {
  display_name: string;
  pin: string;
  role: string;
  permissions: string[];
}

const StaffManagement: React.FC = () => {
  const { currentOutlet, currentUser } = useOutlet();
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState<NewStaffForm>({
    display_name: '',
    pin: '',
    role: 'cashier',
    permissions: rolePermissions.cashier
  });

  // Toast and Success Modal State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'warning' | 'info', visible: boolean}>({
    message: '',
    type: 'info',
    visible: false
  });
  const [successModal, setSuccessModal] = useState<{
    visible: boolean,
    name: string
  }>({
    visible: false,
    name: ''
  });

  // Helper functions for UI feedback
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type, visible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  // Load existing staff profiles
  useEffect(() => {
    loadStaffProfiles();
  }, []);

  const loadStaffProfiles = async () => {
    if (!currentOutlet?.id) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await staffService.getStaffProfiles(currentOutlet.id);

      if (response.error) {
        setError(response.error);
        setStaffProfiles([]);
      } else {
        setStaffProfiles(response.data?.profiles || []);
      }
    } catch (error) {
      console.error('Failed to load staff profiles:', error);
      setError('Failed to load staff profiles');
      setStaffProfiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setNewStaff(prev => ({ ...prev, pin }));
  };

  const handleRoleChange = (role: string) => {
    setNewStaff(prev => ({
      ...prev,
      role,
      permissions: rolePermissions[role as keyof typeof rolePermissions] || []
    }));
  };

  const createStaffProfile = async () => {
    if (!currentOutlet?.id) {
      showToast('No outlet selected', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Validate form
      if (!newStaff.display_name.trim()) {
        showToast('Please enter staff name', 'warning');
        return;
      }
      if (!newStaff.pin || newStaff.pin.length !== 6) {
        showToast('Please enter a 6-digit PIN', 'warning');
        return;
      }

      // Prepare staff data
      const staffData: CreateStaffData = {
        display_name: newStaff.display_name,
        pin: newStaff.pin,
        role: newStaff.role,
        permissions: newStaff.permissions,
        outlet_id: currentOutlet.id
      };

      const response = await staffService.createStaffProfile(staffData);

      if (response.error) {
        showToast(`Failed to create staff profile: ${response.error}`, 'error');
        return;
      }

      if (response.data) {
        // Reload staff profiles to get the updated list
        await loadStaffProfiles();

        // Show success modal with staff details
        setSuccessModal({
          visible: true,
          name: newStaff.display_name
        });

        // Reset form
        setNewStaff({
          display_name: '',
          pin: '',
          role: 'cashier',
          permissions: rolePermissions.cashier
        });
        setShowCreateForm(false);
      }

    } catch (error) {
      console.error('Failed to create staff profile:', error);
      showToast('Failed to create staff profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteStaffProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff profile?')) return;

    try {
      setIsLoading(true);
      const response = await staffService.deleteStaffProfile(id);

      if (response.error) {
        showToast(`Failed to delete staff profile: ${response.error}`, 'error');
        return;
      }

      // Reload staff profiles to get the updated list
      await loadStaffProfiles();
      showToast('Staff profile deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete staff profile:', error);
      showToast('Failed to delete staff profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading or error states
  if (!currentOutlet) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Outlet Selected</h2>
          <p className="text-gray-600">Please select an outlet to manage staff profiles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">
            Manage POS staff profiles and permissions for {currentOutlet.name}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          disabled={isLoading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <div className="text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-red-800">Error</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Staff Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Create New Staff Profile</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Staff Name
              </label>
              <input
                type="text"
                value={newStaff.display_name}
                onChange={(e) => setNewStaff(prev => ({ ...prev, display_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter staff member's name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={newStaff.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="waiter">Waiter</option>
                <option value="inventory_staff">Inventory Staff</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                6-Digit PIN
              </label>
              <div className="flex gap-2">
                <input
                  type={showPin ? "text" : "password"}
                  value={newStaff.pin}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="123456"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={generatePin}
                  className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permissions
              </label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                {newStaff.permissions.map((permission, index) => (
                  <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2 mb-1">
                    {permission.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={createStaffProfile}
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Staff Profile'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold">Staff Profiles ({staffProfiles.length})</h3>
        </div>

        {staffProfiles.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No staff profiles found</p>
            <p className="text-sm text-gray-400">Create your first staff profile to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {staffProfiles.map((staff) => (
              <div key={staff.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{staff.display_name}</h4>
                      <p className="text-sm text-gray-600">Code: {staff.staff_code}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium capitalize">
                          {staff.role.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {staff.permissions.length} permissions
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteStaffProfile(staff.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete staff profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {staff.permissions.map((permission, index) => (
                    <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {permission.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Setup Guide */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Quick Setup Guide</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>1. Create staff profiles with name and PIN (no email needed)</p>
          <p>2. Assign appropriate roles (cashier, manager, etc.)</p>
          <p>3. Staff can login to POS system using their Staff Code + PIN</p>
          <p>4. Different roles have different permission levels in the POS</p>
        </div>
      </div>

      {/* Success Modal */}
      {successModal.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center">
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Staff Profile Created Successfully!
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {successModal.name} has been added to your team
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Credentials are hidden for privacy. Staff can use their assigned access details in POS.
              </p>

              <button
                onClick={() => setSuccessModal(prev => ({ ...prev, visible: false }))}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.visible}
        onClose={hideToast}
        duration={4000}
      />
    </div>
  );
};

export default StaffManagement;
