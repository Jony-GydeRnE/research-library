// scripts/show_benchmark_examples.js
// For a sampling of benchmark items, print the ACTUAL edge the system found:
// notes page + notes chunk text + Rodina page + Rodina chunk text + relationship.
// Use this to eyeball whether the right stuff is getting matched.

require('dotenv').config();
const mongoose = require('mongoose');
const Edge = require('../models/Edge');
const Chunk = require('../models/Chunk');

const NOTES = '69d9ce81aa83b8b11c1837dd';
const RODINA = '69d5dd60c826b8392d57012d';

// One representative item per benchmark group (skim-friendly default).
// Override with IDS=1,7,15,22,36,47,59,67,80 to pick specific items.
const DEFAULT_SAMPLE_IDS = [1, 7, 8, 15, 22, 36, 47, 52, 60, 70, 80];

// Copy-paste of the benchmark array from score_benchmark.js so this
// script has no import coupling. Format: [id, rodinaPages, notePages, gapType, label]
const BENCHMARK = [
  [1,  [1], [15],       'Ld', 'Tr(ϕ³) amplitudes'],
  [2,  [1], [7],        'Ld', 'ordered amplitudes A(1,2,...,n)'],
  [3,  [],  [40, 45],   'Ld', 'Feynman diagrams (used throughout)'],
  [4,  [1], [40],       'Ld', 'Mandelstam invariants sᵢⱼ'],
  [5,  [1], [40],       'Ld', 'planar invariants Xᵢⱼ'],
  [6,  [1], [40],       'Ld', 'non-planar invariants cᵢⱼ (eq.1)'],
  [7,  [1], [1, 15],    'Ld', 'Lagrangian formalism'],
  [8,  [2], [40],       'Lv', 'BCFW shift pᵢ→pᵢ+zq (eq.4)'],
  [9,  [2], [40],       'Lp', 'contour at infinity must vanish'],
  [10, [2], [40],       'Lp', 'enhanced BCFW 1/z YM, 1/z² GR'],
  [11, [2], [40],       'Lv', 'unitarity → factorization (eq.3)'],
  [12, [4], [45],       'Ld', 'B homogeneous rational in Xᵢⱼ'],
  [13, [4], [45],       'Lv', 'collect Bᵢ by z-scaling (eq.13)'],
  [14, [3], [45],       'Lp', '"clear" that only certain Xᵢⱼ affected'],
  [15, [3], [45],       'Lv', 'X⁽⁰⁾_{1,j+1} substitution (eq.10)'],
  [16, [3], [45],       'Lv', 'leading order in z = X⁽∞⁾ (eq.11)'],
  [17, [4], [50],       'Lp', 'B(X⁰)=0 ⟹ B linear in cᵢⱼ (eq.15)'],
  [18, [4], [50],       'Lp', 'enhanced scaling Bₘ(X⁰)=0 (eq.16-17)'],
  [19, [4], [50],       'Lv', 'B-prime cascade induction (eq.18)'],
  [20, [4], [61],       'Ld', 'ansatz = sum of all Feynman diagrams'],
  [21, [4], [61],       'Ld', 'D-subsets decomposition'],
  [22, [4], [61],       'Ld', 'boundary propagators = Xᵢⱼ in eq.9'],
  [27, [5], [61],       'Lv', 'cut s₃₄ uniquely picks S₁ (eq.20)'],
  [30, [5], [61],       'Lv', 'cut s₂₃₄ ⟹ x₂=x₃ (eq.22-23)'],
  [36, [4], [50],       'Lv', 'HOW to decompose B=Bₘ+Bₘ₋₁+...'],
  [41, [5], [65],       'Lp', 'eq.22 correction (notes catch error)'],
  [43, [2], [40],       'Lv', 'A₄ = 1/s₁₂ + 1/s₁₄ (eq.7)'],
  [47, [3], [45],       'Lp', 'X⁽∞⁾₂ⱼ = X⁽∞⁾₁ⱼ - X⁽∞⁾₁₃'],
  [48, [4], [45, 50],   'Lp', 'the core 3-way equivalence (eq.14)'],
  [51, [4], [50],       'Lp', 'punchline: zeros ⟹ enhanced scaling'],
  [52, [],  [45, 50],   'Lv', '5-point worked example'],
  [54, [2], [40],       'Lv', 'BCFW shift conditions on q'],
  [60, [],  [7],        'Ld', 'path integral foundations'],
  [67, [1], [15],       'Ld', 'ordered amplitudes eq.2'],
  [70, [1], [40],       'Ld', 'kinematic mesh (c-eq)'],
  [72, [2], [40],       'Lv', 'residue factorization near poles'],
  [80, [1], [1],        'Lv', 'EL equations from mechanics'],
];

