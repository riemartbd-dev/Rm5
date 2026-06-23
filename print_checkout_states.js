import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('=== Checkout States (Lines 330 to 365) ===');
  for (let i = 329; i < 365; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (err) {
  console.error(err);
}
