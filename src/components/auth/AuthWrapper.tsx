import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginForm from './LoginForm';
import OwnerSignupForm from './OwnerSignupForm';

interface AuthWrapperProps {
  onAuthSuccess: () => void;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ onAuthSuccess }) => {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true); // Default to login
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);

  // Check URL parameter to determine initial mode and plan
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode');
    const plan = urlParams.get('plan');
    const trial = urlParams.get('trial');

    if (mode === 'signup') {
      setIsLogin(false);
    } else {
      setIsLogin(true); // Default to login
    }

    if (plan) {
      setSelectedPlan(plan);
    }

    if (trial === 'true') {
      setIsTrial(true);
    }
  }, [location.search]);

  const handleAuthSuccess = () => {
    onAuthSuccess();
  };

  const switchToSignup = () => {
    setIsLogin(false);
  };

  const switchToLogin = () => {
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {isLogin ? (
        <LoginForm 
          onSuccess={handleAuthSuccess}
          onSwitchToSignup={switchToSignup}
        />
      ) : (
        <OwnerSignupForm
          onSuccess={handleAuthSuccess}
          onSwitchToLogin={switchToLogin}
          selectedPlan={selectedPlan}
          isTrial={isTrial}
        />
      )}
    </div>
  );
};

export default AuthWrapper;
