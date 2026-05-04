import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

async function extractCoords() {
  const data = new Uint8Array(fs.readFileSync('./public/FT-SP-PP-001_Template.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const textContent = await page.getTextContent();
  
  for (const item of textContent.items) {
    if (item.str.includes('<<')) {
      // transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const x = item.transform[4];
      const y = item.transform[5];
      console.log(`Found "${item.str}" at X: ${x.toFixed(2)}, Y: ${y.toFixed(2)} | width: ${item.width.toFixed(2)}, height: ${item.height.toFixed(2)}`);
    }
  }
}

extractCoords().catch(console.error);
