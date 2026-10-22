const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Book = require('../../models/Book');
const Page = require('../../models/Page');
const Span = require('../../models/Span');
const Chunk = require('../../models/Chunk');
const { load } = require('../helpers/load.cjs');
let mongo;

before(async () => {
  // Always create a disposable database. Never consume MONGODB_URI.
  mongo = await MongoMemoryServer.create({ instance: { args: ['--nounixsocket'] } });
  await mongoose.connect(mongo.getUri('gyde_audit_test'));
});
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => { await mongoose.connection.dropDatabase(); });

test('overlapping spans retain the full source range in the derived chunk', async () => {
  const book = await Book.create({ title: 'Fixture' });
  await Page.create({ bookId: book._id, pageNumber: 1, rawText: 'One. Two. Three. Four. Five.' });
  await Span.create([
    { bookId: book._id, pageNumber: 1, sentenceStart: 1, sentenceEnd: 5, contextTags: ['wide'] },
    { bookId: book._id, pageNumber: 1, sentenceStart: 2, sentenceEnd: 2, contextTags: ['nested'] },
  ]);
  await require('../../services/chunkService').generateChunksForBook(book._id);
  const chunks = await Chunk.find({ bookId: book._id }).lean();
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].sentenceEnd, 5);
  assert.equal(chunks[0].sourceText, 'One. Two. Three. Four. Five.');
});

test('a detected lemma can be persisted without aborting chunk creation', async () => {
  const book = await Book.create({ title: 'Fixture' });
  await Page.create({ bookId: book._id, pageNumber: 1, rawText: 'Lemma holds.',
    structuralAnnotations: [{ kind: 'lemma', sentenceRange: [1, 1] }] });
  await Span.create({ bookId: book._id, pageNumber: 1, sentenceStart: 1, sentenceEnd: 1 });
  await require('../../services/chunkService').generateChunksForBook(book._id);
  assert.equal((await Chunk.findOne({ bookId: book._id })).structuralType, 'lemma');
});

test('a rebuild with no configured model preserves existing annotations', async () => {
  const book = await Book.create({ title: 'Fixture' });
  const span = await Span.create({ bookId: book._id, pageNumber: 1, sentenceStart: 1, sentenceEnd: 1 });
  const page = await Page.create({ bookId: book._id, pageNumber: 1, rawText: 'Existing research.', spanIds: [span._id] });
  const service = load('services/spanService.js');
  await assert.rejects(service.generateSpansForBook(book._id), /OPENAI_API_KEY/);
  assert.ok(await Span.findById(span._id));
  assert.equal(String((await Page.findById(page._id)).spanIds[0]), String(span._id));
});

test('citation coverage uses page coordinates, preserves proof roles, and covers repeated occurrences', async () => {
  const book = await Book.create({ title: 'Fixture' });
  const page = await Page.create({ bookId: book._id, pageNumber: 3, rawText: 'Earlier sentences.' });
  const chunk = await Chunk.create({ bookId: book._id, pageNumber: 3, sentenceStart: 20,
    sentenceEnd: 21, sourceText: 'Claim [2]. Another use [2].' });
  const proof = await Span.create({ bookId: book._id, pageNumber: 3, chunkId: chunk._id,
    sentenceStart: 20, sentenceEnd: 20, role: 'proof', searchClass: 'L', gapType: 'proof', spanText: 'Claim [2].' });
  await Chunk.updateOne({ _id: chunk._id }, { $push: { spanIds: proof._id } });
  const service = require('../../services/citationSpanService');
  await service.ensureCitationSpansForBook(book._id);
  await service.ensureCitationSpansForBook(book._id); // must be idempotent
  const citations = await Span.find({ bookId: book._id, role: 'citation' }).sort({ sentenceStart: 1 });
  assert.deepEqual(citations.map(s => s.sentenceStart), [20, 21]);
  assert.equal((await Span.findById(proof._id)).role, 'proof');
  assert.equal((await Span.findById(proof._id)).gapType, 'proof');
  const reloadedPage = await Page.findById(page._id);
  for (const c of citations) assert.ok(reloadedPage.spanIds.some(id => String(id) === String(c._id)));
  assert.ok((await Chunk.findById(chunk._id)).searchClasses.includes('S'));
});

for (const type of ['generate-html', 'reprocess-vision']) {
  test(`${type} cannot report success when page rendering fails`, async () => {
    const book = await Book.create({ title: 'Fixture', pageCount: 1, status: 'ready', s3Key: 'fixture.pdf' });
    await Page.create({ bookId: book._id, pageNumber: 1, rawText: 'A page.' });
    const Job = require('../../models/Job');
    const job = await Job.create({ bookId: book._id, type, status: 'pending' });
    const handlers = {};
    class Agenda { define(name, fn) { handlers[name] = fn; } async start() {} }
    const service = load('services/jobService.js', {
      agenda: { Agenda },
      './s3Service': { getPdfBuffer: async () => Buffer.from('fixture') },
      './visionService': { isVisionAvailable: () => true,
        renderPageToImage: async () => { throw new Error('Renderer unavailable'); } },
      './metadataService': { extractBookMetadata: async () => {} },
    });
    await service.initAgenda();
    await handlers[type]({ attrs: { data: { bookId: String(book._id) } } });
    assert.equal((await Job.findById(job._id)).status, 'failed');
    assert.equal((await Book.findById(book._id)).status, 'error');
    assert.notEqual((await Book.findById(book._id)).processingStatus, 'complete');
  });
}

