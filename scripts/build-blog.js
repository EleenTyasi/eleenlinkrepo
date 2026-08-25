const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const postsDir = path.join(projectRoot, 'content', 'posts');
const publicDir = path.join(projectRoot, 'public');
const blogDir = path.join(publicDir, 'blog');
const templatePath = path.join(blogDir, 'template.html');

// Helper to recursively find all Markdown (.md) files
function getMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Simple Frontmatter Parser (YAML-like key: value between ---)
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { data: {}, body: content };
  }

  const yamlBlock = match[1];
  const body = content.slice(match[0].length);
  const data = {};

  yamlBlock.split(/[\r\n]+/).forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key) data[key] = value;
    }
  });

  return { data, body };
}

// Simple Markdown to HTML Converter
function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const paragraphs = [];
  let currentBlock = [];

  function flushBlock() {
    if (currentBlock.length === 0) return;
    const text = currentBlock.join('\n').trim();
    if (!text) return;

    if (text.startsWith('# ')) {
      paragraphs.push(`<h1>${parseInline(text.slice(2))}</h1>`);
    } else if (text.startsWith('## ')) {
      paragraphs.push(`<h2>${parseInline(text.slice(3))}</h2>`);
    } else if (text.startsWith('### ')) {
      paragraphs.push(`<h3>${parseInline(text.slice(4))}</h3>`);
    } else if (text === '---' || text === '***') {
      paragraphs.push('<hr>');
    } else {
      // Regular paragraph - format linebreaks as <p> tags
      const formattedLines = text.split('\n').map(line => parseInline(line));
      paragraphs.push(`      <p>${formattedLines.join('</p>\n      <p>')}</p>`);
    }
    currentBlock = [];
  }

  lines.forEach(line => {
    if (line.trim() === '') {
      flushBlock();
    } else {
      currentBlock.push(line);
    }
  });
  flushBlock();

  return paragraphs.join('\n\n');
}

// Format inline Markdown (bold, italic, links)
function parseInline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

try {
  const mdFiles = getMarkdownFiles(postsDir);
  const template = fs.readFileSync(templatePath, 'utf8');

  console.log(`Found ${mdFiles.length} markdown post(s) to compile.`);

  mdFiles.forEach((filePath) => {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const { data, body } = parseFrontmatter(rawContent);

    const relativePath = path.relative(postsDir, filePath);
    const htmlRelativePath = relativePath.replace(/\.md$/, '.html');
    const targetHtmlPath = path.join(blogDir, htmlRelativePath);

    // Create target directory if needed
    fs.mkdirSync(path.dirname(targetHtmlPath), { recursive: true });

    const title = data.title || 'Untitled Post';
    const date = data.date || '';
    const bodyHtml = markdownToHtml(body);

    // Populate template
    let outputHtml = template;

    // Replace <title> tag
    outputHtml = outputHtml.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);

    // Replace <h1> post title
    outputHtml = outputHtml.replace(/<h1>.*?<\/h1>/i, `<h1>${title}</h1>`);

    // Replace <p>written on: ...</p>
    if (date) {
      outputHtml = outputHtml.replace(/<p>written on:.*?<\/p>/i, `<p>written on: ${date}</p>`);
    }

    // Inject post content
    const contentRegex = /(<div class="post-content">)[\s\S]*?(<\/div>)/i;
    if (contentRegex.test(outputHtml)) {
      outputHtml = outputHtml.replace(contentRegex, `$1\n${bodyHtml}\n    $2`);
    }

    fs.writeFileSync(targetHtmlPath, outputHtml, 'utf8');
    console.log(`Compiled: ${relativePath} -> public/blog/${htmlRelativePath}`);
  });

  // Automatically update the blog list index
  require('./generate-blog-list');

} catch (err) {
  console.error('Error during blog build:', err);
  process.exit(1);
}