const NOTES_WINDOW = Number(process.env.NW ?? 5);
const TARGET_WINDOW = Number(process.env.TW ?? 1);
const MAX_EXAMPLES_PER_ITEM = Number(process.env.MAX ?? 1);

function truncate(s, n) {
  s = (s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.substring(0, n) + '…' : s;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const edges = await Edge.find({ fromBookId: NOTES, toBookId: RODINA }).lean();
  const chunkIds = new Set();
  for (const e of edges) { chunkIds.add(String(e.fromChunkId)); chunkIds.add(String(e.toChunkId)); }
  const chunks = await Chunk.find({ _id: { $in: [...chunkIds] } })
    .select('pageNumber chunkIndex structuralType contextTags sourceText').lean();
  const chunkMap = new Map(chunks.map(c => [String(c._id), c]));

  console.log(`\n[show_benchmark_examples] total notes→Rodina edges: ${edges.length}`);
  console.log(`[show_benchmark_examples] sampling ${DEFAULT_SAMPLE_IDS.length} benchmark items (override with IDS=n,n,n)\n`);

  const sampleIds = (process.env.IDS || '').trim()
    ? process.env.IDS.split(',').map(Number)
    : DEFAULT_SAMPLE_IDS;

  for (const id of sampleIds) {
    const item = BENCHMARK.find(b => b[0] === id);
    if (!item) { console.log(`item ${id} not in benchmark array, skipping`); continue; }
    const [_, rodPages, notePages, gapType, label] = item;

    console.log('═'.repeat(100));
    console.log(`#${id} [${gapType}] ${label}`);
    console.log(`  expected: notes p${notePages.join('/')} → Rodina p${rodPages.length ? rodPages.join('/') : '*'}`);

    const matches = edges
      .map(e => {
        const src = chunkMap.get(String(e.fromChunkId));
        const dst = chunkMap.get(String(e.toChunkId));
        return { e, src, dst };
      })
      .filter(({ e, src, dst }) => {
        if (!src || !dst) return false;
        const noteOK = notePages.some(np => Math.abs(src.pageNumber - np) <= NOTES_WINDOW);
        if (!noteOK) return false;
        if (rodPages.length === 0) return true;
        return rodPages.some(rp => Math.abs(dst.pageNumber - rp) <= TARGET_WINDOW);
      });

    if (matches.length === 0) {
      console.log('  ✗ no matching edge');
      continue;
    }
    console.log(`  ✓ ${matches.length} matching edge(s)`);
    for (const m of matches.slice(0, MAX_EXAMPLES_PER_ITEM)) {
      console.log(`\n  NOTES p${m.src.pageNumber} [${m.src.structuralType || '-'}] (chunkIndex=${m.src.chunkIndex})`);
      console.log('    tags: ' + ((m.src.contextTags || []).slice(0,5).join(', ') || '(none)'));
      console.log('    text: "' + truncate(m.src.sourceText, 260) + '"');
      console.log(`\n  RODINA p${m.dst.pageNumber} [${m.dst.structuralType || '-'}] (chunkIndex=${m.dst.chunkIndex})`);
      console.log('    tags: ' + ((m.dst.contextTags || []).slice(0,5).join(', ') || '(none)'));
      console.log('    text: "' + truncate(m.dst.sourceText, 260) + '"');
      console.log(`\n  RELATIONSHIP: ${m.e.relationshipType}   conf=${m.e.confidence}   relev=${m.e.relevance}`);
    }
    console.log();
  }

  // Relationship histogram at the bottom
  const hist = {};
  for (const e of edges) hist[e.relationshipType] = (hist[e.relationshipType] || 0) + 1;
  console.log('═'.repeat(100));
  console.log('RELATIONSHIP HISTOGRAM (all notes→Rodina edges):');
  console.log(' ', hist);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
