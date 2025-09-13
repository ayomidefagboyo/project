import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
      "card p-8 flex flex-col hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300",
      className
    )}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <div className="text-accent-foreground">{icon}</div>
        </div>
      </div>
      
      <div className="text-3xl lg:text-4xl font-light text-foreground mb-3 tracking-tight">
        {value}
      </div>
      
      {subtitle && (
        <div className="text-sm text-muted-foreground font-light mb-4">
          {subtitle}
        </div>
      )}
      
      {change && (
        <div className={cn(
          "text-sm flex items-center font-medium",
          change.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        )}>
          <span className="mr-2 flex items-center">
            {change.isPositive ? (
              <TrendingUp className="w-4 h-4 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 mr-1" />
            )}
            {Math.abs(change.value)}%
          </span>
          <span className="text-muted-foreground text-xs font-light">vs last month</span>
        </div>
      )}
    </div>
  );
};

export default DashboardCard;