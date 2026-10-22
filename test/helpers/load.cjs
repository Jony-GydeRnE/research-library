const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Load the real service with explicit I/O doubles; never open a production DB
// or call a paid model from the regression suite.
exports.load = function load(relativePath, doubles = {}, globals = {}) {
  const filename = path.resolve(__dirname, '../..', relativePath);
  const nativeRequire = createRequire(filename);
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, __filename: filename,
    __dirname: path.dirname(filename), console, Buffer, setTimeout, clearTimeout,
    process: { env: {} },
    require: name => Object.hasOwn(doubles, name) ? doubles[name] : nativeRequire(name),
    ...globals,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return module.exports;
};

exports.query = function query(value) {
  return { select() { return this; }, sort() { return this; },
    limit() { return this; }, lean: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
};
