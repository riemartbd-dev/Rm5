import fs from 'fs';
import path from 'path';

function searchBackups(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.includes('node_modules') || file.includes('.npm') || file.includes('.cache')) continue;
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchBackups(fullPath);
        } else if (file.includes('App.tsx') || file.includes('App') && file.includes('.ts')) {
          console.log('Found match:', fullPath, 'size:', stat.size);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('Searching file system for backups of App.tsx...');
searchBackups('/');
console.log('Done.');
