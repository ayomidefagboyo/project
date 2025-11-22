import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { authService } from '@/lib/authService';
import { UserRole } from '@/types';
import { useOutlet } from '@/contexts/OutletContext';
import { Mail, UserPlus, CheckCircle, XCircle } from 'lucide-react';

interface InviteTeamMemberProps {
  onClose?: () => void;
}

const InviteTeamMember: React.FC<InviteTeamMemberProps> = ({ onClose }) => {
  const { currentOutlet, currentUser } = useOutlet();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'cashier' as UserRole
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!currentOutlet) {
      setError('No outlet selected');
      setIsLoading(false);
      return;
    }

    if (!currentUser) {
      setError('User not authenticated');
      setIsLoading(false);
      return;
    }

    try {
      const { success: inviteSuccess, error: inviteError } = await authService.inviteUser({
        email: formData.email,
        name: formData.name,
        role: formData.role,
        outletId: currentOutlet.id
      });

      if (inviteError) {
        setError(inviteError);
        return;
      }

      if (inviteSuccess) {
        setSuccess(`Invitation sent to ${formData.email}`);
        setFormData({ email: '', name: '', role: 'cashier' });
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose?.();
        }, 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Invite error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = [
    { value: 'manager', label: 'Manager' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'outlet_staff', label: 'Staff Member' },
    { value: 'inventory_staff', label: 'Inventory Manager' },
    { value: 'viewer', label: 'View Only' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Invite Team Member
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XCircle size={20} />
          </button>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <div className="flex items-center">
              <CheckCircle size={16} className="text-green-500 mr-2" />
              <span className="text-sm text-green-700 dark:text-green-400">
                {success}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center">
              <XCircle size={16} className="text-red-500 mr-2" />
              <span className="text-sm text-red-700 dark:text-red-400">
                {error}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {roleOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </div>
              ) : (
                <div className="flex items-center">
                  <Mail size={16} className="mr-2" />
                  Send Invitation
                </div>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-start">
            <UserPlus size={16} className="text-blue-500 mr-2 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-400">
              <p className="font-medium">How it works:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Invitation email will be sent to the team member</li>
                <li>• They'll click the link to set their password</li>
                <li>• They'll automatically join your company</li>
                <li>• Invitation expires in 7 days</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteTeamMember;

