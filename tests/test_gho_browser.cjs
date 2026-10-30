// Spec §4.0/§4.1: actual standard charts, matching horizons, composition,
// scan-first disclosures, retained evidence and explicit failure states.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require(process.env.PUPPETEER_MODULE || '/tmp/avant-browser-qa/node_modules/puppeteer-core');
const base = process.env.GHO_PREVIEW_URL || 'http://127.0.0.1:8891/';
const preview = process.env.GHO_PREVIEW_DIR || '/tmp/gho-dashboard-preview';
const output = process.env.GHO_QA_DIR || '/tmp/gho-standard-qa';
const selectedFeed = JSON.parse(fs.readFileSync(path.join(preview, 'data/gho_backing.json')));
const adaptive = selectedFeed.liquidity.depth_50bps;
const axis5Candidate = selectedFeed.asset_specific.gho.axis5_assessment;
const scoreReview = selectedFeed.asset_specific.gho.score_review;
const remainingAxes = selectedFeed.asset_specific.gho.remaining_axes_status;
const source = JSON.parse(fs.readFileSync(path.join(preview, 'data/gho_reported_coverage_history.json')));
fs.mkdirSync(output, {recursive: true});
(async () => {
    const browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || '/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',
        headless: true, args: ['--no-sandbox']});
    const results = [];
    try {
        for (const width of [1280, 390]) for (const dark of [false, true]) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.setViewport({width, height: 960});
            await page.goto(base + '?asset=gho&qa=' + Date.now(), {waitUntil: 'networkidle0'});
            await page.evaluate(value => document.body.classList.toggle('dark', value), dark);
            await page.waitForFunction(() => typeof Chart !== 'undefined' && Chart.getChart('peg-chart') && Chart.getChart('cr-chart'));
            await page.addScriptTag({content: fs.readFileSync('tools/visible_text_check.js', 'utf8')});
            const state = await page.evaluate(() => {
                const sections = ['peg', 'backing', 'liquidity', 'dependencies', 'contract', 'issuer'];
                return {
                    headings: sections.map(axis => document.querySelector('#axis-' + axis + '-head .axis-title')?.textContent),
                    cards: [...document.querySelectorAll('#summary-cards .card-value')].map(n => n.innerText),
                    visible: visibleText(document.getElementById('asset-view')),
                    overflow: document.documentElement.scrollWidth > innerWidth,
                    pegDates: Chart.getChart('peg-chart').data.labels.map(Number),
                    coverageDates: Chart.getChart('cr-chart').data.labels.map(Number),
                    coverageValues: Chart.getChart('cr-chart').data.datasets[0].data,
                    pieValues: Chart.getChart('pie-chart').data.datasets[0].data,
                    breakdownRows: document.querySelectorAll('#breakdown-table tbody tr').length,
                    chartTitle: document.querySelector('#chart-panel .panel-title').textContent,
                    tableBeforeEvidence: document.getElementById('breakdown-table').getBoundingClientRect().top < document.querySelector('#section-backing > details').getBoundingClientRect().top,
                    looseBackingEvidence: [...document.querySelectorAll('#section-backing .gho-detail')].some(n => !n.closest('details')),
                    misplaced: [...document.querySelectorAll('.gho-detail')].some(n => !n.closest('.axis-section')),
                    chartBox: document.getElementById('cr-chart').getBoundingClientRect().height,
                    dependencyHead: document.querySelector('#axis-dependencies-head').innerText,
                    remaining: ['dependencies', 'contract', 'issuer'].map(axis => document.querySelector('#axis-' + axis + '-body').innerText),
                    unresolvedDelaysGreen: [...document.querySelectorAll('#axis-contract-body td.tw-ok')].some(n => n.innerText === 'unresolved'),
                    contractCard: document.querySelectorAll('#summary-cards .summary-card')[4].innerText,
                    contractHead: document.querySelector('#axis-contract-head').innerText,
                    liquidityCard: document.querySelectorAll('#summary-cards .summary-card')[2].innerText,
                    liquidityBody: document.querySelector('#axis-liquidity-body').innerText,
                    liquidityTables: document.querySelectorAll('#axis-liquidity-body table').length,
                    liquidityScore: document.querySelector('#axis-liquidity-head').innerText
                };
            });
            assert.ok(state.headings.length === 6 && state.headings.every(Boolean));
            assert.ok(state.cards.length === 6 && state.cards.every(text => text && text !== '—'));
            assert.equal(state.overflow, false);
            assert.equal(state.misplaced, false);
            assert.equal(state.looseBackingEvidence, false);
            assert.equal(state.tableBeforeEvidence, true);
            assert.equal(state.chartTitle, 'Collateral Ratio History');
            assert.ok(state.chartBox > 150);
            const cutoff = Date.now() - 7 * 86400000;
            const expected = source.entries.filter(row => Date.parse(row.timestamp) >= cutoff);
            assert.deepEqual(state.coverageValues, expected.map(row => row.reported_collateral_ratio));
            assert.equal(state.coverageDates.length, expected.length);
            assert.ok(state.coverageDates.length >= 2 && state.pegDates.length >= 2);
            assert.ok([...state.coverageDates, ...state.pegDates].every(t => t >= cutoff - 10000));
            assert.equal(state.breakdownRows, source.latest_composition.rows.length + 1);
            assert.equal(state.pieValues.length, source.latest_composition.rows.length);
            assert.match(state.visible, /153\.76%/);
            assert.match(state.visible, /1203 retained readings/);
            assert.match(state.visible, /Recorded reserve deficit: 13\.575714/);
            assert.match(state.visible, /Independent liquidation value/);
            assert.doesNotMatch(state.visible, /Coverage is not tracked|No single collateral ratio is published|Measured Ethereum issuance|Remote reserve allocation reconciliation/);
            assert.doesNotMatch(state.liquidityScore, /Stress|\/10/);
            if (adaptive) {
                assert.match(state.liquidityCard, /\$22\.4M.*\$33\.4M/);
                assert.doesNotMatch(state.liquidityCard, /floor, not a measurement/);
                assert.match(state.liquidityBody, /lower endpoint is a tested quote/);
                assert.match(state.liquidityBody, /Stop: request_budget; 7 of at most 7 requests/);
            } else {
                assert.match(state.liquidityCard, /≥\$100\.0K/);
                assert.match(state.liquidityCard, /floor, not a measurement/);
                assert.match(state.liquidityBody, /crossing and maximum exit size are not measured/);
            }
            assert.match(state.liquidityCard, /primary exit: not measured/);
            assert.ok(state.liquidityCard.includes('ethereum → USDC · quoted ' + selectedFeed.liquidity.as_of));
            assert.match(state.liquidityCard, /Not rated/);
            assert.equal(state.liquidityTables, 1);
            assert.match(state.liquidityBody, /Market-sized USD notionals, not GHO token counts/);
            assert.doesNotMatch(state.visible, /Invalid Date|NaN|\[object Object\]|Could not load|No risk flags|No exit-mark RFQ ladder/);
            if (remainingAxes) {
                assert.match(state.cards[3], /6 up/);
                assert.doesNotMatch(state.cards[3], /Not mapped/);
                if (scoreReview) {
                    assert.match(state.cards[5], /6\.5\/10/);
                    assert.match(state.dependencyHead, /Dependencies 6(?:\.0)?\/10/);
                    assert.match(state.remaining[2], /Issuer 6\.5\/10/);
                    assert.doesNotMatch(state.cards[4], /6\.0\/10/);
                } else assert.match(state.cards[5], /Review pending/);
                assert.match(state.remaining[0], /239,000,000 GHO origin issuance/);
                assert.match(state.remaining[0], /44\.35% of origin issuance/);
                if (axis5Candidate) {
                    assert.match(state.remaining[1], /2-of-3 Council can expand the mainnet bucket and mint without a DAO queue/);
                    if (!axis5Candidate.owner_review_complete) assert.match(state.remaining[1], /Next eligible increase adds 310m/);
                    if (!axis5Candidate.owner_review_complete) assert.match(state.remaining[1], /not evidence of exploitation/);
                    if (axis5Candidate.score_adopted) {
                        assert.match(state.contractCard, /4(?:\.0)?\/10/);
                        assert.match(state.contractHead, /4(?:\.0)?\/10/);
                    }
                    else assert.doesNotMatch(state.cards[4], /4\.0\/10/);
                } else {
                    assert.match(state.remaining[1], /Monad Council 2-of-3 confirmed/);
                    assert.match(state.remaining[1], /GHO token/);
                    assert.match(state.remaining[1], /Mainnet direct facilitator/);
                    assert.match(state.remaining[1], /Role holder sets are not closed/);
                }
                assert.doesNotMatch(state.remaining[1], /No current producer authority walk/);
                assert.equal(state.unresolvedDelaysGreen, false);
            }
            await page.$$eval('details', nodes => nodes.forEach(n => { n.open = true; }));
            const all = await page.evaluate(() => visibleText(document.getElementById('asset-view')));
            assert.match(all, /Measured Ethereum issuance/);
            assert.match(all, /699,000,000 GHO/);
            assert.match(all, /28,806,163\.966197 USDT/);
            assert.match(all, /Remote reserve allocation reconciliation/);
            assert.match(all, /5,?920 rows/);
            if (remainingAxes) {
                if (scoreReview) {
                    assert.ok(all.includes(selectedFeed.dependencies.underlying_score_basis));
                    assert.ok(all.includes(selectedFeed.issuer.issuer_score_basis));
                    assert.match(all, /riskAnalyst authored review2026-10-30/);
                    if (!axis5Candidate) assert.match(all, /do not inherit historical6\.0/);
                } else {
                    assert.match(all, /Codex-authored research candidate for riskAnalyst/);
                    assert.match(all, /Not an independent owner return or a refreshed published report/);
                }
                if (axis5Candidate) {
                    if (axis5Candidate.score_adopted) {
                        assert.match(all, /Contract & Admin score — 4\.0\/10 · staged/);
                        assert.ok(all.includes(selectedFeed.contract.structural_score_basis));
                        assert.doesNotMatch(all, /not adopted|current numeric score is adopted|Contract & Admin remains unrated/);
                        assert.equal(selectedFeed.contract.structural_score, 4.0);
                        if (axis5Candidate.owner_review_complete) {
                            assert.equal(selectedFeed.contract.structural_score_source, 'riskAnalyst:authored');
                            assert.doesNotMatch(all, /proposal_pending|unreviewed BM proposal/);
                        }
                    } else {
                        assert.match(all, /Proposed Contract & Admin score — 4\.0\/10 · not adopted/);
                        assert.ok(all.includes(selectedFeed.contract.proposed_structural_score_basis));
                    }
                    assert.match(all, /not a permanent lifetime ceiling|not a lifetime ceiling|No immutable aggregate ceiling/);
                    assert.ok(all.includes(selectedFeed.contract.authority_note));
                    assert.match(all, /Current Immunefi AAVE terms list a \$1m critical maximum/);
                    assert.doesNotMatch(all, /No repeat blanket authority handoff is needed.*No current producer/);
                } else {
                    assert.match(all, /current combined assessment unrated/);
                    assert.match(all, /Aave publishes an Immunefi core bounty/);
                }
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.$$eval('details', nodes => nodes.forEach(n => { n.open = false; }));
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({path: path.join(output, `gho-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true});
            assert.deepEqual(errors, []);
            results.push({width, dark, pegRows: state.pegDates.length, coverageRows: state.coverageValues.length, retainedCoverageRows: source.entries.length, status: 'PASS'});
            await page.close();
        }
        for (const filename of ['gho_peg_history.json', 'gho_reported_coverage_history.json']) {
            const page = await browser.newPage();
            await page.setRequestInterception(true);
            page.on('request', request => new URL(request.url()).pathname.endsWith('/' + filename)
                ? request.respond({status: 404, body: 'missing'}) : request.continue());
            await page.goto(base + '?asset=gho&missing=' + filename, {waitUntil: 'networkidle0'});
            if (filename.startsWith('gho_peg')) {
                assert.match(await page.$eval('#section-peg', n => n.innerText), /history unavailable|history not tracked/i);
                assert.ok(await page.evaluate(() => !!Chart.getChart('cr-chart')));
            } else {
                await page.waitForFunction(() => document.getElementById('chart-panel').innerText.includes('could not be loaded'));
                assert.equal(await page.evaluate(() => !!Chart.getChart('cr-chart')), false);
                assert.match(await page.$eval('.gho-overview', n => n.innerText), /153\.76%/);
            }
            await page.close();
        }
        const sparse = await browser.newPage();
        await sparse.evaluateOnNewDocument(() => { Date.now = () => Date.parse('2026-11-10T00:00:00Z'); });
        await sparse.goto(base + '?asset=gho&sparse-window=1', {waitUntil: 'networkidle0'});
        assert.match(await sparse.$eval('#chart-panel', n => n.innerText), /No wider history is substituted/);
        assert.equal(await sparse.evaluate(() => !!Chart.getChart('cr-chart')), false);
        assert.match(await sparse.$eval('#section-peg', n => n.innerText), /Insufficient paired/);
        await sparse.close();
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({status: 'PASS', results, missingPegHistory: 'PASS', missingCoverageHistory: 'PASS', sparseSharedWindow: 'PASS'}, null, 2));
        console.log('PASS: standard GHO collateral chart + peg share 7-day horizon, 1203 retained observations, composition, scan-first disclosures, four layouts and both history failure states');
    } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exit(1);});
