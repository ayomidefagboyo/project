import React, { useState } from 'react';
import { Search, Filter, CalendarDays, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { auditEntries } from '@/lib/mockData';
import { formatDate } from '@/lib/utils';

const AuditTrail: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  
  const uniqueEntityTypes = Array.from(
    new Set(auditEntries.map(entry => entry.entityType))
  );
  
  const filteredEntries = auditEntries
    .filter(entry => {
      // Filter by search term
      const searchMatches = 
        entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.userName.toLowerCase().includes(searchTerm.toLowerCase());
        
      // Filter by entity type
      const entityMatches = entityFilter === 'all' || entry.entityType === entityFilter;
      
      return searchMatches && entityMatches;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 dark:bg-opacity-20';
      case 'update': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 dark:bg-opacity-20';
      case 'delete': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 dark:bg-opacity-20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };
  
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Audit Trail</h1>
          <p className="text-gray-500 dark:text-gray-400">Track all changes and activities</p>
        </div>
        <Button variant="outline" className="flex items-center">
          <Download size={16} className="mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search audit entries..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {uniqueEntityTypes.map(type => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <Filter size={16} />
            </div>
          </div>
          <Button variant="outline" size="icon">
            <CalendarDays size={18} />
          </Button>
        </div>
      </div>

      {/* Audit Trail Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flow-root">
          <ul role="list" className="-mb-8">
            {filteredEntries.map((entry, entryIdx) => (
              <li key={entry.id}>
                <div className="relative pb-8">
                  {entryIdx !== filteredEntries.length - 1 ? (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800 ${getActionColor(entry.action)}`}>
                        {entry.action === 'create' && '✚'}
                        {entry.action === 'update' && '✎'}
                        {entry.action === 'delete' && '✖'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{entry.details}</p>
                        <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <p>By {entry.userName}</p>
                          <span className="mx-1">•</span>
                          <p>Entity: {entry.entityType.charAt(0).toUpperCase() + entry.entityType.slice(1)}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {formatDate(entry.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {filteredEntries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">No audit entries found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;