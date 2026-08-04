const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const blogDir = path.join(publicDir, 'blog');
const indexPath = path.join(blogDir, 'index.html');

const monthMap = {
  january: 1, jan: 1, '1': 1, '01': 1,
  february: 2, feb: 2, '2': 2, '02': 2,
  march: 3, mar: 3, '3': 3, '03': 3,
  april: 4, apr: 4, '4': 4, '04': 4,
  may: 5, '5': 5, '05': 5,
  june: 6, jun: 6, '6': 6, '06': 6,
  july: 7, jul: 7, '7': 7, '07': 7,
  august: 8, aug: 8, '8': 8, '08': 8,
  september: 9, sep: 9, '9': 9, '09': 9,
  october: 10, oct: 10, '10': 10,
  november: 11, nov: 11, '11': 11,
  december: 12, dec: 12, '12': 12
};

// Helper to recursively find all HTML files
function getHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html') && filePath !== indexPath) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Helper to parse date from parent folder name and filename
function getPostDateInfo(filePath) {
  const filename = path.basename(filePath, '.html');
  const parentFolder = path.basename(path.dirname(filePath)).toLowerCase();
  
  if (monthMap.hasOwnProperty(parentFolder) && /^\d+$/.test(filename)) {
    const month = monthMap[parentFolder];
    const monthStr = String(month);
    
    let prefixLength = 0;
    if (filename.startsWith(monthStr)) {
      prefixLength = monthStr.length;
    } else if (filename.startsWith('0' + monthStr)) {
      prefixLength = monthStr.length + 1;
    }
    
    if (prefixLength > 0) {
      const yearStr = filename.slice(-2);
      const year = 2000 + parseInt(yearStr, 10);
      const dayStr = filename.slice(prefixLength, -2);
      const day = parseInt(dayStr, 10);
      
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return { date, parsed: true };
      }
    }
  }
  
  return { date: null, parsed: false };
}

// Format date into a reader-friendly string
function formatFriendlyDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

try {
  const htmlFiles = getHtmlFiles(blogDir);

  const posts = htmlFiles
    .map((filePath) => {
      const { date, parsed } = getPostDateInfo(filePath);
      
      // Skip files that do not follow the blog path/naming convention (e.g. templates)
      if (!parsed) return null;

      const content = fs.readFileSync(filePath, 'utf8');

      // Extract title from <title> tag
      const titleMatch = content.match(/<title>(.*?)<\/title>/i);
      let title = titleMatch ? titleMatch[1].trim() : '';
      
      // If no <title> tag exists or it's empty, use the formatted date
      if (!title) {
        title = formatFriendlyDate(date);
      }
      
      // Calculate URL relative to /public directory
      const relativePath = path.relative(publicDir, filePath);
      const url = '/' + relativePath.replace(/\\/g, '/');

      return {
        filePath,
        url,
        title,
        date
      };
    })
    .filter(post => post !== null);

  // Sort posts chronologically, newest first (highest date first)
  posts.sort((a, b) => b.date - a.date);

  // Generate HTML list items
  const postHtml = posts.map(post => `      <li><a href="${post.url}">${post.title}</a></li>`).join('\n');

  // Read index.html
  let indexContent = fs.readFileSync(indexPath, 'utf8');

  // Regex to match everything between the markers
  const regex = /(<!--\s*BLOG_POSTS_START\s*-->)[\s\S]*(<!--\s*BLOG_POSTS_END\s*-->)/;

  if (regex.test(indexContent)) {
    indexContent = indexContent.replace(regex, `$1\n${postHtml}\n$2`);
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log('Successfully updated blog list in index.html!');
  } else {
    console.error('Error: Could not find <!-- BLOG_POSTS_START --> and <!-- BLOG_POSTS_END --> markers in public/blog/index.html');
  }
} catch (err) {
  console.error('An error occurred during blog list generation:', err);
  process.exit(1);
}
