require('dotenv').config({ path: '/Users/jonthanvalenzuela/Desktop/gyde-library/.env' });
const mongoose = require('mongoose');
process.chdir('/Users/jonthanvalenzuela/Desktop/gyde-library');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Chunk = require('/Users/jonthanvalenzuela/Desktop/gyde-library/models/Chunk');
  const BOOK2 = '69d6622b12ac83f9752b4ca9';

  // Phrase → tag augmentations. For each chunk in Book 2 whose
  // sourceText contains a phrase, add the corresponding tag if it
  // isn't already present. One-time deterministic patch — no LLM.
  // Patches the symptom of the granularity issue (chunks discussing
  // a concept but not having it as an explicit tag) so the edge
  // resolver can pick them. The right long-term fix is iterating
  // the span-generation prompt; this patch buys time.
  const augmentations = [
    { phrase: /\bhidden\s+zero/i, tag: 'hidden_zeros' },
    { phrase: /\bsplitting/i, tag: 'splitting' },
    { phrase: /tr\s*\(?\s*\\?\(?\\?phi/i, tag: 'tr_phi3_amplitudes' },
    { phrase: /\babhy/i, tag: 'abhy_associahedron' },
    { phrase: /\bassociahedron/i, tag: 'associahedron_definition' },
    { phrase: /\bzero[\s-]+condition/i, tag: 'zero_condition' },
    { phrase: /\bfactoriz/i, tag: 'factorization' },
    { phrase: /\bnlsm\b|non[- ]linear sigma/i, tag: 'nlsm_amplitudes' },
    { phrase: /\byang[- ]?mills\b|\bym\b/i, tag: 'yang_mills_amplitudes' },
    { phrase: /\bbcfw\b/i, tag: 'bcfw_recursion' },
    { phrase: /\bkinematic\s+mesh/i, tag: 'kinematic_mesh' },
    { phrase: /\b(adler|soft\s+limit)/i, tag: 'adler_zero_soft_limits' },
    { phrase: /\buniqueness\b/i, tag: 'uniqueness_proof' },
    { phrase: /\bamplitude\s+zero/i, tag: 'amplitude_zeros' },
    { phrase: /\bcausal\s+diamond/i, tag: 'kinematic_causal_diamond' },
  ];

  const chunks = await Chunk.find({ bookId: BOOK2 }).lean();
  let patched = 0;
  let totalAdds = 0;
  for (const c of chunks) {
    if (!c.sourceText) continue;
    const existing = new Set(c.contextTags || []);
    const toAdd = [];
    for (const a of augmentations) {
      if (a.phrase.test(c.sourceText) && !existing.has(a.tag)) {
        toAdd.push(a.tag);
      }
    }
    if (toAdd.length > 0) {
      const newTags = [...new Set([...(c.contextTags || []), ...toAdd])];
      await Chunk.findByIdAndUpdate(c._id, { contextTags: newTags });
      patched++;
      totalAdds += toAdd.length;
    }
  }
  console.log('Patched ' + patched + ' / ' + chunks.length + ' chunks. ' + totalAdds + ' total tag augmentations.');

  // Verify chunk #69
  const c69 = await Chunk.findOne({ bookId: BOOK2, chunkIndex: 69 }).lean();
  console.log('chunk #69 tags after patch: [' + (c69.contextTags || []).join(',') + ']');

  process.exit();
}).catch(e => { console.error(e); process.exit(1); });
