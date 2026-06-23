import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('=== Form Fields (Lines 10440 to 10600) ===');
  for (let i = 10439; i < 10600; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (err) {
  console.error(err);
}
