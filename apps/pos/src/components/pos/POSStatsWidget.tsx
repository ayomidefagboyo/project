/**
 * POS Stats Widget - Statistical display component
 * Nigerian Supermarket Focus
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface POSStatsWidgetProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  onClick?: () => void;
}

const POSStatsWidget: React.FC<POSStatsWidgetProps> = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
  onClick
}) => {
  // Color mappings for different themes
  const colorClasses = {
    blue: {
      background: 'bg-blue-50',
      icon: 'bg-blue-500',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-100'
    },
    green: {
      background: 'bg-green-50',
      icon: 'bg-green-500',
      text: 'text-green-600',
      hover: 'hover:bg-green-100'
    },
    purple: {
      background: 'bg-purple-50',
      icon: 'bg-purple-500',
      text: 'text-purple-600',
      hover: 'hover:bg-purple-100'
    },
    orange: {
      background: 'bg-orange-50',
      icon: 'bg-orange-500',
      text: 'text-orange-600',
      hover: 'hover:bg-orange-100'
    },
    red: {
      background: 'bg-red-50',
      icon: 'bg-red-500',
      text: 'text-red-600',
      hover: 'hover:bg-red-100'
    },
    yellow: {
      background: 'bg-yellow-50',
      icon: 'bg-yellow-500',
      text: 'text-yellow-600',
      hover: 'hover:bg-yellow-100'
    }
  };

  const colors = colorClasses[color];

  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return String(val);
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        relative p-4 rounded-lg border border-gray-200 transition-all duration-150
        ${colors.background}
        ${onClick ? `cursor-pointer ${colors.hover} hover:shadow-md active:scale-95` : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${colors.icon} text-white flex-shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-600 truncate">
                {title}
              </p>
              <div className="flex items-baseline space-x-2">
                <p className={`text-2xl font-bold ${colors.text} truncate`}>
                  {formatValue(value)}
                </p>
                {trend && (
                  <div className={`text-xs px-2 py-1 rounded-full ${trend.isPositive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    <span className="font-medium">
                      {trend.isPositive ? '+' : ''}{trend.value}%
                    </span>
                  </div>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {subtitle}
                </p>
              )}
              {trend && (
                <p className="text-xs text-gray-500 mt-1">
                  vs {trend.period}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click indicator */}
      {onClick && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-gray-400 rounded-full opacity-50"></div>
        </div>
      )}
    </Component>
  );
};

export default POSStatsWidget;