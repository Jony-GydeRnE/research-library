const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OpenAI = require('openai');
const pipeline = require('../config/pipeline');

const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'page-to-html.txt');
const PROMPT_TEMPLATE = fs.readFileSync(PROMPT_PATH, 'utf-8');
const SWIFT_RENDERER = path.join(__dirname, '..', 'scripts', 'pdf2png.swift');
const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');

let openai = null;

function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Render a single PDF page to a PNG and save it permanently.
 * Returns the PNG buffer. The file is saved to uploads/images/{bookId}/page-{pageNumber}.png.
 */
async function renderPageToImage(pdfPath, pageNumber, bookId, scale = 2.5) {
  const bookDir = path.join(IMAGE_DIR, bookId);
  if (!fs.existsSync(bookDir)) {
    fs.mkdirSync(bookDir, { recursive: true });
  }

  const pngPath = path.join(bookDir, `page-${pageNumber}.png`);

  execSync(`swift "${SWIFT_RENDERER}" "${pdfPath}" ${pageNumber} "${pngPath}" ${scale}`, {
    timeout: 30000,
  });

  return fs.readFileSync(pngPath);
}

/**
 * Send a page image to GPT-4o and get back structured HTML with LaTeX.
 */
async function convertPageWithVision(pngBuffer, pageNumber, isFirstPage) {
  const client = getOpenAI();
  if (!client) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const base64Image = pngBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64Image}`;

  let prompt = PROMPT_TEMPLATE;
  if (isFirstPage) {
    prompt += '\n\nThis is page 1 of the paper. Wrap the paper title in <h1 class="paper-title">, author names in <div class="paper-authors">, affiliations in <div class="paper-affiliations">, and the abstract in <div class="paper-abstract"><span class="abstract-label">Abstract</span>...</div>.';
  }

  const response = await client.chat.completions.create({
    model: pipeline.VISION_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: dataUri, detail: 'high' },
          },
        ],
      },
    ],
  });

  let html = response.choices[0]?.message?.content || '';

  // Strip markdown code fences if the model wraps output
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Wrap in page-content div
  html = `<div class="page-content">\n${html}\n</div>`;

  return html;
}

/**
 * Check if the OpenAI API is available.
 */
function isVisionAvailable() {
  return !!process.env.OPENAI_API_KEY;
}

module.exports = {
  renderPageToImage,
  convertPageWithVision,
  isVisionAvailable,
};
