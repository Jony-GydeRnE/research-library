// scripts/score_benchmark.js
// Rescore the notes-paper-rodina benchmark against live edges.
// Lagrangians notes book (65pp) = ALL 13 notes sessions combined.
// No source-book title filtering — just check if any edge from the notes book
// to the expected Rodina page exists.

require('dotenv').config();
const mongoose = require('mongoose');
const Edge = require('../models/Edge');
const Chunk = require('../models/Chunk');

const NOTES = '69d9ce81aa83b8b11c1837dd';
const RODINA = '69d5dd60c826b8392d57012d'; // 2406.04234 (Hidden zeros ↔ enhanced UV)

// Each item: [id, rodinaPages[], expectedNotesPages[], gapType, label]
// rodinaPages=[] means "implicit/throughout" → we treat as wildcard (any page counts).
// Expected notes pages come from Jony's file map:
//   Lagrangians/EL: p1, calculus: p2, Gaussian: p7, Mechanics: p14,
//   QFT: p15, BCFW: p40, D-subsets: p61
const BENCHMARK = [
  // Items 1-7: foundations — Rodina p1
  [1,  [1], [15],            'Ld', 'Tr(ϕ³) amplitudes'],
  [2,  [1], [7],              'Ld', 'ordered amplitudes A(1,2,...,n)'],
  [3,  [],  [40, 45],         'Ld', 'Feynman diagrams (used throughout)'],
  [4,  [1], [40],             'Ld', 'Mandelstam invariants sᵢⱼ'],
  [5,  [1], [40],             'Ld', 'planar invariants Xᵢⱼ'],
  [6,  [1], [40],             'Ld', 'non-planar invariants cᵢⱼ (eq.1)'],
  [7,  [1], [1, 15],          'Ld', 'Lagrangian formalism'],

  // Items 8-11: BCFW — Rodina p2
  [8,  [2], [40],             'Lv', 'BCFW shift pᵢ→pᵢ+zq (eq.4)'],
  [9,  [2], [40],             'Lp', 'contour at infinity must vanish'],
  [10, [2], [40],             'Lp', 'enhanced BCFW 1/z YM, 1/z² GR'],
  [11, [2], [40],             'Lv', 'unitarity → factorization of residues (eq.3)'],

  // Items 12-19 (expanded core proof) — Rodina p3-4
  [12, [4], [45],             'Ld', 'B homogeneous rational in Xᵢⱼ'],
  [13, [4], [45],             'Lv', 'collect Bᵢ by z-scaling (eq.13)'],
  [14, [3], [45],             'Lp', '"clear" that only certain Xᵢⱼ affected'],
  [15, [3], [45],             'Lv', 'X⁽⁰⁾_{1,j+1} substitution (eq.10)'],
  [16, [3], [45],             'Lv', 'leading order in z = X⁽∞⁾ (eq.11)'],
  [17, [4], [50],             'Lp', 'B(X⁰)=0 ⟹ B linear in cᵢⱼ (eq.15)'],
  [18, [4], [50],             'Lp', 'enhanced scaling Bₘ(X⁰)=0 (eq.16-17)'],
  [19, [4], [50],             'Lv', 'B-prime cascade induction (eq.18)'],

  // Items 20-32: D-subsets — Rodina p4-5
  [20, [4], [61],             'Ld', 'ansatz = sum of all Feynman diagrams'],
  [21, [4], [61],             'Ld', 'D-subsets decomposition'],
  [22, [4], [61],             'Ld', 'boundary propagators = Xᵢⱼ in eq.9'],
  [23, [5], [45, 61],         'Lv', 'term with k boundary props scales as z⁻ᵏ'],
  [24, [],  [61, 65],         'Ld', 'Feynman diagrams ↔ triangulations'],
  [25, [],  [65],             'Ld', 'intersecting chords = non-planar cᵢⱼ'],
  [26, [1], [61],             'Ld', 'locality = products of planar Xᵢⱼ'],
  [27, [5], [61],             'Lv', 'cut s₃₄ uniquely picks S₁ (eq.20)'],
  [28, [5], [61],             'Lp', 'S₁ form with c₁ⱼ{...} (eq.21)'],
  [29, [5], [61],             'Lp', 'no lin. comb. of bdry props → s₃₄'],
  [30, [5], [61],             'Lv', 'cut s₂₃₄ ⟹ x₂=x₃ (eq.22-23)'],
  [31, [5], [61],             'Lp', 'diagram graph connectivity'],
  [32, [5], [61],             'Lv', 'distance bound n-3 steps'],

  // Items 33-42: deeper core proof content (pages from Rodina proof body)
  [33, [],  [61],             'Ld', 'polygon correspondence with hexagons'],
  [34, [5], [45],             'Lv', 'each term z⁻² = 2 bdry props'],
  [35, [],  [45],             'Lv', 'identify bdry props from diagram'],
  [36, [4], [50],             'Lv', 'HOW to decompose B=Bₘ+Bₘ₋₁+...'],
  [37, [4], [50],             'Lp', 'B(X⁰)=0 ⟹ at least linear in cᵢⱼ'],
  [38, [4], [45, 50],         'Lp', 'X⁽∞⁾ = X⁽⁰⁾ bridge identity'],
  [39, [5], [61],             'Lp', 'S₁+S₂=B₋₂ ⟹ S₁=0 and S₂=0 indep'],
  [40, [5], [61],             'Lv', '6-point coeff-fixing via zero+cut'],
  [41, [5], [65],             'Lp', 'eq.22 correction (notes catch error)'],
  [42, [],  [65],             'Ld', 'intersecting chords ⟹ non-Feynman'],

  // Items 43-52: worked examples — Rodina p2-4
  [43, [2], [40],             'Lv', 'A₄ = 1/s₁₂ + 1/s₁₄ (eq.7)'],
  [44, [2], [40],             'Lv', 'A₄ vanishes under c₁₃=0'],
  [45, [1], [40],             'Ld', 'cᵢⱼ = Xᵢⱼ+Xᵢ₊₁,ⱼ₊₁-... (eq.1)'],
  [46, [3], [40],             'Lv', 'X⁽⁰⁾_{1,j+1}, X⁽⁰⁾_{2,j+1}, X⁽⁰⁾_{2,n}'],
  [47, [3], [45],             'Lp', 'X⁽∞⁾₂ⱼ = X⁽∞⁾₁ⱼ - X⁽∞⁾₁₃'],
  [48, [4], [45, 50],         'Lp', 'the core 3-way equivalence (eq.14)'],
  [49, [4], [45],             'Lv', 'B must be linear in cᵢⱼ (eq.15)'],
  [50, [4], [50],             'Lv', 'enhanced scaling Bₘ(X⁰)=0'],
  [51, [4], [50],             'Lp', 'the punchline: zeros ⟹ enhanced scaling'],
  [52, [],  [45, 50],         'Lv', '5-point worked example'],

  // Items 53-66: foundations deep — S-matrix, BCFW, Feynman rules
  [53, [],  [1, 7, 14],       'Ld', 'S-matrix from ∫|p⟩⟨p|=1'],
  [54, [2], [40],             'Lv', 'BCFW shift conditions on q'],
  [55, [2], [40],             'Lv', 'Cauchy contour ⟹ BCFW recursion'],
  [56, [2], [40],             'Lv', 'residue factorization derivation'],
  [57, [3], [40],             'Lv', 'expand X₁ⱼ, X₂ⱼ, X₂ₙ from sᵢⱼ'],
  [58, [3], [45],             'Lp', 'X⁰ and X∞ satisfy same relations'],
  [59, [4], [45],             'Lv', 'X⁰ satisfy ONLY cᵢⱼ=0'],
  [60, [],  [7],              'Ld', 'path integral foundations'],
  [61, [],  [7],              'Ld', 'propagator = inverse kinetic'],
  [62, [],  [7],              'Lv', 'perturbative expansion'],
  [63, [],  [14, 15],         'Lv', 'first Feynman diagrams from scratch'],
  [64, [],  [15],             'Lv', 'momentum-space Feynman rules'],
  [65, [1], [14],             'Lv', 'color decomp & A₄ ordered'],
  [66, [1], [40, 61],         'Ld', 'diagram↔triangulation correspondence'],

  // Items 67-81: color ordering, kinematic mesh, physical picture, lagrangians
  [67, [1], [15],             'Ld', 'ordered amplitudes eq.2'],
  [68, [1], [15],             'Ld', 'tree-level = no loops'],
  [69, [],  [61, 65],         'Lv', 'Catalan count for n-gon triangulations'],
  [70, [1], [40],             'Ld', 'kinematic mesh (c-eq)'],
  [71, [],  [40],             'Lv', 'n(n-3)/2 independent invariants'],
  [72, [2], [40],             'Lv', 'residue factorization near poles'],
  [73, [1], [40],             'Lv', 'Laurent series & residue meaning'],
  [74, [3], [40],             'Lv', '4-point zero s₁₂+s₁₃=-s₁₄'],
  [75, [],  [40],             'Lv', '5-point amplitude explicit'],
  [76, [],  [40, 61],         'Lv', '6-point factorization at X₁₃, X₁₄'],
  [77, [2], [61],             'Ld', 'k-zero taxonomy'],
  [78, [],  [61],             'Ld', 'planar vs non-planar from polygon'],
  [79, [],  [15, 40],         'Ld', 'Tr(ϕ³) Lagrangian + vertex rules'],
  [80, [1], [1],              'Lv', 'EL equations from mechanics'],
  [81, [],  [1, 2],           'Lv', 'calculus of variations derivation'],
];

