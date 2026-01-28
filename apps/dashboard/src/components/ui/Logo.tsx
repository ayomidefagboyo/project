import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  showText = true, 
  size = 'md',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const dotSizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <Link to="/" className={`flex items-center space-x-3 ${className}`}>
      <div className={`${sizeClasses[size]} bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-lg flex items-center justify-center`}>
        <div className={`${dotSizeClasses[size]} bg-emerald-500 rounded-full`}></div>
      </div>
      {showText && (
        <span className={`${textSizeClasses[size]} font-bold text-gray-900 dark:text-white tracking-tight`}>
          Compazz
        </span>
      )}
    </Link>
  );
};

export default Logo;
