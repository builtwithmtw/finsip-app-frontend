import React, { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
