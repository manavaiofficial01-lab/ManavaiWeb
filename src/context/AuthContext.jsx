import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Hardcoded credentials for "normal login"
    const ADMIN_CREDENTIALS = {
        'karthikeyanj1980@gmail.com': '9842356432',
        'kmvignesh1406@gmail.com': '9842356432'
    };

    useEffect(() => {
        // Check for existing session in localStorage
        const storedUser = localStorage.getItem('admin_session');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        // Simulating a minor delay for security/premium feel
        await new Promise(resolve => setTimeout(resolve, 600));

        // 1. First, check if manual credentials match
        if (ADMIN_CREDENTIALS[email] && ADMIN_CREDENTIALS[email] === password) {

            // 2. Silently attempt to check ban status via Supabase
            // Even if providers are disabled, we attempt a sign-in to catch specific 'banned' errors
            const { error: sbError } = await supabase.auth.signInWithPassword({ email, password });

            // If Supabase specifically says the user is banned, block them completely
            if (sbError && (sbError.message.toLowerCase().includes('banned') || sbError.status === 403)) {
                return {
                    data: null,
                    error: { message: 'Access denied. This account has been banned by the administrator.' }
                };
            }

            // 3. Fallback: If no ban error occurred (even if provider is disabled), allow manual login
            const userData = {
                email,
                role: 'admin',
                lastLogin: new Date().toLocaleTimeString()
            };
            setUser(userData);
            localStorage.setItem('admin_session', JSON.stringify(userData));
            return { data: userData, error: null };
        }

        return {
            data: null,
            error: { message: 'Invalid email or password. Access denied.' }
        };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('admin_session');
        return { error: null };
    };

    const validateSession = async () => {
        if (!user) return true;

        try {
            // Check status with Supabase
            const { data: { user: sbUser }, error } = await supabase.auth.getUser();

            if (error) {
                console.warn('Sync Security Check: Authentication invalid.', error.message);
                // If any error occurs (Banned, Missing Session, Provider Disabled), kick to login
                logout();
                return false;
            }

            return true;
        } catch (err) {
            // Fail-safe for network issues
            return true;
        }
    };

    const isAuthorized = !!user;

    const value = {
        user,
        login,
        logout,
        loading,
        isAuthorized,
        validateSession
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
