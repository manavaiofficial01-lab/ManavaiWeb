import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const menuItems = useMemo(() => [
    { id: 1, name: 'Manual Order Assign', icon: '📋', path: '/' },
    { id: 10, name: 'AI Order Assignment', icon: '🤖', path: '/assignment' },
    { id: 2, name: 'Order Tracking', icon: '🚚', path: '/order-tracking' },
    { id: 3, name: 'Driver Details', icon: '👨‍💼', path: '/driver-details' },
    { id: 4, name: 'Driver Tracking', icon: '🧭', path: '/driver-tracking' }, // ← Inserted here
    { id: 5, name: 'Day By Day Revenue', icon: '📈', path: '/revenue-daily' },
    { id: 6, name: 'Product Upload', icon: '📤', path: '/product-upload' },
    { id: 7, name: 'Product Management', icon: '📦', path: '/product-management' },
    { id: 8, name: 'Food Upload', icon: '🍕', path: '/food-upload' },
    { id: 9, name: 'Food Management', icon: '🍽️', path: '/food-management' },
  ], []);



  const activeMenu = useMemo(() => {
    const currentItem = menuItems.find(item => item.path === location.pathname);
    return currentItem ? currentItem.name : '';
  }, [location.pathname, menuItems]);

  const handleMenuClick = useCallback((menuName, path) => {
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
    navigate(path);
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, [logout, navigate]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSidebarOpen]);

  return (
    <>
      {/* Main Navbar */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">
            ☰
          </button>
          <span className="navbar-brand">Manavai Admin</span>
        </div>

        <div className="navbar-right">
          <div className="user-info">
            <span className="user-name">{user?.email?.split('@')[0] || 'Admin User'}</span>
            <span className="user-status">● Online</span>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-info">
            <h2>Dashboard</h2>
            <p className="brand-subtitle">Management System</p>
          </div>
          <button className="close-btn" onClick={toggleSidebar} aria-label="Close menu">
            ×
          </button>
        </div>

        <div className="sidebar-menu">
          {menuItems.map(item => (
            <div
              key={item.id}
              className={`menu-item ${activeMenu === item.name ? 'active' : ''}`}
              onClick={() => handleMenuClick(item.name, item.path)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleMenuClick(item.name, item.path);
                }
              }}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-text">{item.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="status-indicator"></div>
            </div>
            <div className="profile-info">
              <div className="profile-name-row">
                <div className="profile-name">{user?.email?.split('@')[0] || 'Admin User'}</div>
                <div className="admin-badge">Verified</div>
              </div>
              <div className="profile-role">{user?.email || 'Administrator'}</div>
            </div>
          </div>
          <div
            className="menu-item logout-item"
            onClick={handleLogout}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleLogout();
              }
            }}
          >
            <span className="menu-icon">🚪</span>
            <span className="menu-text">Logout</span>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isSidebarOpen && <div className="overlay" onClick={toggleSidebar}></div>}
    </>
  );
};

export default Navbar;
