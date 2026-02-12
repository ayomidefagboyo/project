import React, { useState, useEffect } from 'react';
import {
  X, Users, Plus, Edit3, Trash2, Key, Eye, EyeOff,
  UserCheck, AlertTriangle, RefreshCw
} from 'lucide-react';
import { staffService } from '@/lib/staffService';
import type { StaffProfile, StaffProfileCreate, UserRole } from '@/types';
import { useOutlet } from '@/contexts/OutletContext';
import { useToast } from '../../ui/Toast';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AddStaffFormData {
  display_name: string;
  pin: string;
  confirmPin: string;
  role: UserRole;
  permissions: string[];
}

interface StaffActionConfirmState {
  type: 'deactivate' | 'reset_attempts';
  profileId: string;
  displayName: string;
}

const StaffManagementModal: React.FC<StaffManagementModalProps> = ({ isOpen, onClose }) => {
  const { currentOutlet } = useOutlet();
  const { success, error, warning } = useToast();
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StaffProfile | null>(null);
  const [actionConfirm, setActionConfirm] = useState<StaffActionConfirmState | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [formData, setFormData] = useState<AddStaffFormData>({
    display_name: '',
    pin: '',
    confirmPin: '',
    role: 'cashier',
    permissions: []
  });

  // Available roles for staff
  const availableRoles: { value: UserRole; label: string; description: string }[] = [
    { value: 'cashier', label: 'Cashier', description: 'Handle transactions and customer service' },
    { value: 'manager', label: 'Manager', description: 'Supervise operations and staff' },
    { value: 'waiter', label: 'Waiter', description: 'Take orders and serve customers' },
    { value: 'kitchen_staff', label: 'Kitchen Staff', description: 'Prepare food and beverages' },
    { value: 'inventory_staff', label: 'Inventory Staff', description: 'Manage stock and inventory' },
    { value: 'accountant', label: 'Accountant', description: 'Handle financial records and reports' },
  ];

  // Load staff profiles when modal opens
  useEffect(() => {
    if (isOpen && currentOutlet?.id) {
      loadStaffProfiles();
    }
  }, [isOpen, currentOutlet?.id]);

  // Update permissions when role changes
  useEffect(() => {
    const defaultPermissions = staffService.getDefaultPermissionsForRole(formData.role);
    setFormData(prev => ({ ...prev, permissions: defaultPermissions }));
  }, [formData.role]);

  const loadStaffProfiles = async () => {
    if (!currentOutlet?.id) return;

    try {
      setLoading(true);
      const response = await staffService.getStaffProfiles(currentOutlet.id);
      setStaffProfiles(response.profiles);
    } catch (err) {
      console.error('Error loading staff profiles:', err);
      error('Failed to load staff profiles');
    } finally {
      setLoading(false);
    }
  };

  const generatePin = () => {
    const pin = staffService.generateSecurePin();
    setFormData(prev => ({ ...prev, pin, confirmPin: pin }));
  };

  const validateForm = (): string | null => {
    if (!formData.display_name.trim()) {
      return 'Display name is required';
    }

    const pinValidation = staffService.validatePin(formData.pin);
    if (!pinValidation.valid) {
      return pinValidation.error || 'Invalid PIN';
    }

    if (formData.pin !== formData.confirmPin) {
      return 'PIN and confirmation do not match';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id) return;

    const validationError = validateForm();
    if (validationError) {
      warning(validationError);
      return;
    }

    try {
      setLoading(true);

      if (editingProfile) {
        // Update existing profile
        await staffService.updateStaffProfile(editingProfile.id, {
          display_name: formData.display_name,
          pin: formData.pin !== editingProfile.staff_code ? formData.pin : undefined, // Only update PIN if changed
          role: formData.role,
          permissions: formData.permissions
        });
        success('Staff profile updated successfully!');
      } else {
        // Create new profile
        const createData: StaffProfileCreate = {
          display_name: formData.display_name,
          pin: formData.pin,
          role: formData.role,
          outlet_id: currentOutlet.id,
          permissions: formData.permissions
        };

        await staffService.createStaffProfile(createData);
        success('Staff profile created successfully!');
      }

      // Reset form and reload
      setFormData({
        display_name: '',
        pin: '',
        confirmPin: '',
        role: 'cashier',
        permissions: []
      });
      setShowAddForm(false);
      setEditingProfile(null);
      await loadStaffProfiles();

    } catch (err: any) {
      console.error('Error saving staff profile:', err);
      error(err.message || 'Failed to save staff profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (profile: StaffProfile) => {
    setEditingProfile(profile);
    setFormData({
      display_name: profile.display_name,
      pin: '', // Don't show existing PIN
      confirmPin: '',
      role: profile.role,
      permissions: profile.permissions
    });
    setShowAddForm(true);
  };

  const handleDelete = (profileId: string, displayName: string) => {
    setActionConfirm({
      type: 'deactivate',
      profileId,
      displayName
    });
  };

  const handleResetAttempts = (profileId: string, displayName: string) => {
    setActionConfirm({
      type: 'reset_attempts',
      profileId,
      displayName
    });
  };

  const handleConfirmStaffAction = async () => {
    if (!actionConfirm) return;

    try {
      setLoading(true);
      if (actionConfirm.type === 'deactivate') {
        await staffService.deleteStaffProfile(actionConfirm.profileId);
        success('Staff profile deactivated successfully');
      } else {
        await staffService.resetFailedAttempts(actionConfirm.profileId);
        success('Failed login attempts reset successfully');
      }
      await loadStaffProfiles();
    } catch (err: any) {
      if (actionConfirm.type === 'deactivate') {
        console.error('Error deleting staff profile:', err);
        error(err.message || 'Failed to deactivate staff profile');
      } else {
        console.error('Error resetting failed attempts:', err);
        error(err.message || 'Failed to reset failed attempts');
      }
    } finally {
      setLoading(false);
      setActionConfirm(null);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingProfile(null);
    setFormData({
      display_name: '',
      pin: '',
      confirmPin: '',
      role: 'cashier',
      permissions: []
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Staff Management</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!showAddForm ? (
            <>
              {/* Header with Add Button */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Staff</h3>
                  <p className="text-sm text-gray-500">Manage staff profiles and PIN access</p>
                </div>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Staff
                </button>
              </div>

              {/* Staff List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-gray-600">Loading staff...</span>
                </div>
              ) : staffProfiles.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Staff Profiles</h4>
                  <p className="text-gray-500 mb-4">Add staff members to enable PIN-based access</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add First Staff Member
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staffProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={`border rounded-lg p-4 ${
                        profile.is_active ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{profile.display_name}</h4>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {profile.staff_code}
                            </span>
                            <span className="capitalize">{profile.role}</span>
                          </div>
                        </div>
                        {!profile.is_active && (
                          <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 mb-4">
                        {profile.failed_login_attempts > 0 && (
                          <div className="flex items-center text-xs text-amber-600">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {profile.failed_login_attempts} failed attempts
                          </div>
                        )}

                        {profile.last_login && (
                          <div className="text-xs text-gray-500">
                            Last login: {new Date(profile.last_login).toLocaleDateString()}
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          Created: {new Date(profile.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(profile)}
                          className="flex-1 flex items-center justify-center px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Edit
                        </button>

                        {profile.failed_login_attempts > 0 && (
                          <button
                            onClick={() => handleResetAttempts(profile.id, profile.display_name)}
                            className="flex items-center justify-center px-3 py-2 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(profile.id, profile.display_name)}
                          className="flex items-center justify-center px-3 py-2 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Add/Edit Staff Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingProfile ? 'Edit Staff Profile' : 'Add New Staff Profile'}
                </h3>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter staff member's name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {availableRoles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    6-Digit PIN *
                  </label>
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        value={formData.pin}
                        onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter 6-digit PIN"
                        maxLength={6}
                        pattern="\d{6}"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={generatePin}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm PIN *
                  </label>
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={formData.confirmPin}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPin: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm 6-digit PIN"
                    maxLength={6}
                    pattern="\d{6}"
                    required
                  />
                </div>
              </div>

              {/* Role Description */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Role Permissions</h4>
                <p className="text-sm text-gray-600 mb-3">
                  {availableRoles.find(r => r.value === formData.role)?.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {formData.permissions.map(permission => (
                    <span
                      key={permission}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                    >
                      {permission.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <UserCheck className="w-4 h-4 mr-2" />
                  )}
                  {editingProfile ? 'Update Staff' : 'Create Staff'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {actionConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {actionConfirm.type === 'deactivate' ? 'Deactivate Staff Profile' : 'Reset Failed Attempts'}
            </h3>
            <p className="text-sm text-gray-600">
              {actionConfirm.type === 'deactivate'
                ? `Are you sure you want to deactivate ${actionConfirm.displayName}? They will no longer be able to log in.`
                : `Reset failed login attempts for ${actionConfirm.displayName}?`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActionConfirm(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStaffAction}
                className={`px-4 py-2 text-white rounded-lg ${
                  actionConfirm.type === 'deactivate'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {actionConfirm.type === 'deactivate' ? 'Deactivate' : 'Reset Attempts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementModal;
