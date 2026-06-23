import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('Searching for return keyword in App...');
  const AppLineNum = 203; // function App
  for (let i = AppLineNum - 1; i < AppLineNum + 1500; i++) {
    if (lines[i].includes('return') && lines[i].includes('(')) {
      console.log(`Found return at line ${i + 1}: ${lines[i]}`);
    }
  }

} catch (err) {
  console.error(err);
}
