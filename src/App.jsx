import React from 'react'
import Navbar from './components/Navbar/Navbar';
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import OrderTracking from './components/OrderTracking/OrderTracking';
import DriverDetails from './components/DriverDetails/DriverDetails';
import DaybyDayRevenue from './components/DaybyDayRevenue/DaybyDayRevenue';
import ProductUpload from './components/ProductUpload/ProductUpload';
import FoodUpload from './components/FoodUpload/FoodUpload';
import ProductManagement from './components/ProductManagement/ProductManagement';
import FoodManagement from './components/FoodManagement/FoodManagement';
import DriverTracking from './components/DriverTracking/DriverTracking';
import ManualOrderAssign from './components/ManualOrderAssign/ManualOrderAssign';
import AiOrderAssignment from './components/AiOrderAssignment/AiOrderAssignment';
import Login from './components/Login/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

const App = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <AuthProvider>
      {!isLoginPage && <Navbar />}
      <Routes>
        <Route path='/login' element={<Login />} />

        <Route path='/' element={<ProtectedRoute><ManualOrderAssign /></ProtectedRoute>} />
        <Route path='/order-tracking' element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
        <Route path='/driver-details' element={<ProtectedRoute><DriverDetails /></ProtectedRoute>} />
        <Route path='/revenue-daily' element={<ProtectedRoute><DaybyDayRevenue /></ProtectedRoute>} />
        <Route path="/product-upload" element={<ProtectedRoute><ProductUpload /></ProtectedRoute>} />
        <Route path='/food-upload' element={<ProtectedRoute><FoodUpload /></ProtectedRoute>} />
        <Route path='/product-management' element={<ProtectedRoute><ProductManagement /></ProtectedRoute>} />
        <Route path='/food-management' element={<ProtectedRoute><FoodManagement /></ProtectedRoute>} />
        <Route path='/driver-tracking' element={<ProtectedRoute><DriverTracking /></ProtectedRoute>} />
        <Route path='/assignment' element={<ProtectedRoute><AiOrderAssignment /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}

export default App