// Isolated review of the shared app. No production registry or fetch behavior changes.
(function() {
    if(!location.search)history.replaceState(null,'',location.pathname+'?asset=fxsave');
    var original=window.fetch.bind(window);
    window.fetch=function(input, options) {
        var url=new URL(typeof input==='string' ? input : input.url,document.baseURI);
        var match=url.pathname.match(/\/data\/(assets\.json|fxsave_[a-z_]+\.json)$/);
        if(url.origin===location.origin && match) {
            url.pathname=new URL('previews/fxsave/data/'+match[1],document.baseURI).pathname;
            return original(url.href,options);
        }
        return original(input,options);
    };
}());
