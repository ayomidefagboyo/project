import React, { useState, useEffect } from 'react';
import { Users, Settings, AlertCircle, Shield, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { staffService } from '@/lib/staffService';
import { useToast } from '@/components/ui/Toast';

interface TerminalConfig {
  outlet_id: string;
  outlet_name: string;
  initialized_by: string;
  initialized_at: string;
}

interface StaffProfile {
  id: string;
  staff_code: string;
  display_name: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
}

interface StaffAuthenticationProps {
  terminalConfig: TerminalConfig;
  onStaffAuthenticated: (staff: StaffProfile) => void;
  onReconfigure: () => void;
}

const StaffAuthentication: React.FC<StaffAuthenticationProps> = ({
  terminalConfig,
  onStaffAuthenticated,
  onReconfigure,
}) => {
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [selectedStaffCode, setSelectedStaffCode] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const { success, error: toastError } = useToast();

  // Load staff profiles for this outlet
  useEffect(() => {
    loadStaffProfiles();
  }, [terminalConfig.outlet_id]);

  const loadStaffProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await staffService.getOutletStaff(terminalConfig.outlet_id);
      setStaffProfiles(response.profiles || []);
    } catch (err) {
      console.error('Failed to load staff profiles:', err);
      setStaffProfiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError('');
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleAuthentication = async () => {
    if (!selectedStaffCode || pin.length !== 6) return;

    try {
      setIsAuthenticating(true);
      setError('');

      const selectedStaff = staffProfiles.find(s => s.staff_code === selectedStaffCode);
      if (!selectedStaff) {
        setError('Staff profile not found');
        return;
      }

      // For now, simulate authentication (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Store staff session
      const staffSession = {
        staff_profile: selectedStaff,
        outlet_id: terminalConfig.outlet_id,
        session_token: `session_${Date.now()}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        clocked_in_at: new Date().toISOString(),
      };

      localStorage.setItem('pos_staff_session', JSON.stringify(staffSession));

      success(`Welcome, ${selectedStaff.display_name}!`);
      onStaffAuthenticated(selectedStaff);

    } catch (err) {
      console.error('Authentication failed:', err);
      setError('Authentication failed. Please check your PIN.');
      setPin('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      handlePinInput(e.key);
    } else if (e.key === 'Backspace') {
      handlePinDelete();
    } else if (e.key === 'Enter' && selectedStaffCode && pin.length === 6) {
      handleAuthentication();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="bg-card border border-border rounded-xl shadow-[var(--shadow-large)] p-12 max-w-md w-full">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-medium text-foreground tracking-tight">Loading Staff Profiles</h2>
              <p className="text-muted-foreground text-sm">Please wait while we retrieve your team...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (staffProfiles.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="bg-card border border-border rounded-xl shadow-[var(--shadow-large)] p-12 max-w-lg w-full">
          <div className="text-center space-y-8">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-accent-foreground" />
            </div>

            <div className="space-y-4">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                No Staff Profiles Found
              </h1>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  No staff profiles are configured for
                </p>
                <div className="px-4 py-2 bg-secondary rounded-lg">
                  <span className="font-medium text-secondary-foreground">{terminalConfig.outlet_name}</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Please create staff profiles from the admin dashboard first.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href="http://localhost:5173"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-medium text-[var(--text-button)]"
              >
                Open Admin Dashboard
                <ChevronRight className="w-5 h-5" />
              </a>

              <button
                onClick={loadStaffProfiles}
                className="w-full px-6 py-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-all duration-200 font-medium text-[var(--text-button)]"
              >
                Refresh Staff Profiles
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Brand Panel (Desktop-first) */}
      <div className="hidden lg:flex lg:w-2/5 xl:w-1/3 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <div className="mb-16">
            <h2 className="text-3xl font-light text-primary-foreground tracking-tight">
              Compazz
            </h2>
            <div className="mt-2 h-0.5 w-16 bg-primary-foreground/30"></div>
          </div>

          <div className="max-w-sm space-y-8">
            <h1 className="text-4xl font-light text-primary-foreground mb-6 leading-tight">
              Professional Staff Clock-In System
            </h1>

            <div className="space-y-6">
              <div className="flex items-center text-primary-foreground/80">
                <Shield className="w-5 h-5 mr-4 flex-shrink-0" />
                <span className="font-light">Secure PIN-based authentication</span>
              </div>
              <div className="flex items-center text-primary-foreground/80">
                <Clock className="w-5 h-5 mr-4 flex-shrink-0" />
                <span className="font-light">Real-time attendance tracking</span>
              </div>
              <div className="flex items-center text-primary-foreground/80">
                <Users className="w-5 h-5 mr-4 flex-shrink-0" />
                <span className="font-light">Multi-staff terminal support</span>
              </div>
            </div>

            <div className="pt-8 text-primary-foreground/60 text-sm font-light">
              Terminal: {terminalConfig.outlet_name}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Authentication Interface */}
      <div className="w-full lg:w-3/5 xl:w-2/3 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-2xl space-y-12">

          {/* Mobile Header - Only visible on smaller screens */}
          <div className="lg:hidden text-center space-y-4">
            <h2 className="text-3xl font-light text-foreground tracking-tight">
              Compazz
            </h2>
            <div className="space-y-2">
              <h1 className="text-2xl font-medium text-foreground">Staff Clock In</h1>
              <p className="text-muted-foreground">{terminalConfig.outlet_name}</p>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block space-y-3">
            <h1 className="text-3xl font-light text-foreground tracking-tight">
              Welcome to your workspace
            </h1>
            <p className="text-muted-foreground text-lg">
              Select your profile and enter your PIN to clock in
            </p>
          </div>

          {/* Staff Selection */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl font-medium text-foreground">Select Your Profile</h2>
              <p className="text-muted-foreground">Choose your staff profile to continue</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-80 overflow-y-auto pr-2">
              {staffProfiles.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    setSelectedStaffCode(staff.staff_code);
                    setPin('');
                    setError('');
                  }}
                  className={`p-6 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-[var(--shadow-medium)] ${
                    selectedStaffCode === staff.staff_code
                      ? 'border-primary bg-primary/5 shadow-[var(--shadow-medium)]'
                      : 'border-border bg-card hover:border-border/60'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-medium text-lg ${
                      selectedStaffCode === staff.staff_code
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {staff.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{staff.display_name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm text-muted-foreground">{staff.staff_code}</span>
                        <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-md font-medium">
                          {staff.role}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PIN Entry Section */}
          {selectedStaffCode && (
            <div className="space-y-8">
              <div className="space-y-3">
                <h2 className="text-xl font-medium text-foreground">Enter Your PIN</h2>
                <p className="text-muted-foreground">
                  Enter your 6-digit security PIN for{' '}
                  <span className="font-medium text-foreground">
                    {staffProfiles.find(s => s.staff_code === selectedStaffCode)?.display_name}
                  </span>
                </p>
              </div>

              {/* PIN Display - Desktop-first larger dots */}
              <div className="flex justify-center space-x-4 lg:space-x-6">
                {[...Array(6)].map((_, index) => (
                  <div
                    key={index}
                    className={`w-16 h-16 lg:w-20 lg:h-20 border-2 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      pin.length > index
                        ? 'border-primary bg-primary/10 shadow-[var(--shadow-medium)]'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className={`w-4 h-4 lg:w-5 lg:h-5 rounded-full transition-all duration-200 ${
                      pin.length > index ? 'bg-primary scale-100' : 'bg-transparent scale-0'
                    }`}></div>
                  </div>
                ))}
              </div>

              {/* Error Display */}
              {error && (
                <div className="text-center px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm font-medium">{error}</p>
                </div>
              )}

              {/* PIN Pad - Touch-optimized for desktop */}
              <div className="max-w-md mx-auto">
                <div className="grid grid-cols-3 gap-4 lg:gap-6 mb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handlePinInput(num.toString())}
                      className="h-16 lg:h-20 bg-card border border-border hover:bg-accent hover:border-accent-foreground/20 rounded-xl font-medium text-xl lg:text-2xl transition-all duration-200 shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-medium)] active:scale-95"
                      disabled={isAuthenticating}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                {/* Bottom row with 0, delete, and submit */}
                <div className="grid grid-cols-3 gap-4 lg:gap-6">
                  <button
                    onClick={handlePinDelete}
                    className="h-16 lg:h-20 bg-card border border-border hover:bg-accent hover:border-accent-foreground/20 rounded-xl transition-all duration-200 shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-medium)] active:scale-95 flex items-center justify-center"
                    disabled={isAuthenticating || pin.length === 0}
                  >
                    <Trash2 className="w-6 h-6 lg:w-7 lg:h-7 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handlePinInput('0')}
                    className="h-16 lg:h-20 bg-card border border-border hover:bg-accent hover:border-accent-foreground/20 rounded-xl font-medium text-xl lg:text-2xl transition-all duration-200 shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-medium)] active:scale-95"
                    disabled={isAuthenticating}
                  >
                    0
                  </button>
                  <button
                    onClick={handleAuthentication}
                    disabled={pin.length !== 6 || isAuthenticating}
                    className="h-16 lg:h-20 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground rounded-xl font-medium transition-all duration-200 shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-medium)] active:scale-95 flex items-center justify-center disabled:text-muted-foreground"
                  >
                    {isAuthenticating ? (
                      <div className="animate-spin rounded-full h-6 w-6 lg:h-7 lg:w-7 border-2 border-primary-foreground border-t-transparent"></div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 lg:w-6 lg:h-6" />
                        <span className="text-lg lg:text-xl">Clock In</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Terminal Info Footer */}
          <div className="border-t border-border pt-8 mt-12 space-y-4">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-4 h-4" />
                <span>Terminal initialized by</span>
                <span className="font-medium text-foreground">{terminalConfig.initialized_by}</span>
              </div>

              <button
                onClick={onReconfigure}
                className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-all duration-200 text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                Reconfigure Terminal
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StaffAuthentication;