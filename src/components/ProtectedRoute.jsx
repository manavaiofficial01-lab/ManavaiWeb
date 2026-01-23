import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { user, isAuthorized, loading, validateSession } = useAuth();
    const location = useLocation();

    useEffect(() => {
        // Validate user status in DB on every mount/navigation
        if (user) {
            validateSession();
        }
    }, [location.pathname, user]); // Run on mount and path changes

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#050505',
                color: '#fff'
            }}>
                Loading session...
            </div>
        );
    }

    if (!user || !isAuthorized) {
        return <Navigate to="/login" />;
    }

    return children;
};

export default ProtectedRoute;
