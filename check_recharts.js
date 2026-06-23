import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  function findTextPattern(pattern) {
    const linesFound = [];
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(pattern.toLowerCase())) {
        linesFound.push({ line: idx + 1, text: line.trim() });
      }
    });
    console.log(`\nOccurrences of "${pattern}" (count: ${linesFound.length}):`);
    const limit = 20;
    linesFound.slice(0, limit).forEach(item => {
      console.log(`Line ${item.line}: ${item.text}`);
    });
    if (linesFound.length > limit) {
      console.log(`... and ${linesFound.length - limit} more occurrences`);
    }
  }

  findTextPattern('recharts');
  findTextPattern('ResponsiveContainer');
  findTextPattern('AreaChart');
  findTextPattern('BarChart');
  findTextPattern('dashboard');
} catch (err) {
  console.error(err);
}
