import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import StocksPage from './pages/StocksPage';
import EntryPage from './pages/EntryPage';
import CashPage from './pages/CashPage';
import PayoutsPage from './pages/PayoutsPage';
import DataPage from './pages/DataPage';
import LivePortfolioPage from './pages/LivePortfolioPage';
import { Toaster } from 'sonner';

const App: React.FC = () => {
  return (
    <PortfolioProvider>
      <AuthProvider>
        <ConfirmProvider>
          <Toaster position="top-right" richColors closeButton />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="stocks" element={<StocksPage />} />
                <Route path="entry" element={<EntryPage />} />
                <Route path="cash" element={<CashPage />} />
                <Route path="payouts" element={<PayoutsPage />} />
                <Route path="live" element={<LivePortfolioPage />} />
                <Route path="data" element={<DataPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </AuthProvider>
    </PortfolioProvider>
  );
};

export default App;