test('integrity audit detects dangling graph references without modifying records', async () => {
  const Edge = require('../../models/Edge');
  const CanonicalDefinition = require('../../models/CanonicalDefinition');
  const { auditIntegrity } = require('../../services/integrityService');
  const book = await Book.create({ title: 'Fixture', pageCount: 2, status: 'ready' });
  await Page.create({ bookId: book._id, pageNumber: 1 });
  const missingChunk = new mongoose.Types.ObjectId();
  await Edge.create({ fromBookId: book._id, toBookId: book._id, fromChunkId: missingChunk,
    toChunkId: missingChunk, confidence: 'z', method: 'llm' });
  await CanonicalDefinition.create({ concept: 'fixture', definitionBookId: book._id,
    definitionChunkId: missingChunk, source: 'structural' });
  const before = JSON.stringify(await Edge.find().lean());
  const audit = await auditIntegrity();
  assert.equal(audit.issues.edge_missing_chunk.count, 2);
  assert.equal(audit.issues.definition_missing_chunk.count, 1);
  assert.deepEqual(audit.readiness[0].missingPages, [2]);
  assert.equal(audit.readiness[0].chunks, 0);
  assert.equal(JSON.stringify(await Edge.find().lean()), before);
});

for (const expectedPages of [1, 2]) {
  test(`readiness checks the PDF page count, not just existing rows (expected=${expectedPages})`, async () => {
    const book = await Book.create({ title: 'Fixture', pageCount: expectedPages, status: 'processing', s3Key: 'fixture.pdf' });
    await Page.create({ bookId: book._id, pageNumber: 1, rawText: 'A page.', htmlContent: '<p>A page.</p>', visionProcessed: true });
    const Job = require('../../models/Job');
    const job = await Job.create({ bookId: book._id, type: 'generate-html', status: 'pending' });
    const handlers = {};
    class Agenda { define(name, fn) { handlers[name] = fn; } async start() {} }
    const service = load('services/jobService.js', {
      agenda: { Agenda },
      './s3Service': { getPdfBuffer: async () => Buffer.from('fixture') },
      './visionService': { isVisionAvailable: () => true },
      './regexService': { annotateBook: async () => {} },
      './metadataService': { extractBookMetadata: async () => {} },
    });
    await service.initAgenda();
    await handlers['generate-html']({ attrs: { data: { bookId: String(book._id) } } });
    assert.equal((await Job.findById(job._id)).status, expectedPages === 1 ? 'done' : 'failed');
    assert.equal((await Book.findById(book._id)).status, expectedPages === 1 ? 'ready' : 'error');
  });
}

for (const failure of ['returned', 'thrown']) {
  test(`a partial note-matching run preserves existing edges (${failure} picker error)`, async () => {
    const Edge = require('../../models/Edge');
    const notes = await Book.create({ title: 'Notes fixture', kind: 'notes' });
    const paper = await Book.create({ title: 'Paper fixture', kind: 'paper' });
    const targets = await Chunk.create({ bookId: paper._id, pageNumber: 1,
      sourceText: 'A source passage long enough to qualify for candidate selection.', embedding: [1, 0] });
    const chunks = await Chunk.create([1, 2].map(i => ({ bookId: notes._id, pageNumber: i,
      sourceText: 'Research notes.', embedding: [1, 0] })));
    const old = await Edge.create({ fromBookId: notes._id, toBookId: paper._id,
      fromChunkId: chunks[1]._id, toChunkId: targets._id, method: 'note-citation', confidence: 'q' });
    let calls = 0;
    const service = load('services/noteIngestionService.js', {
      './funnelService': { pickAndClassify: async () => {
        if (++calls === 1) return { chunk: targets, confidence: 'z', relevance: 'z', relationship: 'prerequisite' };
        if (failure === 'thrown') throw new Error('Provider unavailable');
        return { error: 'Invalid model output' };
      } },
      './edgeResolverService': { isBibliographyChunk: () => false },
      './embeddingService': { embed: async () => { throw new Error('Fixture should already have embeddings'); } },
    });
    const result = await service.matchNotesToSourceBooks(notes._id);
    assert.equal(result.aborted, true);
    assert.equal(result.pickErrors, 1);
    assert.ok(await Edge.findById(old._id));
    assert.equal(await Edge.countDocuments(), 1);
  });
}
