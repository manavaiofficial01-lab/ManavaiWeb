const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('name, zone, category')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample Products:');
  console.log(JSON.stringify(data, null, 2));

  const { data: zones, error: zoneError } = await supabase
    .from('products')
    .select('zone')
    .not('zone', 'is', null);
  
  const uniqueZones = [...new Set((zones || []).map(z => z.zone))];
  console.log('Unique zones in products:', uniqueZones);
}

checkProducts();
