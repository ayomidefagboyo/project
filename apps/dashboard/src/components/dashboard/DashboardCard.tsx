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
    displayLabel?: string;
    comparisonLabel?: string;
  };
  className?: string;
  onClick?: () => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  change,
  className,
  onClick,
}) => {
  const interactive = typeof onClick === 'function';

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "card p-5 sm:p-6 flex flex-col transition-all duration-300",
        interactive
          ? "cursor-pointer hover:shadow-lg hover:shadow-gray-100/50 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          : "hover:shadow-lg hover:shadow-gray-100/50",
        className
      )}
      aria-label={interactive ? `${title} details` : undefined}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <div className="text-accent-foreground">{icon}</div>
        </div>
      </div>
      
      <div className="text-2xl sm:text-3xl lg:text-4xl font-light text-foreground mb-3 tracking-tight">
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
            {change.displayLabel || `${Math.abs(change.value)}%`}
          </span>
          <span className="text-muted-foreground text-xs font-light">{change.comparisonLabel || 'vs prior period'}</span>
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
