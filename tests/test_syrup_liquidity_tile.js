const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
if(!process.argv[2])throw new Error('Usage: node tests/test_syrup_liquidity_tile.js <candidate-renderer.js>');
const c={console,window:{}};vm.createContext(c);
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nglobalThis.common=CommonRenderer',c);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8')+'\nglobalThis.syrup=SyrupUSDCRenderer',c);
const pool='0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b';
function fixture(){return {asset_specific:{vault_state:{pool}},liquidity:{free_liquidity_pct:1.87,exit_mark:{token_address:pool,chain:'ethereum',timestamp:'2026-11-11T04:31:39Z',status:'partial',failed_rungs:{10000:'http_530'},depth:{primary_threshold_bps:200,total_2pct_depth:1000000,total_2pct_depth_is_floor:true,two_pct_depth_size_responsive:true,depth_50bps:{threshold_bps:50,depth_usd:1000000,is_floor:true,status:'ladder_exhausted'}}}}};}
let d=fixture(),html=c.syrup._liquidityTileHtml(d);
assert.match(html,/1\.9% pool cash/);assert.match(html,/Ethereum DEX ≥\$1\.0M/);assert.match(html,/0\.5% price impact · tested floor · partial ladder/);assert.match(html,/2026-11-11 04:31:39 UTC/);
d=fixture();d.liquidity.exit_mark.token_address='0x0000000000000000000000000000000000000001';html=c.syrup._liquidityTileHtml(d);assert.match(html,/Unmeasured/);assert.doesNotMatch(html,/≥/);
d=fixture();d.liquidity.exit_mark.depth={};html=c.syrup._liquidityTileHtml(d);assert.match(html,/Unmeasured/);assert.doesNotMatch(html,/\$0/);
d=fixture();d.liquidity.exit_mark.depth.two_pct_depth_size_responsive=false;html=c.syrup._liquidityTileHtml(d);assert.match(html,/Unmeasured/);assert.doesNotMatch(html,/tested floor/);
d=fixture();delete d.liquidity.exit_mark.depth.depth_50bps;html=c.syrup._liquidityTileHtml(d);assert.match(html,/2% price impact/);assert.doesNotMatch(html,/0\.5%/);
d=fixture();d.liquidity.exit_mark.depth.depth_50bps={threshold_bps:50,depth_usd:500000,status:'bracketed',bracket:[500000,1000000]};html=c.syrup._liquidityTileHtml(d);assert.match(html,/\$500\.0K–\$1\.0M/);assert.match(html,/bracket/);assert.doesNotMatch(html,/≥/);
console.log('PASS cash/depth separation, threshold/floor/bracket/clock preservation and wrong-token/missing/unresponsive guards.');
