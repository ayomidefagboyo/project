import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { currencyService } from './lib/currencyService';
import { ErrorBoundary } from './ErrorBoundary';

// Production console override - hide all logs from users
if (import.meta.env.PROD) {
  // Override console methods in production
  const originalConsole = { ...console };
  
  // Keep console for development debugging but suppress in production
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
  
  // Override global error handlers to prevent console errors
  window.addEventListener('error', (e) => {
    e.preventDefault();
    // Optionally send to analytics/monitoring service here
    return false;
  });
  
  window.addEventListener('unhandledrejection', (e) => {
    e.preventDefault();
    // Optionally send to analytics/monitoring service here
    return false;
  });
}

// Initialize currency once on app start
currencyService.initializeCurrency().catch((error) => {
  // Only log in development
  if (import.meta.env.DEV) {
    console.error('Currency initialization failed:', error);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
