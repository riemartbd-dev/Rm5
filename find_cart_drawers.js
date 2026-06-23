import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  function findTextPattern(pattern) {
    const linesFound = [];
    lines.forEach((line, idx) => {
      if (line.includes(pattern)) {
        linesFound.push({ line: idx + 1, text: line.trim() });
      }
    });
    console.log(`\nOccurrences of "${pattern}" (count: ${linesFound.length}):`);
    linesFound.forEach(item => {
      console.log(`Line ${item.line}: ${item.text}`);
    });
  }

  findTextPattern('cartDrawerTab');
} catch (err) {
  console.error(err);
}
