import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import { Toaster } from 'sonner';

import { ProxyProvider } from './context/ProxyContext';
import ProxyModal from './components/ProxyModal';
import ChangelogModal from './components/ChangelogModal';
import { supabase } from './lib/supabase';

const AuthRecoveryHandler: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event detected, navigating to reset page');
        navigate('/reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ProxyProvider>
        <PortfolioProvider>
          <ConfirmProvider>
            <Toaster position="top-right" richColors closeButton />
            <ProxyModal />
            <ChangelogModal />
            <BrowserRouter>
              <AuthRecoveryHandler />
              <Routes>
                {/* Public Routes */}
                <Route path="/welcome" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Protected Routes */}
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
                </Route>

                <Route
                  path="/delete-account"
                  element={
                    <ProtectedRoute>
                      <DeleteAccountPage />
                    </ProtectedRoute>
                  }
                />

                {/* Catch all - redirect to welcome if unknown */}
                <Route path="*" element={<Navigate to="/welcome" replace />} />
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </PortfolioProvider>
      </ProxyProvider>
    </AuthProvider>
  );
};

export default App;
