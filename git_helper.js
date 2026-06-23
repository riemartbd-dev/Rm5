import { execSync } from 'child_process';

try {
  console.log('--- Git Status ---');
  try {
    console.log(execSync('git status', { encoding: 'utf8' }));
  } catch (err) {
    console.log('git status failed:', err.message);
  }

  console.log('\n--- Recent Git Commits ---');
  try {
    console.log(execSync('git log -n 10 --oneline', { encoding: 'utf8' }));
  } catch (err) {
    console.log('git log failed:', err.message);
  }

} catch (err) {
  console.error(err);
}
