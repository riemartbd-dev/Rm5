import fs from 'fs';
import path from 'path';

function findFile(dir: string, fileNamePattern: string): string[] {
  let results: string[] = [];
  try {
    // Skip system virtual mounts to avoid slow searches or hangs
    if (dir === '/proc' || dir === '/sys' || dir === '/dev' || dir === '/var/lib/docker') {
      return results;
    }
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(findFile(fullPath, fileNamePattern));
      } else if (file.includes(fileNamePattern)) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

async function main() {
  console.log("Searching root filesystem / for transcript.jsonl...");
  const matchedFiles = findFile('/', 'transcript.jsonl');
  console.log(`Matched files:`, matchedFiles);
  
  for (const filePath of matchedFiles) {
    try {
      console.log(`Reading file: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Let's find the RESTORED_PRODUCTS array in the trace
      const keyword = 'RESTORED_PRODUCTS';
      const index = content.indexOf(keyword);
      if (index !== -1) {
        console.log(`Found RESTORED_PRODUCTS in ${filePath} at index ${index}!`);
        // Let's extract a good chunk around it
        const start = Math.max(0, index - 200);
        const end = Math.min(content.length, index + 350000); // product list with base64 images can be quite large
        const chunk = content.substring(start, end);
        
        // Let's write the chunk to a local file for us to inspect or use
        fs.writeFileSync('./found_chunk.txt', chunk, 'utf8');
        console.log("Wrote matching chunk of size", chunk.length, "to ./found_chunk.txt");
        break;
      }
    } catch (err: any) {
      console.error(`Error reading ${filePath}: ${err.message}`);
    }
  }
}

main();
