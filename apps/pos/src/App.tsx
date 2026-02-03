
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import POSDashboard from './components/pos/POSDashboard';
import ProductManagement from './components/pos/ProductManagement';
import AppLayout from './components/layout/AppLayout';
import { OutletProvider } from './contexts/OutletContext';

function App() {
  return (
    <BrowserRouter>
      <OutletProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<POSDashboard />} />
            <Route path="/products" element={<ProductManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </OutletProvider>
    </BrowserRouter>
  );
}

export default App;
