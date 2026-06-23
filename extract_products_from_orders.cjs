const fs = require('fs');
const DB_PATH = './db.json';

try {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const orders = db.orders || [];
  
  const productSummary = {};
  
  orders.forEach(order => {
    const items = order.items || [];
    items.forEach(item => {
      const id = item.productId || item.id;
      if (!id) return;
      if (!productSummary[id]) {
        productSummary[id] = {
          id: id,
          names: new Set(),
          prices: new Set(),
          images: new Set(),
          sku: item.sku,
          count: 0
        };
      }
      if (item.productNameEn || item.nameEn) productSummary[id].names.add(item.productNameEn || item.nameEn);
      if (item.nameEn) productSummary[id].names.add(item.nameEn);
      if (item.price) productSummary[id].prices.add(item.price);
      if (item.image) productSummary[id].images.add(item.image);
      productSummary[id].count += item.quantity || 1;
    });
  });

  console.log("=== Found unique products inside Orders ===");
  Object.keys(productSummary).forEach(id => {
    const p = productSummary[id];
    console.log(`- Product ID: ${id}`);
    console.log(`  Names: ${Array.from(p.names).join(', ')}`);
    console.log(`  Prices: ${Array.from(p.prices).join(', ')}`);
    console.log(`  Images length/existence: ${Array.from(p.images).map(img => img ? img.slice(0, 50) + '...' : 'none').join(', ')}`);
    console.log(`  SKU: ${p.sku}`);
  });
} catch (e) {
  console.error(e);
}
