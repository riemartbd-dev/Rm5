import fs from 'fs';

try {
  const buf = fs.readFileSync('src/App.tsx');
  let invalidCount = 0;
  const invalidPositions = [];
  
  for (let i = 0; i < buf.length; i++) {
    const code = buf[i];
    // Check for control characters that are not tab (9), LF (10), CR (13)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      invalidCount++;
      if (invalidPositions.length < 20) {
        invalidPositions.push({ pos: i, code, surroundingText: buf.slice(Math.max(0, i - 10), Math.min(buf.length, i + 10)).toString('ascii') });
      }
    }
  }
  
  console.log('Total control characters found:', invalidCount);
  if (invalidCount > 0) {
    console.log('First 20 control characters details:', invalidPositions);
  }
} catch (err) {
  console.error(err);
}
