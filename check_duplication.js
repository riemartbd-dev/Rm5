import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('File length:', lines.length, 'lines');

  // Let's search for "RENDER SYSTEM DRAWER"
  const systemDrawers = [];
  lines.forEach((line, index) => {
    if (line.includes('RENDER SYSTEM DRAWER')) {
      systemDrawers.push(index + 1);
    }
  });
  console.log('Occurrences of RENDER SYSTEM DRAWER:', systemDrawers);

  // Let's search for how many times the header or similar components open/close
  const headers = [];
  lines.forEach((line, index) => {
    if (line.includes('<header')) {
      headers.push(index + 1);
    }
  });
  console.log('Occurrences of "<header":', headers);

} catch (err) {
  console.error(err);
}
