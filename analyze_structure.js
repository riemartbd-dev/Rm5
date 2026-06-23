import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');
  console.log('Total lines:', lines.length);

  // Find all lines with imports
  const importLines = [];
  lines.forEach((line, index) => {
    if (line.trim().startsWith('import ')) {
      importLines.push({ lineNum: index + 1, content: line });
    }
  });
  console.log('Import statement count:', importLines.length);
  if (importLines.length > 5) {
    console.log('First 5 imports:', importLines.slice(0, 5));
    console.log('Last 5 imports:', importLines.slice(-5));
  } else {
    console.log('All imports:', importLines);
  }

  // Find occurrences of key markers or components
  const searchTerms = [
    'export default function App',
    'function App',
    'const App =',
    'class App ',
    '== HEADER ==',
    '== HERO ==',
    '== FOOTER =='
  ];
  
  searchTerms.forEach(term => {
    const matches = [];
    lines.forEach((line, index) => {
      if (line.includes(term)) {
        matches.push(index + 1);
      }
    });
    console.log(`Term "${term}" found at lines:`, matches);
  });

  // Let's print some lines around the first error location around line 4564
  console.log('--- Lines 4550 to 4585 ---');
  for (let i = 4549; i < Math.min(4585, lines.length); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }

} catch (err) {
  console.error(err);
}
