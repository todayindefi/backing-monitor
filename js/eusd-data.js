/** Staging-only immutable generation loader. Never serves a mixed/unverified set. */
var EusdData = (function () {
    var originalFetch = window.fetch.bind(window), selected = null;
    var base = new URL('data/', window.location.href);
    var expected = ['assets.json','eusd_backing.json','eusd_product.json','eusd_peg_history.json'];
    async function digest(bytes) { var b=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join(''); }
    async function read(url) { var r=await originalFetch(url,{cache:'no-store'});if(!r.ok)throw Error('Canonical feed response '+r.status);return r; }
    async function bootstrap() {
        var response=await read(new URL('current.json?attempt='+Date.now(),base));var pointer=await response.json();
        if(pointer.schema_version!=='eusd-staging-feed-pointer/1'||!/^[a-f0-9]{64}$/.test(pointer.generation)||pointer.manifest!=='generations/'+pointer.generation+'/manifest.json'||pointer.manifest_sha256!==pointer.generation)throw Error('Invalid canonical generation pointer');
        var mr=await read(new URL(pointer.manifest,base)),mb=await mr.arrayBuffer();
        if(await digest(mb)!==pointer.manifest_sha256)throw Error('Canonical generation manifest hash mismatch');
        var manifest=JSON.parse(new TextDecoder().decode(mb));
        if(manifest.schema_version!=='eusd-staging-generation/1'||manifest.identity.chain_id!==1||manifest.identity.token.toLowerCase()!=='0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f'||JSON.stringify(Object.keys(manifest.files).sort())!==JSON.stringify(expected.slice().sort()))throw Error('Canonical identity or inventory mismatch');
        var bodies={};await Promise.all(expected.map(async function(name){var r=await read(new URL('generations/'+pointer.generation+'/'+name,base));var raw=await r.arrayBuffer();if(raw.byteLength!==manifest.files[name].bytes||await digest(raw)!==manifest.files[name].sha256)throw Error('Canonical evidence hash mismatch: '+name);var text=new TextDecoder().decode(raw);JSON.parse(text);bodies[name]=text;}));
        var backing=JSON.parse(bodies['eusd_backing.json']);
        if(backing.asset_slug!=='eusd'||backing.chain_id!==1||backing.asset_specific.reserve_eusd.identity.token.toLowerCase()!==manifest.identity.token.toLowerCase())throw Error('Canonical asset binding mismatch');
        selected={pointer:pointer,manifest:manifest,bodies:bodies};return selected;
    }
    window.fetch=function(input,options){var url=new URL(typeof input==='string'?input:input.url,window.location.href);if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)){var name=url.pathname.slice(base.pathname.length);if(!selected)return Promise.reject(Error('Canonical evidence has not been verified'));if(Object.prototype.hasOwnProperty.call(selected.bodies,name))return Promise.resolve(new Response(selected.bodies[name],{status:200,headers:{'Content-Type':'application/json'}}));return Promise.resolve(new Response('{"status":"not_selected"}',{status:404,headers:{'Content-Type':'application/json'}}));}return originalFetch(input,options);};
    return {bootstrap:bootstrap,get selected(){return selected;}};
})();
