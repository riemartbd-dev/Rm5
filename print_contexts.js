import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  function printContext(lineNum, padding = 15) {
    console.log(`\n=== Line ${lineNum} context ===`);
    const start = Math.max(0, lineNum - padding - 1);
    const end = Math.min(lines.length, lineNum + padding);
    for (let i = start; i < end; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }

  // Print context for the major error locations
  printContext(7310);
  printContext(7946);
  printContext(9997);
  printContext(10413);
  printContext(10440);
  printContext(10647);
  printContext(12060);

} catch (err) {
  console.error(err);
}
