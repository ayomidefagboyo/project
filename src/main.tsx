import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { currencyService } from './lib/currencyService';
import { ErrorBoundary } from './ErrorBoundary';

// Initialize currency once on app start
currencyService.initializeCurrency().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
