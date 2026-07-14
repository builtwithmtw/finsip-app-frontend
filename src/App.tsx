import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import EntryPage from './pages/EntryPage';
import LedgerPage from './pages/LedgerPage';
import LivePortfolioPage from './pages/LivePortfolioPage';
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
    <>
    {/* Outside AuthProvider: it hides its children behind a loader, which would take the
        Toaster with it and swallow any toast raised during that window. */}
    <Toaster position="top-right" richColors closeButton />
    <AuthProvider>
      <ProxyProvider>
        <PortfolioProvider>
          <ConfirmProvider>
            <ProxyModal />
            <ChangelogModal />
            <BrowserRouter>
              <AuthRecoveryHandler />
              <Routes>
                {/* Public Routes */}
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
                  <Route path="entry" element={<EntryPage />} />
                  <Route path="ledger" element={<LedgerPage />} />
                  <Route path="live" element={<LivePortfolioPage />} />
                </Route>

                <Route
                  path="/delete-account"
                  element={
                    <ProtectedRoute>
                      <DeleteAccountPage />
                    </ProtectedRoute>
                  }
                />

                {/* Catch all - unknown paths fall back to the app root */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </PortfolioProvider>
      </ProxyProvider>
    </AuthProvider>
    </>
  );
};

export default App;
