import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
  'Manual_Usuario_Accesos.md',
  'Manual_Admin_Soporte.md',
  'Manual_RRHH.md',
  'CheatSheet_ITAM.md'
];

/**
 * Replaces markdown image paths with Base64 data URIs
 */
function embedImages(mdContent) {
  const imgRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  let processedMd = mdContent;

  while ((match = imgRegex.exec(mdContent)) !== null) {
    const relativePath = match[1];
    const absolutePath = path.resolve(__dirname, relativePath);

    if (fs.existsSync(absolutePath)) {
      const ext = path.extname(absolutePath).slice(1);
      const base64 = fs.readFileSync(absolutePath, 'base64');
      const dataUri = `data:image/${ext};base64,${base64}`;
      processedMd = processedMd.replace(relativePath, dataUri);
    }
  }
  return processedMd;
}

async function generatePDF(filename) {
  const mdPath = path.join(__dirname, filename);
  const pdfPath = mdPath.replace('.md', '.pdf');
  const mdContent = fs.readFileSync(mdPath, 'utf8');

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  const processedMd = embedImages(mdContent)
    .replace(/`/g, '\\`').replace(/\$/g, '\\$');

  // Simple HTML wrapper with Marked.js from CDN
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
      <style>
        .markdown-body {
          box-sizing: border-box;
          min-width: 200px;
          max-width: 980px;
          margin: 0 auto;
          padding: 45px;
          background-color: #ffffff;
          color: #24292f;
        }
        @media (max-width: 767px) {
          .markdown-body { padding: 15px; }
        }
        img { max-width: 100%; border-radius: 12px; border: 1px solid #d0d7de; margin: 20px 0; display: block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        pre { background-color: #f6f8fa !important; color: #24292f !important; }
        .page-break { page-break-after: always; }
        h1, h2, h3 { border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; color: #0969da; }
        hr { background-color: #d0d7de; height: 1px; border: 0; margin: 24px 0; }
      </style>
    </head>
    <body class="markdown-body">
      <div id="content"></div>
      <script>
        document.getElementById('content').innerHTML = marked.parse(\`${processedMd}\`);
      </script>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  // Wait a bit more for the browser to render the Base64 images
  await new Promise(r => setTimeout(r, 1000));

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    printBackground: true
  });

  await browser.close();
  console.log(`Generated: ${pdfPath}`);
}

async function run() {
  for (const file of files) {
    try {
      await generatePDF(file);
    } catch (err) {
      console.error(`Error generating ${file}:`, err);
    }
  }
}

run();
