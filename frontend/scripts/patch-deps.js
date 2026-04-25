const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const srcDir = path.join(root, 'node_modules/dompurify/src');
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

const stubs = ['utils.ts', 'tags.ts', 'attrs.ts', 'regexp.ts', 'purify.ts'];
for (const stub of stubs) {
  const p = path.join(srcDir, stub);
  if (!fs.existsSync(p)) fs.writeFileSync(p, '');
}
