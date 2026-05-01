import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sszacqebobufsikbgcsq.supabase.co'
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzemFjcWVib2J1ZnNpa2JnY3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTg5ODEsImV4cCI6MjA3MjA3NDk4MX0.DJhutTA4SHatHccLP3N5G6dGkyGhWphPDGEJkbKdqAg"
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDriver() {
  const { data, error } = await supabase
    .from('driver')
    .select('*')
    .ilike('driver_name', '%sam%');

  if (error) {
    console.error('Error fetching driver:', error);
    return;
  }

  if (data.length > 0) {
    console.log('Found drivers named Sam:');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('No driver named Sam found.');
  }
}

checkDriver();
