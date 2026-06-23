const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'db.json');
try {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log("Current db.json products count:", db.products ? db.products.length : "undefined");
} catch (e) {
  console.error("Error:", e.message);
}
