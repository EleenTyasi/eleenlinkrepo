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
  const result = [];
  let currentParagraph = [];
  let inCodeBlock = false;
  let codeBlockLines = [];

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const formattedParagraph = currentParagraph.map(line => `      <p>${parseInline(line)}</p>`).join('\n');
      result.push(formattedParagraph);
      currentParagraph = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block toggle ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        result.push(`      <pre><code>${codeBlockLines.join('\n')}</code></pre>`);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(escapeHtml(line));
      continue;
    }

    // Empty line -> end paragraph
    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    // Check for Headings (# through ######)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const headingText = parseInline(headingMatch[2].trim());
      result.push(`      <h${level}>${headingText}</h${level}>`);
      continue;
    }

    // Check for Horizontal Rule (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      result.push('      <hr>');
      continue;
    }

    // Check for Blockquote (> text)
    if (trimmed.startsWith('>')) {
      flushParagraph();
      const quoteText = parseInline(trimmed.replace(/^>\s*/, ''));
      result.push(`      <blockquote><p>${quoteText}</p></blockquote>`);
      continue;
    }

    // Check for Unordered List (- item or * item)
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      const listItems = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const itemText = parseInline(lines[i].trim().replace(/^[-*]\s+/, ''));
        listItems.push(`<li>${itemText}</li>`);
        i++;
      }
      i--;
      result.push(`      <ul>\n        ${listItems.join('\n        ')}\n      </ul>`);
      continue;
    }

    // Otherwise, normal line in paragraph
    currentParagraph.push(line);
  }

  flushParagraph();
  return result.join('\n\n');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Format inline Markdown (bold, italic, links)
function parseInline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
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
