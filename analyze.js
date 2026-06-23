import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  console.log('Total characters:', content.length);
  
  // Find occurrences of various clean elements
  const searchFor = (str) => {
    let idx = -1;
    const occurrences = [];
    while ((idx = content.indexOf(str, idx + 1)) !== -1) {
      occurrences.push(idx);
    }
    console.log(`Occurrences of "${str}":`, occurrences);
  };
  
  searchFor('{/* RENDER SYSTEM DRAWER */}');
  searchFor('isCartOpen');
  searchFor('handleReorder');
  searchFor('selectedProduct');
} catch (err) {
  console.log(err);
}
