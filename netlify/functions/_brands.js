// Brand resolution for the dual-brand platform (Harvey Greystone / Capital Streams).
// Source of truth is public/brands.json (also fetched by client pages).
const fs = require('fs');
const path = require('path');

let CONFIG = null;
function config() {
  if (!CONFIG) {
    CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'brands.json'), 'utf8'));
  }
  return CONFIG;
}

// hostname (may include :port) + optional explicit override -> brand key
function resolveBrand(hostname, override) {
  const cfg = config();
  if (override && cfg.brands[override]) return override;
  const host = String(hostname || '').toLowerCase().split(':')[0];
  for (const [key, b] of Object.entries(cfg.brands)) {
    if ((b.hostnames || []).includes(host)) return key;
  }
  return cfg.default;
}

// brand key -> full config object (with key included); unknown -> default brand
function getBrand(key) {
  const cfg = config();
  const k = cfg.brands[key] ? key : cfg.default;
  return { key: k, ...cfg.brands[k] };
}

module.exports = { resolveBrand, getBrand };
