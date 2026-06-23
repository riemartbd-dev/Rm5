const http = require('http');

http.get('http://localhost:3000/api/sync/get', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const dbState = JSON.parse(data);
      const products = dbState.products || [];
      console.log(`Live Server products count: ${products.length}`);
    } catch (e) {
      console.error("Failed to parse live server response:", e.message);
    }
  });
}).on('error', (err) => {
  console.error("Failed to query live server:", err.message);
});
