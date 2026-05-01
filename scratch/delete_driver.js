import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sszacqebobufsikbgcsq.supabase.co'
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzemFjcWVib2J1ZnNpa2JnY3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTg5ODEsImV4cCI6MjA3MjA3NDk4MX0.DJhutTA4SHatHccLP3N5G6dGkyGhWphPDGEJkbKdqAg"
const supabase = createClient(supabaseUrl, supabaseKey);

const driverPhone = '8940645818';
const driverName = 'sam';
const driverId = 62;

async function deleteDriverData() {
  console.log(`Starting deletion for driver: ${driverName} (${driverPhone}, ID: ${driverId})`);

  const tables = [
    { name: 'driver_daily_incentives', col: 'driver_mobile' },
    { name: 'driver_wallet', col: 'driver_mobile' },
    { name: 'driver_payouts', col: 'driver_mobile' },
    { name: 'driver_location_history', col: 'driver_phone' },
    { name: 'payout_requests', col: 'driver_mobile' },
    { name: 'driver_duty', col: 'driver_mobile' },
    { name: 'driver_duty_logs', col: 'driver_mobile' },
    { name: 'orders', col: 'driver_mobile' } // Careful here, orders might be needed for history, but user said "all information"
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table.name)
        .delete({ count: 'exact' })
        .eq(table.col, driverPhone);
      
      if (error) {
        console.error(`Error deleting from ${table.name}:`, error.message);
      } else {
        console.log(`Deleted ${count || 0} rows from ${table.name}`);
      }
    } catch (err) {
      console.error(`Exception deleting from ${table.name}:`, err.message);
    }
  }

  // Finally delete from driver table
  try {
    const { error } = await supabase
      .from('driver')
      .delete()
      .eq('id', driverId);
    
    if (error) {
      console.error(`Error deleting from driver table:`, error.message);
    } else {
      console.log(`Successfully deleted driver from 'driver' table.`);
    }
  } catch (err) {
    console.error(`Exception deleting from driver table:`, err.message);
  }
}

deleteDriverData();
