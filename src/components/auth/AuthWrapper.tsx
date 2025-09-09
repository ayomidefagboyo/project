import React, { useState } from 'react';
import LoginForm from './LoginForm';
import OwnerSignupForm from './OwnerSignupForm';

interface AuthWrapperProps {
  onAuthSuccess: () => void;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);

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
    <div>
      {isLogin ? (
        <LoginForm 
          onSuccess={handleAuthSuccess}
          onSwitchToSignup={switchToSignup}
        />
      ) : (
        <OwnerSignupForm 
          onSuccess={handleAuthSuccess}
          onSwitchToLogin={switchToLogin}
        />
      )}
    </div>
  );
};

export default AuthWrapper;
