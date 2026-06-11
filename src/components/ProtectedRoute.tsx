import React, { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return null; // Don't redirect while loading auth state
    }

    if (!isAuthenticated) {
        return <Navigate to="/welcome" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