// Acceptance policy: the note's vocabulary often matches an adjacent Rodina page
// because the paper only has 9 pages. Count a hit with an adjacency window of ±1
// on the target Rodina page to avoid double-penalizing for off-by-one page errors.
const TARGET_WINDOW = Number(process.env.TW ?? 1);
const NOTES_WINDOW = Number(process.env.NW ?? 5);
const STRICT_REL = process.env.STRICT_REL === '1'; // require non-'annotates' relationship

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  // All edges from the notes book → Rodina, with resolved chunk pages
  const edges = await Edge.find({ fromBookId: NOTES, toBookId: RODINA }).lean();
  const chunkIds = new Set();
  for (const e of edges) { chunkIds.add(String(e.fromChunkId)); chunkIds.add(String(e.toChunkId)); }
  const chunks = await Chunk.find({ _id: { $in: [...chunkIds] } })
    .select('pageNumber structuralType').lean();
  const chunkMap = new Map(chunks.map(c => [String(c._id), c]));

  const enriched = edges.map(e => ({
    rel: e.relationshipType,
    conf: e.confidence,
    relv: e.relevance,
    srcPage: (chunkMap.get(String(e.fromChunkId)) || {}).pageNumber,
    dstPage: (chunkMap.get(String(e.toChunkId)) || {}).pageNumber,
    dstType: (chunkMap.get(String(e.toChunkId)) || {}).structuralType,
  }));

  // Scoring
  const results = { COVERED: 0, PARTIAL: 0, WRONG_TARGET: 0, MISSING: 0, UNTARGETED: 0 };
  const byGroup = {};
  const groupOf = id => {
    if (id <= 7)  return '1-7 Foundations (Rodina p1)';
    if (id <= 11) return '8-11 BCFW (Rodina p2)';
    if (id <= 19) return '12-19 Core proof (Rodina p3-4)';
    if (id <= 32) return '20-32 D-subsets (Rodina p4-5)';
    if (id <= 42) return '33-42 Deeper proof body';
    if (id <= 52) return '43-52 Worked examples (Rodina p2-4)';
    if (id <= 66) return '53-66 S-matrix/BCFW/QFT';
    return '67-81 Physical picture + Lagrangians';
  };
  const details = [];

  for (const [id, rodPages, notePages, gapType, label] of BENCHMARK) {
    const g = groupOf(id);
    byGroup[g] = byGroup[g] || { total: 0, covered: 0, partial: 0, wrong: 0, missing: 0 };
    byGroup[g].total++;

    let status;
    let hits = [];

    if (rodPages.length === 0) {
      // Throughout/implicit — accept any edge from the expected notes range
      const inRange = enriched.filter(e =>
        notePages.some(np => Math.abs(e.srcPage - np) <= NOTES_WINDOW)
      );
      if (inRange.length) { status = 'COVERED'; hits = inRange; }
      else status = 'MISSING';
    } else {
      const onTarget = enriched.filter(e =>
        rodPages.some(rp => Math.abs(e.dstPage - rp) <= TARGET_WINDOW)
      );
      if (!onTarget.length) {
        // Any edge at all from the expected note page range?
        const anyFromNotes = enriched.filter(e =>
          notePages.some(np => Math.abs(e.srcPage - np) <= NOTES_WINDOW)
        );
        status = anyFromNotes.length ? 'WRONG_TARGET' : 'MISSING';
        hits = anyFromNotes;
      } else {
        let matchedNoteSource = onTarget.filter(e =>
          notePages.some(np => Math.abs(e.srcPage - np) <= NOTES_WINDOW)
        );
        if (STRICT_REL) matchedNoteSource = matchedNoteSource.filter(e => e.rel !== 'annotates');
        status = matchedNoteSource.length ? 'COVERED' : 'PARTIAL';
        hits = matchedNoteSource.length ? matchedNoteSource : onTarget;
      }
    }

    results[status] = (results[status] || 0) + 1;
    if (status === 'COVERED') byGroup[g].covered++;
    else if (status === 'PARTIAL') byGroup[g].partial++;
    else if (status === 'WRONG_TARGET') byGroup[g].wrong++;
    else if (status === 'MISSING') byGroup[g].missing++;

    details.push({ id, gapType, label, rodPages, notePages, status, nhits: hits.length,
      sample: hits.slice(0, 2).map(h => `notes p${h.srcPage}→Rodina p${h.dstPage} [${h.rel}]`) });
  }

  console.log('\n===== BENCHMARK SCORE =====');
  console.log('Total items:', BENCHMARK.length);
  console.log('COVERED:     ', results.COVERED || 0, `(${((results.COVERED||0)/BENCHMARK.length*100).toFixed(1)}%)`);
  console.log('PARTIAL:     ', results.PARTIAL || 0, '(target page hit, but not from expected notes range)');
  console.log('WRONG_TARGET:', results.WRONG_TARGET || 0, '(notes page hit something, but not the right Rodina page)');
  console.log('MISSING:     ', results.MISSING || 0, '(no edge from expected notes range at all)');

  console.log('\n===== BY GROUP =====');
  for (const [g, s] of Object.entries(byGroup)) {
    console.log(`${g}:  COV ${s.covered}/${s.total}  PART ${s.partial}  WRONG ${s.wrong}  MISS ${s.missing}`);
  }

  console.log('\n===== ITEM-BY-ITEM =====');
  for (const d of details) {
    const tag = d.status === 'COVERED' ? '✓' : d.status === 'PARTIAL' ? '~' : d.status === 'WRONG_TARGET' ? '✗' : '—';
    const rod = d.rodPages.length ? `Rp${d.rodPages.join(',')}` : 'Rp*';
    const note = `Np${d.notePages.join(',')}`;
    console.log(`${tag} [${String(d.id).padStart(2)}] ${d.gapType.padEnd(2)} ${rod.padEnd(6)} ${note.padEnd(10)} ${d.status.padEnd(13)} ${d.label}`);
    if (d.sample.length) console.log(`       ↳ ${d.sample.join('  |  ')}`);
  }

  // Relationship type audit (across ALL notes→Rodina edges, not just benchmark ones)
  const rels = {};
  for (const e of edges) rels[e.relationshipType] = (rels[e.relationshipType] || 0) + 1;
  console.log('\n===== RELATIONSHIP TYPE HISTOGRAM (all notes→Rodina edges) =====');
  console.log(rels);

  // Notes-page coverage: which notes pages produced edges?
  const notePageHist = {};
  for (const e of enriched) notePageHist[e.srcPage] = (notePageHist[e.srcPage] || 0) + 1;
  const sortedPages = Object.keys(notePageHist).map(Number).sort((a,b)=>a-b);
  console.log('\n===== NOTES PAGES WITH OUTGOING EDGES =====');
  console.log(sortedPages.map(p => `p${p}:${notePageHist[p]}`).join('  '));

  // Rodina-page coverage
  const rodPageHist = {};
  for (const e of enriched) rodPageHist[e.dstPage] = (rodPageHist[e.dstPage] || 0) + 1;
  const sortedRod = Object.keys(rodPageHist).map(Number).sort((a,b)=>a-b);
  console.log('\n===== RODINA PAGES RECEIVING EDGES =====');
  console.log(sortedRod.map(p => `p${p}:${rodPageHist[p]}`).join('  '));

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
