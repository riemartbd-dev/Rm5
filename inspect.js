import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  console.log('File size:', content.length, 'characters');
  console.log('First 500 characters of App.tsx:');
  console.log(content.slice(0, 500));
  
  // Check for any null bytes
  let nullCount = 0;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 0) nullCount++;
  }
  console.log('Number of null bytes:', nullCount);
  
} catch (err) {
  console.error(err);
}
