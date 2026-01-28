import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FileQuestion } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-full flex items-center justify-center py-12">
      <div className="max-w-md w-full px-6">
        <div className="text-center">
          <FileQuestion className="mx-auto h-20 w-20 text-gray-400 dark:text-gray-600" />
          <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Page not found
          </h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            Sorry, we couldn't find the page you're looking for.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link to="/">Go back home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;