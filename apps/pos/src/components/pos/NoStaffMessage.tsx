import React from 'react';
import { Users, ExternalLink } from 'lucide-react';
import { resolveDashboardAppUrl } from '../../../../../shared/services/urlResolver';

const NoStaffMessage: React.FC = () => {
  const dashboardAppUrl = resolveDashboardAppUrl(import.meta.env.VITE_DASHBOARD_APP_URL);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          No Staff Profiles Found
        </h1>

        <p className="text-gray-600 mb-6">
          This POS terminal requires a staff profile to operate. Please create staff profiles from the admin dashboard first.
        </p>

        <div className="space-y-3">
          <a
            href={dashboardAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Admin Dashboard
          </a>

          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh POS
          </button>
        </div>

        <div className="mt-6 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Account Owner:</strong> Go to Admin Dashboard → Staff Management → Add Staff Profile
          </p>
        </div>
      </div>
    </div>
  );
};

export default NoStaffMessage;
