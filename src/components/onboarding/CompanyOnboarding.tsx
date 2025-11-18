import React, { useState } from 'react';
import { Building, MapPin, Globe, ArrowRight } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { dataService } from '@/lib/dataService';

interface CompanyOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const CompanyOnboarding: React.FC<CompanyOnboardingProps> = ({ onComplete, onSkip }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    businessType: '',
    location: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser, setUserOutlets, setCurrentOutlet } = useOutlet();

  const businessTypes = [
    'Supermarket/Retail',
    'Pharmacy',
    'Restaurant/Food Service',
    'Professional Services',
    'Healthcare',
    'Technology',
    'Manufacturing',
    'Other'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!currentUser?.id) {
        throw new Error('User not found');
      }

      // Create the outlet with company information
      const { data: outlet, error: outletError } = await dataService.createOutlet({
        name: formData.companyName,
        business_type: formData.businessType,
        address: formData.location,
        status: 'active',
        currency: 'USD', // Default currency
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, currentUser.id);

      if (outletError || !outlet) {
        throw new Error(outletError || 'Failed to create outlet');
      }

      // Update user's outlet_id to link them to this outlet
      const { error: userUpdateError } = await dataService.updateUser(currentUser.id, {
        outlet_id: outlet.id,
        company_name: formData.companyName,
        business_type: formData.businessType,
      });

      if (userUpdateError) {
        console.warn('Failed to update user profile:', userUpdateError);
        // Don't fail the whole process for this
      }

      // Set the outlet in context
      setUserOutlets([outlet]);
      setCurrentOutlet(outlet);

      console.log('Created outlet and updated user:', { outlet, user: currentUser });
      onComplete();
    } catch (error) {
      console.error('Error saving company info:', error);
      // Show error to user here - could add error state
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-light text-foreground mb-2">
            Welcome to Compazz, {currentUser?.name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">
            Let's set up your business profile to get started with financial intelligence
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-2">
              Company Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                id="companyName"
                name="companyName"
                type="text"
                required
                value={formData.companyName}
                onChange={handleChange}
                className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                placeholder="Your company name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="businessType" className="block text-sm font-medium text-foreground mb-2">
              Business Type
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <select
                id="businessType"
                name="businessType"
                required
                value={formData.businessType}
                onChange={handleChange}
                className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
              >
                <option value="">Select your business type</option>
                {businessTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-foreground mb-2">
              Location <span className="text-muted-foreground">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                id="location"
                name="location"
                type="text"
                value={formData.location}
                onChange={handleChange}
                className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                placeholder="City, Country"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-primary py-3 text-sm font-medium group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                  Setting up...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  Complete Setup
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </button>

            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={isLoading}
                className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip for now
              </button>
            )}
          </div>
        </form>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            You can always update this information later in your account settings
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompanyOnboarding;