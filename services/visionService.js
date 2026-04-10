const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OpenAI = require('openai');
const pipeline = require('../config/pipeline');

const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'page-to-html.txt');
const PROMPT_TEMPLATE = fs.readFileSync(PROMPT_PATH, 'utf-8');
// Notes-variant prompt for handwritten / whiteboard pages. Uses a
// completely different system prompt that tells the model the
// page is a stylus capture, asks for explicit uncertainty markers,
// and forbids attempting Feynman diagram TikZ generation (just
// describe diagrams in note-figure blocks). Routed via the
// `kind: 'notes'` flag on the source Book.
const NOTES_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'page-to-html-notes.txt');
const NOTES_PROMPT_TEMPLATE = fs.existsSync(NOTES_PROMPT_PATH)
  ? fs.readFileSync(NOTES_PROMPT_PATH, 'utf-8')
  : PROMPT_TEMPLATE;
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
 *
 * @param {Buffer} pngBuffer  - the rendered page image
 * @param {number} pageNumber - 1-indexed page number
 * @param {boolean} isFirstPage - true for page 1 (adds title-block instructions)
 * @param {string}  kind - 'paper' (default) or 'notes' for handwritten content
 */
async function convertPageWithVision(pngBuffer, pageNumber, isFirstPage, kind = 'paper') {
  const client = getOpenAI();
  if (!client) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const base64Image = pngBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64Image}`;

  // Notes books get the handwriting/whiteboard variant prompt that
  // tells the model the page is a stylus capture, asks for
  // uncertainty markers, and forbids Feynman-diagram TikZ
  // generation. Paper books get the standard typesetting prompt.
  let prompt = kind === 'notes' ? NOTES_PROMPT_TEMPLATE : PROMPT_TEMPLATE;
  if (isFirstPage && kind !== 'notes') {
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

  // Normalize display equations to match the legacy htmlService pipeline:
  // wrap every \[...\] block in <div class="math-display">. The vision
  // prompt asks the model to emit \[...\] on its own line but does not
  // specify a wrapper element, so we get either bare \[...\] at the top
  // level or \[...\] stuffed inside a redundant <p>. Both cases break
  // downstream assumptions — reader.js looks for .math-display as the
  // absorption signal for the citation callout box, and reader.css
  // styles .math-display with proper centering and margin. This
  // normalization makes vision pages behave identically to legacy pages.
  //
  // Guarded to skip if the vision output already contains math-display
  // (it never does today, but the guard prevents a double-wrap if the
  // prompt is ever updated to produce it directly).
  if (!/<div\s+class=["']math-display["']/.test(html)) {
    // First unwrap <p>\[...\]</p> — putting a <div> inside a <p> is
    // invalid HTML and the browser auto-closes the <p> early, leaving
    // stray tags that confuse the matcher.
    html = html.replace(/<p[^>]*>\s*(\\\[[\s\S]*?\\\])\s*<\/p>/g, '<div class="math-display">$1</div>');
    // Then wrap any remaining bare \[...\] blocks at the top level.
    html = html.replace(/\\\[([\s\S]*?)\\\]/g, '<div class="math-display">\\[$1\\]</div>');
  }

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
