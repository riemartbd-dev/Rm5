import fs from 'fs';
import path from 'path';

const DB_PATH = './db.json';

try {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const logs = db.logs || [];
  
  const creationLogs = logs.filter((log: any) => 
    log && log.messageEn && log.messageEn.toLowerCase().includes("deployed to market catalog")
  );
  
  console.log(`Found ${creationLogs.length} creation logs.`);
  if (creationLogs.length > 0) {
    console.log("First creation log sample:\n", JSON.stringify(creationLogs[0], null, 2).slice(0, 1000));
  }
} catch (e: any) {
  console.error(e.message);
}
