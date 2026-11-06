// Browser QA for the existing Re pair, against a clean preview or served site.
const {chromium} = require('/home/danger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || '/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',
        args: ['--no-sandbox']
    });
    const results = [];
    try {
        for (const slug of ['reusd-re', 'reusde-re']) {
            for (const width of [1440, 390]) {
                const page = await browser.newPage({viewport: {width, height: 960}});
                const errors = [];
                page.on('pageerror', e => errors.push(e.message));
                await page.goto((process.env.BASE_URL || 'http://127.0.0.1:8893/') + '?asset=' + slug,
                    {waitUntil: 'networkidle'});
                assert.deepEqual(errors, []);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
                    slug + ' ' + width + ' document overflow');
                const text = await page.locator('body').innerText();
                assert.doesNotMatch(text, /sUSDS vault integrity|costs 5560|same answer at every size/);
                assert.match(text, /Coverage (unverified|not established)/);
                if (slug === 'reusd-re') {
                    assert.match(text, /Chain-local secondary exits/);
                    assert.doesNotMatch(await page.locator('#summary-cards').innerText(), /\$10.0M – \$20.0M/);
                }
                for (const axis of ['liquidity', 'backing', 'contract']) {
                    await page.locator('#section-' + axis).evaluate(e =>
                        scrollTo(0, e.getBoundingClientRect().top + scrollY - 60));
                    await page.screenshot({path: `/tmp/re-check-${slug}-${width}-${axis}.png`});
                }
                await page.locator('details').evaluateAll(es => es.forEach(e => e.open = true));
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
                    slug + ' ' + width + ' expanded overflow');
                results.push({slug, width, errors, overflow: false, expandedOverflow: false});
                await page.close();
            }
        }
        fs.writeFileSync('/tmp/re-focused-browser-results.json', JSON.stringify(results, null, 2));
        console.log(JSON.stringify(results));
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
