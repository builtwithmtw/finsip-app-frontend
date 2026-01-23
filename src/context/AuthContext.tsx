import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    login: (pin: string) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In a real app, this would be an env variable or hashed
const APP_PIN = "2026";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return localStorage.getItem('sip_tracker_auth') === 'true';
    });

    const login = (pin: string) => {
        if (pin === APP_PIN) {
            setIsAuthenticated(true);
            localStorage.setItem('sip_tracker_auth', 'true');
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('sip_tracker_auth');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
