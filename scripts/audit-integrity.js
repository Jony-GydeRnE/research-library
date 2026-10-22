#!/usr/bin/env node
// Usage: node scripts/audit-integrity.js > integrity-report.json
// Reads MONGODB_URI from the environment/.env. No model calls or DB writes.
// Prefer a restored backup or credentials restricted to read access.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
  try {
    const { auditIntegrity } = require('../services/integrityService');
    console.log(JSON.stringify(await auditIntegrity(), null, 2));
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(err => { console.error(err.message); process.exitCode = 1; });
