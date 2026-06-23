import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('Atelier Statistics Grid')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} catch (err) {
  console.error(err);
}
