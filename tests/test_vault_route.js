const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/app.js','utf8');const start=source.indexOf('function isPublished('),end=source.indexOf('// Cache-bust',start);
const context={};vm.runInNewContext(source.slice(start,end)+';this.path=vaultDashboardPath;',context);
const asset={published:true,slug:'fxsp',dashboard_kind:'vault',dashboard_path:'vaults/fxsp/'};
assert.equal(context.path(asset),'vaults/fxsp/');
for(const value of [{...asset,published:false},{...asset,dashboard_path:'https://example.com/'},{...asset,dashboard_path:'vaults/fxsave/'},{...asset,slug:'../fxsp'},{...asset,dashboard_kind:'asset'},null])assert.equal(context.path(value),null);
console.log('PASS exact published same-site vault routes only; other assets and staged/unsafe paths unchanged.');
