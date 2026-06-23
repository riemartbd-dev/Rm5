import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('=== Lines 10340 to 10460 ===');
  for (let i = 10339; i < 10460; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (err) {
  console.error(err);
}
