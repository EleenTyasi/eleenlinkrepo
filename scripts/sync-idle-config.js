const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'idle-config.json');
const publicConfigPath = path.join(__dirname, '..', 'public', 'idle-config.json');
const idleHtmlPath = path.join(__dirname, '..', 'public', 'idle.html');

try {
  if (fs.existsSync(configPath)) {
    // 1. Copy config/idle-config.json to public/idle-config.json
    const configData = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(publicConfigPath, configData, 'utf8');
    console.log('Successfully copied config/idle-config.json -> public/idle-config.json!');

    // 2. Sync default inline config in public/idle.html
    const parsedConfig = JSON.parse(configData);
    let idleHtml = fs.readFileSync(idleHtmlPath, 'utf8');

    const inlineRegex = /(let\s+config\s*=\s*)[\s\S]*?(;\s*let\s+game\s*=)/;
    if (inlineRegex.test(idleHtml)) {
      const formattedJson = JSON.stringify(parsedConfig, null, 8).replace(/^/gm, '      ').trim();
      idleHtml = idleHtml.replace(inlineRegex, `$1${formattedJson}$2`);
      fs.writeFileSync(idleHtmlPath, idleHtml, 'utf8');
      console.log('Successfully synced inline config in public/idle.html!');
    }
  }
} catch (err) {
  console.error('Error syncing idle config:', err);
  process.exit(1);
}
