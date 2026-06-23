const { execSync } = require('child_process');
try {
  console.log("Restoring src/App.tsx via git checkout...");
  execSync('git checkout src/App.tsx');
  console.log("Success! src/App.tsx has been restored.");
} catch (err) {
  console.error("Error executing git checkout:", err.message);
}
