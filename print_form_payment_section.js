import fs from 'fs';
try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');
  for (let i = 5130; i <= 5235; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (e) {
  console.error(e);
}
