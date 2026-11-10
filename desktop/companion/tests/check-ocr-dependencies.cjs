'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const version='1.8.0';
const found=require.resolve('wasm-feature-detect');
let dir=path.dirname(found),meta=null;
for(let i=0;i<8;i++){
 const file=path.join(dir,'package.json');
 if(fs.existsSync(file)){
  const candidate=JSON.parse(fs.readFileSync(file,'utf8'));
  if(candidate.name==='wasm-feature-detect'){meta=candidate;break;}
 }
 const parent=path.dirname(dir);
 if(parent===dir)break;
 dir=parent;
}
assert.ok(meta,'wasm-feature-detect must be installed in the OCR dependency tree');
assert.equal(meta.version,version,
 'do not ship wasm-feature-detect 1.9.0 because it uses import.source() unsupported by Electron');
const source=fs.readFileSync(found,'utf8');
assert.ok(!source.includes('import.source('),'the CJS OCR detector must not use import.source()');
assert.equal(typeof require('tesseract.js').createWorker,'function',
 'Tesseract OCR worker API should resolve before creating the installer');
console.log('OCR dependency compatible:',meta.version);
