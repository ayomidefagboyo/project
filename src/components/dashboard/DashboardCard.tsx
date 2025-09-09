import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  title: string;
  value: string | React.ReactNode;
  icon: React.ReactNode;
  subtitle?: string;
  change?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  change,
  className,
}) => {
  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex flex-col",
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <div className="text-gray-500 dark:text-gray-400">{icon}</div>
      </div>
      
      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
        {value}
      </div>
      
      {subtitle && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {subtitle}
        </div>
      )}
      
      {change && (
        <div className={cn(
          "text-sm flex items-center",
          change.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          <span className="mr-1">
            {change.isPositive ? '↑' : '↓'} {Math.abs(change.value)}%
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">vs last month</span>
        </div>
      )}
    </div>
  );
};

export default DashboardCard;