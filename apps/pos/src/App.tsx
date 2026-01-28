
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import POSDashboard from './components/pos/POSDashboard';
import { OutletProvider } from './contexts/OutletContext';

function App() {
  return (
    <BrowserRouter>
      <OutletProvider>
        <Routes>
          <Route path="/" element={<POSDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OutletProvider>
    </BrowserRouter>
  );
}

export default App;
