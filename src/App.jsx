import React from 'react'
import OrderAssign from './components/OrderAssign/OrderAssign'
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import OrderTracking from './components/OrderTracking/OrderTracking';
import DriverDetails from './components/DriverDetails/DriverDetails';
import DaybyDayRevenue from './components/DaybyDayRevenue/DaybyDayRevenue';
import ProductUpload from './components/ProductUpload/ProductUpload';
import FoodUpload from './components/FoodUpload/FoodUpload';
import ProductManagement from './components/ProductManagement/ProductManagement';
import FoodManagement from './components/FoodManagement/FoodManagement';
import DriverTracking from './components/DriverTracking/DriverTracking';
const App = () => {
  return (
    <>
      <Routes>
        <Route path='/' element={<OrderAssign/>} />
        <Route path='/order-tracking' element={<OrderTracking/>} />
        <Route path='/driver-details' element={<DriverDetails/>}/>
        <Route path='/revenue-daily'  element={<DaybyDayRevenue />}/>
        <Route path="/product-upload" element={<ProductUpload/>}/>
        <Route path='/food-upload' element={<FoodUpload/>} />
        <Route path='/product-management' element={<ProductManagement/>}/>
        <Route path='/food-management' element={<FoodManagement/>} />
        <Route path='/driver-tracking' element={<DriverTracking/>} />
      </Routes>
    </>

  )
}

export default App