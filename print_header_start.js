import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('=== Lines 4500 to 4545 ===');
  for (let i = 4499; i < 4545; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (err) {
  console.error(err);
}
