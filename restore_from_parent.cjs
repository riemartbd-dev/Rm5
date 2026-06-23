const { execSync } = require('child_process');
const paths = ['.', '..', '../..', '/app', '/'];
for (const p of paths) {
  try {
    console.log(`Trying git checkout in ${p}...`);
    execSync('git checkout src/App.tsx', { cwd: p, stdio: 'inherit' });
    console.log(`Success in ${p}!`);
    break;
  } catch (err) {
    console.log(`Failed in ${p}: ${err.message}`);
  }
}
