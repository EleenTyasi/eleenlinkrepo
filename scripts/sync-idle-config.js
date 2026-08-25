const fs = require('fs');
const path = require('path');

const configJsonPath = path.join(__dirname, '..', 'config', 'idle-config.json');
const publicJsonPath = path.join(__dirname, '..', 'public', 'idle-config.json');
const publicJsPath = path.join(__dirname, '..', 'public', 'idle-config.js');

try {
  if (fs.existsSync(configJsonPath)) {
    const rawData = fs.readFileSync(configJsonPath, 'utf8');
    
    // 1. Copy config/idle-config.json -> public/idle-config.json
    fs.writeFileSync(publicJsonPath, rawData, 'utf8');
    
    // 2. Generate public/idle-config.js
    const jsContent = `window.IDLE_CONFIG = ${rawData.trim()};\n`;
    fs.writeFileSync(publicJsPath, jsContent, 'utf8');

    console.log('Successfully synced config/idle-config.json -> public/idle-config.js & public/idle-config.json!');
  } else {
    console.error('Error: config/idle-config.json not found!');
    process.exit(1);
  }
} catch (err) {
  console.error('Error syncing idle config:', err);
  process.exit(1);
}
