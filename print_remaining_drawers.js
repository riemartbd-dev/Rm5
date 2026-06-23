import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('=== Remaining App.tsx (Lines 10640 to 11000) ===');
  for (let i = 10639; i < Math.min(11000, lines.length); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (err) {
  console.error(err);
}
