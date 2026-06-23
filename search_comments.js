import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  function findText(text) {
    const linesFound = [];
    lines.forEach((line, idx) => {
      if (line.includes(text)) {
        linesFound.push(idx + 1);
      }
    });
    console.log(`Occurrences of "${text}":`, linesFound);
  }

  findText('Global Luxury Header');
  findText('Dynamic Announcement Ribbon');
  findText('export default function App');
  findText('return (');
  findText('class App');
  findText('DICTIONARY =');
} catch (err) {
  console.error(err);
}
