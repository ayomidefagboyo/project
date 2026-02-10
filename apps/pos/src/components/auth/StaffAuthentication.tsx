import React, { useState, useEffect } from 'react';
import { Settings, AlertCircle, Shield, ChevronRight, Trash2 } from 'lucide-react';
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

      // Call actual authentication API
      const authResponse = await staffService.authenticateWithPin({
        staff_code: selectedStaffCode,
        pin: pin,
        outlet_id: terminalConfig.outlet_id
      });

      // Check if authentication was successful
      if (!authResponse || !authResponse.staff_profile) {
        setError('Authentication failed. Please check your PIN.');
        setPin('');
        return;
      }

      // Store staff session from API response
      const staffSession = {
        staff_profile: authResponse.staff_profile,
        outlet_id: terminalConfig.outlet_id,
        session_token: authResponse.session_token,
        expires_at: authResponse.expires_at,
        clocked_in_at: new Date().toISOString(),
      };

      localStorage.setItem('pos_staff_session', JSON.stringify(staffSession));

      success(`Welcome, ${authResponse.staff_profile.display_name}!`);
      onStaffAuthenticated(authResponse.staff_profile);

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
    <div
      className="h-screen w-screen bg-background p-8 flex flex-col"
      onKeyDown={handleKeyPress}
      tabIndex={0}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-light text-foreground tracking-tight mb-2">
          Welcome to {terminalConfig.outlet_name}
        </h1>
        <p className="text-muted-foreground">
          Select your profile and enter your PIN to clock in
        </p>
      </div>

      {/* Staff Profiles Grid */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="grid grid-cols-6 gap-6 max-w-6xl w-full mb-12">
          {staffProfiles.map((staff) => (
            <button
              key={staff.id}
              onClick={() => {
                setSelectedStaffCode(staff.staff_code);
                setPin('');
                setError('');
              }}
              className={`p-4 border-2 rounded-lg transition-all duration-200 text-center ${
                selectedStaffCode === staff.staff_code
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-border/60'
              }`}
            >
              <div className="flex flex-col items-center space-y-3">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-medium text-lg ${
                  selectedStaffCode === staff.staff_code
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  {staff.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-medium text-foreground truncate">{staff.display_name}</h3>
                  <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded font-medium mt-1 inline-block">
                    {staff.role}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* PIN Entry Section */}
        <div className="w-full max-w-sm relative">
          <div className="text-center mb-6">
            {/* PIN Display */}
            <div className="flex justify-center space-x-3">
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    pin.length > index
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    pin.length > index ? 'bg-primary' : 'bg-transparent'
                  }`}></div>
                </div>
              ))}
            </div>

            {/* Error Display - Overlay to the right of PIN dots */}
            {error && (
              <div className="absolute top-0 left-full ml-4 z-20">
                <div className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg shadow-lg text-sm font-medium whitespace-nowrap">
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* PIN Pad */}
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinInput(num.toString())}
                  className="h-16 bg-card border border-border hover:bg-accent hover:border-accent-foreground/20 rounded-lg font-medium text-xl transition-all duration-200 active:scale-95"
                  disabled={isAuthenticating || !selectedStaffCode}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={handlePinDelete}
                className="h-16 bg-card border border-border hover:bg-accent hover:border-accent-foreground/20 rounded-lg transition-all duration-200 active:scale-95 flex items-center justify-center"
                disabled={isAuthenticating || pin.length === 0 || !selectedStaffCode}
              >
                <Trash2 className="w-6 h-6 text-muted-foreground" />
              </button>
              <button
                onClick={() => handlePinInput('0')}
                className="h-16 bg-card border border-border hover:bg-accent hover:border-accent-foreground/20 rounded-lg font-medium text-xl transition-all duration-200 active:scale-95"
                disabled={isAuthenticating || !selectedStaffCode}
              >
                0
              </button>
              <button
                onClick={handleAuthentication}
                disabled={pin.length !== 6 || isAuthenticating || !selectedStaffCode}
                className="h-16 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground rounded-lg font-medium transition-all duration-200 active:scale-95 flex items-center justify-center disabled:text-muted-foreground"
              >
                {isAuthenticating ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-foreground border-t-transparent"></div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    <span>Clock In</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-6">
        <button
          onClick={onReconfigure}
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-all duration-200 text-sm font-medium"
        >
          <Settings className="w-4 h-4" />
          Reconfigure Terminal
        </button>
      </div>
    </div>
  );
};

export default StaffAuthentication;