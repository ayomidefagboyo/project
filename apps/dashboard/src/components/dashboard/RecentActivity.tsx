import React from 'react';
import { formatDate } from '@/lib/utils';
import { AuditEntry } from '@/types';

interface RecentActivityProps {
  activities: AuditEntry[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-green-600 dark:text-green-400';
      case 'update': return 'text-blue-600 dark:text-blue-400';
      case 'delete': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return '✚';
      case 'update': return '✎';
      case 'delete': return '✖';
      default: return '•';
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Recent Activity</h3>
      
      <div className="space-y-4">
        {activities?.map((activity) => (
          <div key={activity.id} className="flex items-start">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getActionColor(activity.action)} bg-opacity-10 dark:bg-opacity-10 mr-3 mt-0.5 flex-shrink-0`}>
              <span className="text-sm">{getActionIcon(activity.action)}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {activity.details}
              </p>
              
              <div className="flex items-center mt-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                  {activity.userName}
                </p>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(activity.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {(!activities || activities.length === 0) && (
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
        </div>
      )}
      
      {activities && activities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
            View all activity →
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;