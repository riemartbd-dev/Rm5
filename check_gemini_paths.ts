import fs from 'fs';
import path from 'path';

const pathsToCheck = [
  '/.gemini/antigravity/brain/ff4cbee3-35f5-47ac-9f5c-4456f4d5c32c/.system_generated/logs/transcript.jsonl',
  '../.gemini/antigravity/brain/ff4cbee3-35f5-47ac-9f5c-4456f4d5c32c/.system_generated/logs/transcript.jsonl',
  '../../.gemini/antigravity/brain/ff4cbee3-35f5-47ac-9f5c-4456f4d5c32c/.system_generated/logs/transcript.jsonl',
  '../../../.gemini/antigravity/brain/ff4cbee3-35f5-47ac-9f5c-4456f4d5c32c/.system_generated/logs/transcript.jsonl',
  './.gemini/antigravity/brain/ff4cbee3-35f5-47ac-9f5c-4456f4d5c32c/.system_generated/logs/transcript.jsonl',
];

for (const p of pathsToCheck) {
  try {
    const resolved = path.resolve(p);
    const exists = fs.existsSync(resolved);
    console.log(`Path [${p}] -> Resolved [${resolved}] -> Exists: ${exists}`);
    if (exists) {
      // Print first 500 chars to verify
      const content = fs.readFileSync(resolved, 'utf8');
      console.log(`Successfully found transcript! Length: ${content.length}`);
    }
  } catch (err: any) {
    console.error(`Error checking ${p}: ${err.message}`);
  }
}
