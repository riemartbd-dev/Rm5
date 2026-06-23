import fs from 'fs';
import path from 'path';

function scanDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.includes('node_modules') || file.includes('.npm') || file.includes('.cache')) continue;
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.toLowerCase().includes('app') && (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.bak'))) {
          console.log('Match:', fullPath, 'size:', stat.size);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('Scanning current directory...');
scanDir('.');
console.log('Scanning /tmp directory...');
scanDir('/tmp');
console.log('Done.');
