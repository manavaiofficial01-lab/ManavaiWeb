const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sszacqebobufsikbgcsq.supabase.co'
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzemFjcWVib2J1ZnNpa2JnY3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTg5ODEsImV4cCI6MjA3MjA3NDk4MX0.DJhutTA4SHatHccLP3N5G6dGkyGhWphPDGEJkbKdqAg"
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProductLimit() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', '%3 Roses Natural%')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Product Found:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('Product not found');
  }
}

checkProductLimit();
