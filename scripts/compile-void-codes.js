const fs = require('fs');
const path = require('path');

const codesPath = path.join(__dirname, '..', 'codes.json');
const voidPath = path.join(__dirname, '..', 'public', 'void.html');

// DJB2 Hash function
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

// XOR Encryption
function crypt(input, key) {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

function encryptResponse(plainText, key) {
  const xored = crypt(plainText, key);
  return Buffer.from(xored, 'binary').toString('base64');
}

try {
  // Read codes.json
  const codesData = JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  const encryptedEntries = [];

  for (const [code, entry] of Object.entries(codesData)) {
    const cleanCode = code.toLowerCase().trim();
    const codeHash = hash(cleanCode);
    const encryptedResponse = encryptResponse(entry.response, cleanCode);
    
    let line = `        '${codeHash}': {\n          response: "${encryptedResponse}"`;
    if (entry.statusClass) {
      line += `,\n          statusClass: "${entry.statusClass}"`;
    }
    if (entry.redirect) {
      const encryptedRedirect = encryptResponse(entry.redirect, cleanCode);
      line += `,\n          redirect: "${encryptedRedirect}"`;
    }
    if (entry.playsound) {
      const encryptedPlaysound = encryptResponse(entry.playsound, cleanCode);
      line += `,\n          playsound: "${encryptedPlaysound}"`;
    }
    line += `\n        }`;
    encryptedEntries.push(line);
  }

  const generatedBlock = encryptedEntries.join(',\n');

  // Read void.html
  let voidContent = fs.readFileSync(voidPath, 'utf8');

  // Regex to match between the markers
  const regex = /(\/\/\s*OBSCURED_CODES_START)[\s\S]*(\/\/\s*OBSCURED_CODES_END)/;

  if (regex.test(voidContent)) {
    voidContent = voidContent.replace(regex, `$1\n${generatedBlock}\n$2`);
    fs.writeFileSync(voidPath, voidContent, 'utf8');
    console.log('Successfully compiled and encrypted codes into void.html!');
  } else {
    console.error('Error: Could not find // OBSCURED_CODES_START and // OBSCURED_CODES_END comments in public/void.html');
    process.exit(1);
  }
} catch (err) {
  console.error('An error occurred during void codes compilation:', err);
  process.exit(1);
}
