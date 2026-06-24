import fs from 'fs';

try {
  const content = fs.readFileSync('db.json', 'utf8');
  console.log('db.json length:', content.length);
  
  const parsed = JSON.parse(content);
  console.log('Successfully parsed db.json! Keys:', Object.keys(parsed));
  if (parsed.products) console.log('Products count:', parsed.products.length);
  if (parsed.orders) console.log('Orders count:', parsed.orders.length);
} catch (e) {
  console.error('FAIL JSON PARSING:', e);
}

