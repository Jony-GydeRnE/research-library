/**
 * figureJudge — Sonnet 4.6 vision judge for figure crops.
 *
 * Given a cropped figure PNG (buffer) and the expected caption text,
 * asks Sonnet to return structured critique: a 0-100 score, how many
 * lines of body text leaked in at the top/bottom, how many lines of
 * figure content got clipped, and how much excess whitespace is on
 * the left/right edges.
 *
 * The critique is consumed by figureService.detectAndCropFigures in
 * a mechanical delta-apply loop — no prompting or hallucination risk
 * on the correction step.
 *
 * Returns `null` on API failure, empty response, or invalid JSON so
 * callers can fall back to the pre-judge crop without regression.
 *
 * See reports/Notes rewrite and vision/figure-judge-loop-spec.md
 * for the full design.
 */

const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM_PROMPT = `You are judging a figure crop extracted from an academic paper page.

I will show you:
1. THE CROP (an image, purported to contain one figure)
2. THE EXPECTED CAPTION TEXT (for context — the caption should NOT appear inside the crop)

Return STRICT JSON only, no prose, no markdown fences. The JSON must have EXACTLY these keys:

{
  "score": <integer 0-100>,
  "extra_lines_above": <integer>,
  "extra_lines_below": <integer>,
  "clipped_above": <integer>,
  "clipped_below": <integer>,
  "extra_px_left": <integer>,
  "extra_px_right": <integer>,
  "notes": "<short reason, under 140 chars>"
}

Field semantics:
- extra_lines_above: number of body-text lines visible at the TOP of the crop that should NOT be there. Count actual lines of text, not pixels. Axis labels, vertex tags, and in-diagram annotations that are part of the figure artwork do NOT count.
- extra_lines_below: same, for the BOTTOM edge. The figure caption "FIG. N: ..." counts as extra and must be excluded from the crop.
- clipped_above: number of lines of figure content (diagram elements, vertex labels that are part of the drawing) that appear cut off at the TOP edge. Estimate.
- clipped_below: same, for the BOTTOM edge.
- extra_px_left: excess whitespace on the LEFT edge in pixels. Estimate.
- extra_px_right: same, for the RIGHT edge.

Scoring rubric (be strict):
  100:   figure fills crop, no text bleed, no clipping, whitespace symmetric
  95-99: near-perfect, tiny whitespace asymmetry only
  85-94: usable but has 1-2 lines of excess text OR minor clipping
  70-84: multiple lines of excess text OR significant clipping
  <70:   broken crop, major issues

A crop with the caption visible inside it can NEVER score above 85.
A crop with >50% of the figure clipped can NEVER score above 50.`;

/**
 * Judge a single crop.
 * @param {Buffer} cropBuffer - PNG buffer of the current crop
 * @param {string} captionText - the expected caption text
 * @param {object} opts
 * @param {string} [opts.model] - Anthropic model id
 * @returns {Promise<object|null>} verdict or null on failure
 */
async function judgeCrop(cropBuffer, captionText, opts = {}) {
  const model = opts.model || process.env.FIGURE_JUDGE_MODEL || 'claude-sonnet-4-6';
  try {
    const c = getClient();
    const response = await c.messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: cropBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: `EXPECTED CAPTION: "${(captionText || '').slice(0, 400).replace(/"/g, "'")}"\n\nReturn the verdict JSON now.`,
            },
          ],
        },
      ],
    });

    let text = response.content?.[0]?.text || '';
    // Strip any markdown fences the model might have added despite
    // the instruction.
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    // Grab the first balanced {...} block — some models add prose
    // before/after despite instructions.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;
    const jsonStr = text.slice(firstBrace, lastBrace + 1);

    let verdict;
    try { verdict = JSON.parse(jsonStr); }
    catch { return null; }

    // Validate shape — coerce missing int fields to 0, default score to 50.
    const out = {
      score: numInt(verdict.score, 50),
      extra_lines_above: numInt(verdict.extra_lines_above, 0),
      extra_lines_below: numInt(verdict.extra_lines_below, 0),
      clipped_above: numInt(verdict.clipped_above, 0),
      clipped_below: numInt(verdict.clipped_below, 0),
      extra_px_left: numInt(verdict.extra_px_left, 0),
      extra_px_right: numInt(verdict.extra_px_right, 0),
      notes: String(verdict.notes || '').slice(0, 200),
    };
    out.score = Math.max(0, Math.min(100, out.score));
    return out;
  } catch (err) {
    console.warn(`[figureJudge] call failed: ${err.message}`);
    return null;
  }
}

function numInt(v, fallback) {
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  return Math.round(n);
}

module.exports = { judgeCrop };
