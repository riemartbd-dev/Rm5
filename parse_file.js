import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');
  console.log('Total characters:', content.length);
  console.log('Total lines:', lines.length);

  // Find blocks of code that are highly similar or identical
  // Let's divide the file into 100-line chunks and check similarity
  const chunks = [];
  const chunkSize = 100;
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunkText = lines.slice(i, i + chunkSize).join('\n');
    chunks.push({ index: i, text: chunkText });
  }

  console.log('Comparing chunks...');
  const duplicates = [];
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      // Calculate a very simple hash or compare subset lines
      const linesI = lines.slice(chunks[i].index + 20, chunks[i].index + 80).join('\n').trim();
      const linesJ = lines.slice(chunks[j].index + 20, chunks[j].index + 80).join('\n').trim();
      
      if (linesI.length > 200 && linesI === linesJ) {
        duplicates.push({
          chunk1: chunks[i].index,
          chunk2: chunks[j].index,
          length: linesI.length
        });
      }
    }
  }

  console.log('Exact 60-line block duplicates matched:');
  console.log(duplicates);

} catch (err) {
  console.error(err);
}
