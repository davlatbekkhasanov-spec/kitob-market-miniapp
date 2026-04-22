// Thin app entrypoint: delegate full runtime behavior to legacy core module
// while the refactor continues moving domains into dedicated modules.
module.exports = require('./core/legacyApp');
