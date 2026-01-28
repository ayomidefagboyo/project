import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check, Plus } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { Outlet as OutletType, BusinessType } from '@/types';
import { SubscriptionMiddleware } from '@/lib/subscriptionMiddleware';

const businessTypeIcons: Record<BusinessType, string> = {
  supermarket: '🛒',
  restaurant: '🍽️',
  lounge: '🍸',
  retail: '🛍️',
  cafe: '☕'
};

const businessTypeColors: Record<BusinessType, string> = {
  supermarket: 'bg-green-100 text-green-800 border-green-200',
  restaurant: 'bg-orange-100 text-orange-800 border-orange-200',
  lounge: 'bg-purple-100 text-purple-800 border-purple-200',
  retail: 'bg-blue-100 text-blue-800 border-blue-200',
  cafe: 'bg-yellow-100 text-yellow-800 border-yellow-200'
};

interface OutletSelectorProps {
  onCreateStore?: () => void;
}

const OutletSelector: React.FC<OutletSelectorProps> = ({ onCreateStore }) => {
  const { currentOutlet, setCurrentOutlet, userOutlets, isSuperAdmin, currentUser, isBusinessOwner } = useOutlet();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canCreateStores = isSuperAdmin || isBusinessOwner || currentUser?.role === 'outlet_admin';

  // Check outlet limits
  const { canAddOutlet, currentCount, maxOutlets, loading: outletLimitLoading } =
    SubscriptionMiddleware.useOutletLimit(currentUser?.id || '');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOutletSelect = (outlet: OutletType) => {
    setCurrentOutlet(outlet);
    setIsOpen(false);
  };

  const handleCreateStore = () => {
    setIsOpen(false);
    if (onCreateStore) {
      onCreateStore();
    }
  };

  if (!currentOutlet || userOutlets.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{businessTypeIcons[currentOutlet.businessType]}</span>
          <div className="text-left">
            <div className="font-medium text-gray-900 dark:text-white text-sm">
              {currentOutlet.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {currentOutlet.businessType}
            </div>
          </div>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="py-2">
            <div className="px-3 py-1">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {isSuperAdmin || isBusinessOwner ? 'All Outlets' : 'Your Outlets'}
              </h3>
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {userOutlets.map((outlet) => (
              <button
                key={outlet.id}
                onClick={() => handleOutletSelect(outlet)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{businessTypeIcons[outlet.businessType]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {outlet.name}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {canCreateStores && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
              {isSuperAdmin && (
                <button className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
                  <Building2 size={14} />
                  Manage All Outlets
                </button>
              )}

              {onCreateStore && (
                <>
                  {canAddOutlet ? (
                    <button
                      onClick={handleCreateStore}
                      className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <Plus size={14} />
                      Create Outlet
                    </button>
                  ) : (
                    <div className="px-2 py-1.5">
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Outlet limit reached ({currentCount}/{maxOutlets === -1 ? 'unlimited' : maxOutlets})
                      </div>
                      <button
                        className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors mt-1"
                        onClick={() => {
                          // Navigate to pricing page
                          window.location.href = '/pricing';
                        }}
                      >
                        <Building2 size={14} />
                        Upgrade Plan
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutletSelector;

