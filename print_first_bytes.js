import fs from 'fs';

try {
  const buf = fs.readFileSync('src/App.tsx');
  console.log('Buffer length:', buf.length);
  
  console.log('First 50 bytes (hex):', buf.slice(0, 50).toString('hex'));
  
  const chars = [];
  for (let i = 0; i < Math.min(buf.length, 50); i++) {
    chars.push(`${buf[i]} (${String.fromCharCode(buf[i])})`);
  }
  console.log('First 50 bytes decoded char by char:');
  console.log(chars.join(', '));
} catch (err) {
  console.error(err);
}
