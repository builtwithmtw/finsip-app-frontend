import React, { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return null; // Don't redirect while loading auth state
    }

    // There is no /login route: signed-out visitors get the login form in place,
    // so "/" is the login page until they authenticate.
    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
