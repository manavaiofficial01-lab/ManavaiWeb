import React, { useState, useEffect } from 'react'
import "./DriverDetails.css"
import Navbar from '../Navbar/Navbar'
import { supabase } from '../../../supabase';

const DriverDetails = () => {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverEarnings, setDriverEarnings] = useState([]);
  const [dailySettlements, setDailySettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: '',
    phone: '',
    password: ''
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('driver')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDrivers(data || []);
      if (data && data.length > 0) {
        setSelectedDriver(data[0]);
        fetchDriverEarnings(data[0].driver_phone);
        fetchSettlements(data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch drivers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverEarnings = async (driverPhone) => {
    try {
      const { data, error } = await supabase
        .from('order_earnings')
        .select('*')
        .eq('driver_mobile', driverPhone)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDriverEarnings(data || []);
    } catch (err) {
      setError('Failed to fetch earnings: ' + err.message);
    }
  };

  const fetchSettlements = async (driverId) => {
    try {
      // First check if settlements table exists
      const { data: settlements, error } = await supabase
        .from('driver_settlements')
        .select('*')
        .eq('driver_id', driverId)
        .order('settlement_date', { ascending: false });

      if (error && error.code === '42P01') {
        // Table doesn't exist, calculate from order_earnings
        calculateDailySettlementsFromEarnings();
        return;
      } else if (error) {
        throw error;
      }

      // If we have settlements data, use it
      if (settlements && settlements.length > 0) {
        setDailySettlements(settlements);
      } else {
        // Otherwise calculate from earnings
        calculateDailySettlementsFromEarnings();
      }
    } catch (err) {
      console.error('Failed to fetch settlements:', err.message);
      // Fallback to calculating from earnings
      calculateDailySettlementsFromEarnings();
    }
  };

  const calculateDailySettlementsFromEarnings = () => {
    try {
      // Calculate settlements from completed and settled earnings
      const settledEarnings = driverEarnings.filter(earning => 
        earning.status === 'completed' && earning.is_settled
      );

      if (settledEarnings.length === 0) {
        setDailySettlements([]);
        return;
      }

      const dailyData = settledEarnings.reduce((acc, earning) => {
        const date = new Date(earning.created_at).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = {
            date,
            totalEarnings: 0,
            deliveries: 0
          };
        }
        acc[date].totalEarnings += parseFloat(earning.driver_earning || 0);
        acc[date].deliveries += 1;
        return acc;
      }, {});

      const settlements = Object.values(dailyData).sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      setDailySettlements(settlements);
    } catch (err) {
      console.error('Error calculating settlements:', err);
      setDailySettlements([]);
    }
  };

  const handleDriverSelect = (driver) => {
    setSelectedDriver(driver);
    fetchDriverEarnings(driver.driver_phone);
    fetchSettlements(driver.id);
    setActiveTab('details');
  };

  const calculateDriverStats = () => {
    if (!selectedDriver) return {};
    
    const completedEarnings = driverEarnings.filter(earning => 
      earning.status === 'completed'
    );
    
    const totalEarnings = completedEarnings.reduce((sum, earning) => 
      sum + parseFloat(earning.driver_earning || 0), 0
    );
    
    const totalDeliveries = completedEarnings.length;
    const avgEarning = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
    
    const pendingEarnings = driverEarnings
      .filter(earning => earning.status === 'pending')
      .reduce((sum, earning) => sum + parseFloat(earning.driver_earning || 0), 0);

    // Calculate unsettled earnings (completed but not settled)
    const unsettledEarnings = completedEarnings
      .filter(earning => !earning.is_settled)
      .reduce((sum, earning) => sum + parseFloat(earning.driver_earning || 0), 0);

    return {
      totalEarnings,
      totalDeliveries,
      avgEarning,
      pendingEarnings,
      unsettledEarnings
    };
  };

  const createDriverAccount = async (driverData) => {
    try {
      setCreating(true);
      setError('');
      setSuccess('');

      if (!driverData.name.trim() || !driverData.phone.trim() || !driverData.password.trim()) {
        throw new Error('All fields are required');
      }

      if (driverData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { data, error } = await supabase
        .from('driver')
        .insert([{
          driver_name: driverData.name.trim(),
          driver_phone: driverData.phone.trim(),
          password: driverData.password,
          status: 'offline',
          latitude: null,
          longitude: null
        }])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setDrivers(prev => [data[0], ...prev]);
        setSelectedDriver(data[0]);
        fetchDriverEarnings(data[0].driver_phone);
        fetchSettlements(data[0].id);
        setNewDriver({ name: '', phone: '', password: '' });
        setShowCreateForm(false);
        setSuccess('Driver account created successfully!');
        setTimeout(() => setSuccess(''), 3000);
        return true;
      }
    } catch (err) {
      setError('Failed to create driver account: ' + err.message);
      return false;
    } finally {
      setCreating(false);
    }
  };

  const deleteDriverAccount = async (driverId) => {
    if (!window.confirm('Are you sure you want to delete this driver account? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      setError('');
      
      const { error } = await supabase
        .from('driver')
        .delete()
        .eq('id', driverId);

      if (error) throw error;

      // Update local state
      const updatedDrivers = drivers.filter(driver => driver.id !== driverId);
      setDrivers(updatedDrivers);
      
      if (selectedDriver && selectedDriver.id === driverId) {
        setSelectedDriver(updatedDrivers.length > 0 ? updatedDrivers[0] : null);
        if (updatedDrivers.length > 0) {
          fetchDriverEarnings(updatedDrivers[0].driver_phone);
          fetchSettlements(updatedDrivers[0].id);
        } else {
          setDriverEarnings([]);
          setDailySettlements([]);
        }
      }

      setSuccess('Driver account deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete driver account: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const markAsSettled = async (driverId) => {
    try {
      setSettling(true);
      setError('');

      // Get completed but unsettled earnings
      const unsettledEarnings = driverEarnings.filter(earning => 
        earning.status === 'completed' && !earning.is_settled
      );

      if (unsettledEarnings.length === 0) {
        setError('No unsettled earnings found for this driver');
        return;
      }

      // Calculate total amount
      const totalAmount = unsettledEarnings.reduce((sum, earning) => 
        sum + parseFloat(earning.driver_earning || 0), 0
      );

      // Create settlement record
      const settlementDate = new Date().toISOString().split('T')[0];
      
      const { data: settlement, error: settlementError } = await supabase
        .from('driver_settlements')
        .insert([{
          driver_id: driverId,
          settlement_date: settlementDate,
          total_earnings: totalAmount,
          total_deliveries: unsettledEarnings.length,
          status: 'processed'
        }])
        .select()
        .single();

      if (settlementError && settlementError.code !== '42P01') {
        // Only throw error if it's not "table doesn't exist"
        throw settlementError;
      }

      // Mark earnings as settled in order_earnings table
      const { error: updateError } = await supabase
        .from('order_earnings')
        .update({ is_settled: true })
        .in('id', unsettledEarnings.map(e => e.id));

      if (updateError) throw updateError;

      // Refresh data
      fetchDriverEarnings(selectedDriver.driver_phone);
      fetchSettlements(driverId);

      setSuccess(`Successfully settled ₹${totalAmount.toFixed(2)} for ${unsettledEarnings.length} deliveries!`);
      setTimeout(() => setSuccess(''), 5000);

    } catch (err) {
      if (err.code === '42P01') {
        // Table doesn't exist, just mark earnings as settled
        const { error: updateError } = await supabase
          .from('order_earnings')
          .update({ is_settled: true })
          .in('id', unsettledEarnings.map(e => e.id));

        if (updateError) throw updateError;

        fetchDriverEarnings(selectedDriver.driver_phone);
        fetchSettlements(driverId);

        setSuccess(`Successfully settled ₹${totalAmount.toFixed(2)} for ${unsettledEarnings.length} deliveries!`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError('Failed to process settlement: ' + err.message);
      }
    } finally {
      setSettling(false);
    }
  };

  // Check if driver has unsettled earnings
  const hasUnsettledEarnings = () => {
    return driverEarnings.some(earning => 
      earning.status === 'completed' && !earning.is_settled
    );
  };

  const getUnsettledAmount = () => {
    return driverEarnings
      .filter(earning => earning.status === 'completed' && !earning.is_settled)
      .reduce((sum, earning) => sum + parseFloat(earning.driver_earning || 0), 0);
  };

  const getUnsettledCount = () => {
    return driverEarnings.filter(earning => 
      earning.status === 'completed' && !earning.is_settled
    ).length;
  };

  const handleCreateDriver = (e) => {
    e.preventDefault();
    createDriverAccount(newDriver);
  };

  // Safe function to get total earnings with fallback
  const getTotalEarnings = (day) => {
    return day?.total_earnings || day?.totalEarnings || 0;
  };

  // Safe function to get deliveries count with fallback
  const getDeliveriesCount = (day) => {
    return day?.total_deliveries || day?.deliveries || 0;
  };

  // Safe function to get date with fallback
  const getDate = (day) => {
    return day?.settlement_date || day?.date || 'Unknown Date';
  };

  const stats = calculateDriverStats();

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading">Loading driver data...</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="driver-details-container">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        
        <div className="driver-header">
          <div className="header-top">
            <h1>Driver Management</h1>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : '+ Add New Driver'}
            </button>
          </div>
          <p>Manage driver accounts, track earnings, and monitor performance</p>
        </div>

        {showCreateForm && (
          <div className="section-card create-driver-form">
            <h3>Create New Driver Account</h3>
            <form onSubmit={handleCreateDriver}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Driver Name *</label>
                  <input
                    type="text"
                    placeholder="Enter driver full name"
                    value={newDriver.name}
                    onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="+91XXXXXXXXXX"
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={newDriver.password}
                    onChange={(e) => setNewDriver({...newDriver, password: e.target.value})}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Driver Account'}
                </button>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="section-card">
          <div className="section-header">
            <h3>All Drivers ({drivers.length})</h3>
            <div className="tab-navigation">
              <button 
                className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                Driver Details
              </button>
              <button 
                className={`tab-btn ${activeTab === 'earnings' ? 'active' : ''}`}
                onClick={() => setActiveTab('earnings')}
              >
                Earnings History
              </button>
              <button 
                className={`tab-btn ${activeTab === 'settlements' ? 'active' : ''}`}
                onClick={() => setActiveTab('settlements')}
              >
                Daily Settlements
              </button>
            </div>
          </div>
          
          <div className="drivers-grid">
            {drivers.map(driver => (
              <div
                key={driver.id}
                className={`driver-card ${selectedDriver?.id === driver.id ? 'selected' : ''}`}
                onClick={() => handleDriverSelect(driver)}
              >
                <div className="driver-card-header">
                  <div className="driver-avatar">
                    {driver.driver_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="driver-info">
                    <h4>{driver.driver_name}</h4>
                    <p>{driver.driver_phone}</p>
                  </div>
                </div>
                <div className="driver-card-footer">
                  <span className={`driver-status status-${driver.status}`}>
                    {driver.status}
                  </span>
                  <span className="driver-since">
                    Since {new Date(driver.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedDriver && (
          <>
            <div className="driver-stats">
              <div className="stat-card">
                <div className="stat-value">₹{stats.totalEarnings.toFixed(2)}</div>
                <div className="stat-label">Total Earnings</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalDeliveries}</div>
                <div className="stat-label">Completed Deliveries</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">₹{stats.avgEarning.toFixed(2)}</div>
                <div className="stat-label">Avg per Delivery</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">₹{stats.unsettledEarnings.toFixed(2)}</div>
                <div className="stat-label">Ready to Settle</div>
              </div>
            </div>

            {activeTab === 'details' && (
              <div className="driver-sections">
                <div className="section-card">
                  <h3>Driver Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Name:</span>
                      <span className="info-value">{selectedDriver.driver_name}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Phone:</span>
                      <span className="info-value">{selectedDriver.driver_phone}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Status:</span>
                      <span className={`driver-status status-${selectedDriver.status}`}>
                        {selectedDriver.status}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Last Login:</span>
                      <span className="info-value">
                        {selectedDriver.logined_at ? new Date(selectedDriver.logined_at).toLocaleString() : 'Never'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Account Created:</span>
                      <span className="info-value">
                        {new Date(selectedDriver.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedDriver.latitude && selectedDriver.longitude && (
                      <div className="info-item">
                        <span className="info-label">Location:</span>
                        <span className="info-value">
                          {selectedDriver.latitude.toFixed(4)}, {selectedDriver.longitude.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="driver-actions">
                    <button 
                      className="btn btn-success"
                      onClick={() => markAsSettled(selectedDriver.id)}
                      disabled={settling || !hasUnsettledEarnings()}
                    >
                      {settling ? (
                        <div className="user-loader">
                          <div className="loader-spinner"></div>
                          Processing Settlement...
                        </div>
                      ) : (
                        `Settle ₹${getUnsettledAmount().toFixed(2)}`
                      )}
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => deleteDriverAccount(selectedDriver.id)}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <div className="user-loader">
                          <div className="loader-spinner"></div>
                          Deleting...
                        </div>
                      ) : (
                        'Delete Driver'
                      )}
                    </button>
                  </div>

                  {hasUnsettledEarnings() && (
                    <div className="settlement-alert">
                      <h4>Ready for Settlement</h4>
                      <p>
                        {getUnsettledCount()} completed deliveries ready for settlement. Total: ₹{getUnsettledAmount().toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="section-card">
                  <h3>Recent Earnings</h3>
                  {driverEarnings.length > 0 ? (
                    <table className="earnings-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Settled</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverEarnings.slice(0, 5).map(earning => (
                          <tr key={earning.id}>
                            <td className="order-id">#{earning.order_id}</td>
                            <td className="amount-positive">
                              ₹{parseFloat(earning.driver_earning || 0).toFixed(2)}
                            </td>
                            <td>
                              <span className={`status-badge status-${earning.status}`}>
                                {earning.status}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${earning.is_settled ? 'status-completed' : 'status-pending'}`}>
                                {earning.is_settled ? 'Settled' : 'Pending'}
                              </span>
                            </td>
                            <td>{new Date(earning.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No earnings data found</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'earnings' && (
              <div className="section-card">
                <h3>Earnings History - {selectedDriver.driver_name}</h3>
                {driverEarnings.length > 0 ? (
                  <div className="table-container">
                    <table className="earnings-table full-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Restaurant</th>
                          <th>Distance</th>
                          <th>Delivery Fee</th>
                          <th>Driver Earning</th>
                          <th>Payment Method</th>
                          <th>Status</th>
                          <th>Settled</th>
                          <th>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverEarnings.map(earning => (
                          <tr key={earning.id}>
                            <td className="order-id">#{earning.order_id}</td>
                            <td>{earning.restaurant_name || 'N/A'}</td>
                            <td>{earning.delivery_distance_km ? `${earning.delivery_distance_km} km` : 'N/A'}</td>
                            <td>₹{parseFloat(earning.delivery_charges || 0).toFixed(2)}</td>
                            <td className="amount-positive">
                              ₹{parseFloat(earning.driver_earning || 0).toFixed(2)}
                            </td>
                            <td>
                              <span className={`payment-method ${earning.payment_method}`}>
                                {earning.payment_method}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge status-${earning.status}`}>
                                {earning.status}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${earning.is_settled ? 'status-completed' : 'status-pending'}`}>
                                {earning.is_settled ? 'Settled' : 'Pending'}
                              </span>
                            </td>
                            <td>{new Date(earning.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="no-data">No earnings history found</div>
                )}
              </div>
            )}

            {activeTab === 'settlements' && (
              <div className="section-card">
                <h3>Daily Settlements - {selectedDriver.driver_name}</h3>
                {dailySettlements.length > 0 ? (
                  <div className="table-container">
                    <table className="settlements-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Total Deliveries</th>
                          <th>Total Earnings</th>
                          <th>Average per Delivery</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailySettlements.map((day, index) => {
                          const totalEarnings = getTotalEarnings(day);
                          const deliveries = getDeliveriesCount(day);
                          const avgEarning = deliveries > 0 ? totalEarnings / deliveries : 0;
                          
                          return (
                            <tr key={index}>
                              <td className="settlement-date">
                                <strong>{getDate(day)}</strong>
                              </td>
                              <td className="delivery-count">{deliveries}</td>
                              <td className="amount-positive">
                                <strong>₹{totalEarnings.toFixed(2)}</strong>
                              </td>
                              <td className="avg-earning">
                                ₹{avgEarning.toFixed(2)}
                              </td>
                              <td>
                                <span className="status-badge status-completed">
                                  Settled
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="no-data">No settled earnings found</div>
                )}
                
                {dailySettlements.length > 0 && (
                  <div className="settlement-summary">
                    <div className="summary-card">
                      <h4>Total Settlement</h4>
                      <div className="summary-amount">
                        ₹{dailySettlements.reduce((sum, day) => sum + getTotalEarnings(day), 0).toFixed(2)}
                      </div>
                      <p>Across {dailySettlements.length} days</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {drivers.length === 0 && !loading && !showCreateForm && (
          <div className="no-data">
            <h3>No Drivers Found</h3>
            <p>Create your first driver account to get started</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
            >
              Create Driver Account
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default DriverDetails;