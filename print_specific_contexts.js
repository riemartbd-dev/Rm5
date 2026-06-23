import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  function printContext(label, startLine, endLine) {
    console.log(`\n=== ${label} (Lines ${startLine} to ${endLine}) ===`);
    for (let i = startLine - 1; i < endLine; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }

  // print around 7310
  printContext("Error around 7310", 7290, 7330);
  
  // print around 7946
  printContext("Error around 7946", 7935, 7965);

  // print around 10405 to 10445
  printContext("Error around 10413", 10405, 10450);

} catch (err) {
  console.error(err);
}
