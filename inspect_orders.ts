import fs from 'fs';
import path from 'path';

const DB_PATH = './db.json';

try {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const orders = db.orders || [];
  console.log(`Found ${orders.length} orders.`);
  
  if (orders.length > 0) {
    const sampleOrder = orders[0];
    console.log("Sample order keys:", Object.keys(sampleOrder));
    if (sampleOrder.items && sampleOrder.items.length > 0) {
      console.log("Sample order item keys:", Object.keys(sampleOrder.items[0]));
      console.log("Sample order item:", JSON.stringify(sampleOrder.items[0], null, 2).slice(0, 1000));
    }
  }
} catch (e: any) {
  console.error(e.message);
}
