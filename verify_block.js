import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('=== Lines 7180 to 7350 ===');
  for (let i = 7179; i < 7350; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (err) {
  console.error(err);
}
