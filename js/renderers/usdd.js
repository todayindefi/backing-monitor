/**
 * USDD renderer
 *
 * Panel order (optimized for crisis monitoring):
 * 1. PSM Exit Liquidity (first thing to check in a crisis)
 * 2. Supply by Chain (with inline PSM coverage)
 * 3. Collateral Composition (HTX vs Independent)
 * 4. Vault Types (per-ilk on-chain data)
 * 5. TRX Stress Test
 * 6. PSM Flow (drain rate)
 * 7. HTX Overlap Analysis
 * 8. Peg Status
 *
 * Explorer links: Tronscan, Etherscan, BSCScan for all key contracts.
 */

var USDDRenderer = {

    // Block explorer URL helpers
    _tronLink: function(addr) {
        return '<a href="https://tronscan.org/#/contract/' + addr + '" target="_blank" class="text-blue-500 hover:underline text-xs" title="View on Tronscan">\u2197</a>';
    },
    _ethLink: function(addr) {
        return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" class="text-blue-500 hover:underline text-xs" title="View on Etherscan">\u2197</a>';
    },
    _bscLink: function(addr) {
        return '<a href="https://bscscan.com/address/' + addr + '" target="_blank" class="text-blue-500 hover:underline text-xs" title="View on BSCScan">\u2197</a>';
    },

    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'usdd') return;

        var html = '';
        var s = data.summary;
        var supply = specific.supply_by_chain;
        var psm = specific.psm_by_chain;
        var self = this;

        // Known contract addresses for explorer links
        var CONTRACTS = {
            tron_vat: 'TH5dhX7o39afSbfDT2e3c9k4itWjNKD4D9',
            tron_psm: 'TSUYvQ5tdd3DijCD1uGunGLpftHuSZ12sQ',
            tron_token: 'TXDk8mbtRbXeYuMNS83CfKPaYYT8XWv9Hz',
            eth_vat: '0xff77f6209239deb2c076179499f2346b0032097f',
            eth_psm: '0x217e42ceb2eae9ecb788fdf0e31c806c531760a3',
            eth_token: '0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c6',
            bsc_vat: '0x41f1402ab4d900115d1f16a14a3cf4bdf2f2705c',
            bsc_psm: '0xe229FdA620B8a9B98ef184830EE3063F0F86B790',
            bsc_token: '0xd17479997F34DD9156Deef8F95A52D81D265be9c',
            sa_eth: '0xD00e0079B8CAB524F3fa20EA879a7736E512a5Fc',
            sa_tron: 'TKVnVyJiTzyCDgTkZRYc5LM4q8B7xXEbh5',
            htx_eth: '0x18709E89BD403F470088aBDAcEbE86CC60dda12e',
            htx_tron: 'TDToUxX8sH4z6moQpK3ZLAN24eupu2ivA4',
        };

        // ====== 1. PSM Exit Liquidity ======
        if (psm) {
            var totalPsm = specific.psm_total_usd || 0;
            var totalCov = specific.psm_coverage_pct || 0;
            var covCls = totalCov >= 30 ? 'positive' : totalCov >= 15 ? 'warning' : 'negative';

            html += '<div class="panel">' +
                '<div class="panel-title">PSM Exit Liquidity</div>' +
                '<p class="text-sm text-slate-500 mb-3">Peg Stability Module: 1:1 USDT redemption. This is the "real exit" for USDD holders.</p>' +
                '<div class="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">Total PSM Reserves</div><div class="card-value">' + CommonRenderer.formatCurrency(totalPsm) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Total Coverage</div><div class="card-value ' + covCls + '">' + CommonRenderer.formatPercent(totalCov, 1) + '</div><div class="text-xs text-slate-400 mt-1">of total supply</div></div>' +
                '</div>' +
                '<table class="data-table"><thead><tr><th>Chain</th><th class="text-right">PSM USDT</th><th class="text-right">USDD Supply</th><th class="text-right">Coverage</th><th></th></tr></thead><tbody>';

            var chainOrder = ['tron', 'ethereum', 'bsc'];
            var chainNames = { tron: 'Tron', ethereum: 'Ethereum', bsc: 'BNB Chain' };
            var psmContracts = { tron: CONTRACTS.tron_psm, ethereum: CONTRACTS.eth_psm, bsc: CONTRACTS.bsc_psm };
            var linkFns = { tron: self._tronLink, ethereum: self._ethLink, bsc: self._bscLink };
            chainOrder.forEach(function(chain) {
                var p = psm[chain] || {};
                var covPct = p.coverage_pct || 0;
                var pctCls = covPct >= 50 ? 'text-green-600' : covPct >= 15 ? 'text-amber-600' : 'text-red-600';
                html += '<tr><td class="font-medium">' + chainNames[chain] + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(p.reserves_usd || 0) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(p.chain_supply || 0) + '</td>' +
                    '<td class="text-right font-mono ' + pctCls + '">' + CommonRenderer.formatPercent(covPct, 1) + '</td>' +
                    '<td class="text-right">' + linkFns[chain](psmContracts[chain]) + '</td></tr>';
            });
            html += '<tr class="font-bold border-t-2 border-slate-200"><td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(totalPsm) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(supply ? supply.total : 0) + '</td>' +
                '<td class="text-right font-mono ' + covCls + '">' + CommonRenderer.formatPercent(totalCov, 1) + '</td>' +
                '<td></td></tr></tbody></table></div>';
        }

        // ====== 2. Supply by Chain (with inline PSM coverage) ======
        if (supply) {
            var total = supply.total || 1;
            var chains = [
                { name: 'Tron', key: 'tron', val: supply.tron, color: '#ef4444', link: self._tronLink(CONTRACTS.tron_token) },
                { name: 'Ethereum', key: 'ethereum', val: supply.ethereum, color: '#3b82f6', link: self._ethLink(CONTRACTS.eth_token) },
                { name: 'BNB Chain', key: 'bsc', val: supply.bsc, color: '#f59e0b', link: self._bscLink(CONTRACTS.bsc_token) }
            ];

            html += '<div class="panel">' +
                '<div class="panel-title">Supply by Chain</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">';
            chains.forEach(function(c) {
                var pct = (c.val / total * 100).toFixed(1);
                var psmCov = psm && psm[c.key] ? psm[c.key].coverage_pct : 0;
                var psmCls = psmCov >= 50 ? 'text-green-600' : psmCov >= 15 ? 'text-amber-600' : 'text-red-600';
                html += '<div class="summary-card">' +
                    '<div class="card-label">' + c.name + ' ' + c.link + '</div>' +
                    '<div class="card-value">' + CommonRenderer.formatCurrency(c.val) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + pct + '% of total</div>' +
                    '<div class="text-xs mt-1 ' + psmCls + '">' + CommonRenderer.formatPercent(psmCov, 0) + ' PSM exit</div>' +
                    '</div>';
            });
            html += '</div>' +
                '<div class="h-4 rounded-full overflow-hidden flex" style="background:#e2e8f0">';
            chains.forEach(function(c) {
                var pct = c.val / total * 100;
                if (pct > 0.5) html += '<div style="width:' + pct + '%;background:' + c.color + '" title="' + c.name + ': ' + pct.toFixed(1) + '%"></div>';
            });
            html += '</div>' +
                '<div class="flex justify-between text-xs text-slate-400 mt-1">';
            chains.forEach(function(c) {
                html += '<span><span style="color:' + c.color + '">\u25cf</span> ' + c.name + '</span>';
            });
            html += '</div></div>';
        }

        // ====== 3. Collateral Composition (HTX vs Independent) ======
        var coll = specific.collateral;
        if (coll) {
            var htxPct = coll.htx_pct || 0;
            var indPct = 100 - htxPct;
            var indCr = s.collateral_ratio_alt ? s.collateral_ratio_alt.value : 0;
            var indCls = indCr >= 30 ? 'positive' : indCr >= 15 ? 'warning' : 'negative';

            html += '<div class="panel">' +
                '<div class="panel-title">Collateral Composition</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">HTX-Sourced</div><div class="card-value negative">' + CommonRenderer.formatCurrency(coll.htx_total) + '</div><div class="text-xs text-slate-400 mt-1">' + htxPct.toFixed(0) + '% of backing</div></div>' +
                    '<div class="summary-card"><div class="card-label">Independent (Users)</div><div class="card-value positive">' + CommonRenderer.formatCurrency(coll.independent_total) + '</div><div class="text-xs text-slate-400 mt-1">' + indPct.toFixed(0) + '% of backing</div></div>' +
                    '<div class="summary-card"><div class="card-label">Independent CR</div><div class="card-value ' + indCls + '">' + CommonRenderer.formatPercent(indCr) + '</div><div class="text-xs text-slate-400 mt-1">User vaults only</div></div>' +
                    '<div class="summary-card"><div class="card-label">Total Backing</div><div class="card-value">' + CommonRenderer.formatCurrency(coll.total) + '</div></div>' +
                '</div>' +
                '<div class="h-4 rounded-full overflow-hidden flex" style="background:#e2e8f0">' +
                    '<div style="width:' + htxPct + '%;background:#ef4444" title="HTX ' + htxPct.toFixed(0) + '%"></div>' +
                    '<div style="width:' + indPct + '%;background:#22c55e" title="Independent ' + indPct.toFixed(0) + '%"></div>' +
                '</div>' +
                '<div class="flex justify-between text-xs text-slate-400 mt-1">' +
                    '<span><span style="color:#ef4444">\u25cf</span> HTX (SA + PSM)</span>' +
                    '<span><span style="color:#22c55e">\u25cf</span> Independent (User Vaults)</span>' +
                '</div>';

            var sa = coll.smart_allocator;
            if (sa && sa.total > 0) {
                html += '<table class="data-table mt-4"><thead><tr><th>Smart Allocator</th><th class="text-right">Debt (USDD minted)</th><th></th></tr></thead><tbody>' +
                    '<tr><td>Tron SA001-A</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sa.tron) + '</td><td class="text-right">' + self._tronLink(CONTRACTS.sa_tron) + '</td></tr>' +
                    '<tr><td>Ethereum SA001-A</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sa.ethereum) + '</td><td class="text-right">' + self._ethLink(CONTRACTS.sa_eth) + '</td></tr>' +
                    '<tr class="font-bold border-t-2 border-slate-200"><td>Total SA (HTX)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sa.total) + '</td><td></td></tr>' +
                    '</tbody></table>';
            }
            html += '<p class="text-xs text-slate-400 mt-2">SA funded from HTX addresses (<a href="https://protos.com/usdd-assets-htx-justin-sun-justlend/" target="_blank" class="text-blue-500 hover:underline">Protos</a>). Admin multisig can access all funds (zero timelock, <a href="https://usdd.io/USDD-V2-audit-report.pdf" target="_blank" class="text-blue-500 hover:underline">ChainSecurity audit</a>).</p></div>';
        }

        // ====== 4. Vault Types (On-Chain) ======
        var ilks = specific.ilks;
        if (ilks && Object.keys(ilks).length > 0) {
            var vatLinks = {
                tron: ' ' + self._tronLink(CONTRACTS.tron_vat),
                ethereum: ' ' + self._ethLink(CONTRACTS.eth_vat),
                bsc: ' ' + self._bscLink(CONTRACTS.bsc_vat),
            };
            html += '<div class="panel">' +
                '<div class="panel-title">Vault Types (On-Chain)</div>' +
                '<p class="text-sm text-slate-500 mb-3">MakerDAO-fork VAT data queried directly from on-chain contracts.' +
                ' Tron' + vatLinks.tron + ' ETH' + vatLinks.ethereum + ' BSC' + vatLinks.bsc + '</p>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Chain</th><th>Ilk</th><th class="text-right">Debt</th><th class="text-right">Ceiling</th><th class="text-right">Util.</th><th>Source</th>' +
                '</tr></thead><tbody>';

            Object.entries(ilks).sort(function(a, b) { return b[1].debt - a[1].debt; }).forEach(function(e) {
                var ilk = e[1];
                var utilCls = ilk.utilization_pct > 90 ? 'text-red-600 font-bold' : ilk.utilization_pct > 70 ? 'text-amber-600' : '';
                var chainLabel = ilk.chain === 'tron' ? 'Tron' : ilk.chain === 'ethereum' ? 'ETH' : 'BSC';
                var sourceTag = ilk.is_htx ?
                    '<span class="tag tag-htx">HTX</span>' :
                    '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">User</span>';
                html += '<tr><td class="text-sm">' + chainLabel + '</td>' +
                    '<td class="font-medium">' + ilk.ilk + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ilk.debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ilk.ceiling) + '</td>' +
                    '<td class="text-right font-mono ' + utilCls + '">' + CommonRenderer.formatPercent(ilk.utilization_pct, 0) + '</td>' +
                    '<td>' + sourceTag + '</td></tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // ====== 5. TRX Stress Test ======
        var stress = specific.stress_test;
        if (stress && stress.scenarios) {
            var trxPrice = stress.trx_price;
            var trxChange = specific.trx_price ? specific.trx_price['24h_change_pct'] : null;

            html += '<div class="panel">' +
                '<div class="panel-title">TRX Stress Test</div>' +
                '<p class="text-sm text-slate-500 mb-3">TRX + sTRX collateral (' + CommonRenderer.formatCurrency(stress.trx_exposed_usd) + ') drops with TRX price. Stable backing (' + CommonRenderer.formatCurrency(stress.stable_backing_usd) + ') = SA + PSM + USDT vaults.</p>' +
                '<div class="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">TRX Price</div><div class="card-value">$' + (trxPrice ? trxPrice.toFixed(4) : '-') + '</div>' +
                    (trxChange !== null ? '<div class="text-xs mt-1 ' + (trxChange < -5 ? 'text-red-500' : 'text-slate-400') + '">' + (trxChange >= 0 ? '+' : '') + trxChange.toFixed(1) + '% 24h</div>' : '') +
                    '</div>' +
                    '<div class="summary-card"><div class="card-label">TRX Exposure</div><div class="card-value warning">' + CommonRenderer.formatCurrency(stress.trx_exposed_usd) + '</div><div class="text-xs text-slate-400 mt-1">' + (stress.trx_exposed_usd / (s.total_backing || 1) * 100).toFixed(0) + '% of backing</div></div>' +
                '</div>' +
                '<table class="data-table"><thead><tr><th>Scenario</th><th class="text-right">TRX Backing</th><th class="text-right">Total Backing</th><th class="text-right">CR</th><th>Status</th></tr></thead><tbody>' +
                '<tr class="font-bold"><td>Current</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(stress.trx_exposed_usd) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(s.total_backing) + '</td>' +
                    '<td class="text-right font-mono positive">' + CommonRenderer.formatPercent(s.collateral_ratio) + '</td>' +
                    '<td><span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span></td></tr>';

            Object.entries(stress.scenarios).sort(function(a, b) { return a[1].drop_pct - b[1].drop_pct; }).forEach(function(e) {
                var sc = e[1];
                var crCls = sc.cr_pct >= 110 ? 'positive' : sc.cr_pct >= 100 ? 'warning' : 'negative';
                var badge = sc.cr_pct >= 100 ?
                    '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span>' :
                    '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">UNDER</span>';
                html += '<tr><td>TRX -' + sc.drop_pct + '%</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(sc.trx_backing_usd) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(sc.total_backing_usd) + '</td>' +
                    '<td class="text-right font-mono ' + crCls + '">' + CommonRenderer.formatPercent(sc.cr_pct) + '</td>' +
                    '<td>' + badge + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        // ====== 6. PSM Flow ======
        var psmDelta = specific.psm_delta;
        if (psmDelta) {
            // Prefer 24h delta if available, fall back to run-over-run
            var has24h = psmDelta.h24_delta_usd !== null && psmDelta.h24_delta_usd !== undefined;
            var deltaUsd = has24h ? psmDelta.h24_delta_usd : psmDelta.run_delta_usd;
            var deltaPct = has24h ? psmDelta.h24_delta_pct : psmDelta.run_delta_pct;
            var prevUsd = has24h ? psmDelta.h24_previous_usd : psmDelta.run_previous_usd;
            var label = has24h ? '24h Change' : 'Last Run Change';
            var deltaCls = psmDelta.draining ? 'negative' : (deltaPct !== null && deltaPct < -5 ? 'warning' : (deltaPct !== null && deltaPct > 0 ? 'positive' : ''));

            html += '<div class="panel">' +
                '<div class="panel-title">PSM Flow (' + label + ')</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">' +
                    '<div class="summary-card"><div class="card-label">Previous</div><div class="card-value">' + CommonRenderer.formatCurrency(prevUsd) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Current</div><div class="card-value">' + CommonRenderer.formatCurrency(psmDelta.current_usd) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Change</div><div class="card-value ' + deltaCls + '">' + (deltaUsd !== null ? (deltaUsd >= 0 ? '+' : '-') + CommonRenderer.formatCurrency(Math.abs(deltaUsd)) : '-') + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Change %</div><div class="card-value ' + deltaCls + '">' + (deltaPct !== null ? (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(1) + '%' : '-') + '</div>' +
                    (psmDelta.draining ? '<div class="text-xs text-red-500 mt-1 font-bold">DRAINING</div>' : '') + '</div>' +
                '</div></div>';
        }

        // ====== 7. HTX Overlap Analysis (all 21 addresses) ======
        var htx = specific.htx_overlap;
        if (htx) {
            var eth = htx.ethereum || {};
            var tron = htx.tron || {};
            var nEthAave = (eth.htx_aave_usdt_addrs || []).length;
            var nTronJl = (tron.htx_justlend_usdt_addrs || []).length;

            html += '<div class="panel">' +
                '<div class="panel-title">HTX Overlap Analysis (All 21 PoR Addresses)</div>' +
                '<p class="text-sm text-slate-500 mb-3">Checks all HTX proof-of-reserves addresses for lending positions and USDD contract interactions. Compares against SA positions for double-counting.</p>';

            // Summary cards
            html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
                '<div class="summary-card"><div class="card-label">HTX Aave USDT</div><div class="card-value">' + CommonRenderer.formatCurrency(eth.htx_aave_usdt_total) + '</div><div class="text-xs text-slate-400 mt-1">' + nEthAave + ' address(es)</div></div>' +
                '<div class="summary-card"><div class="card-label">SA Aave USDT</div><div class="card-value ' + (eth.sa_aave_usdt > 0 ? 'negative' : 'positive') + '">' + (eth.sa_aave_usdt > 0 ? CommonRenderer.formatCurrency(eth.sa_aave_usdt) : '$0 (Spark)') + '</div></div>' +
                '<div class="summary-card"><div class="card-label">HTX JustLend</div><div class="card-value">' + CommonRenderer.formatCurrency(tron.htx_justlend_usdt_total) + '</div><div class="text-xs text-slate-400 mt-1">' + nTronJl + ' address(es)</div></div>' +
                '<div class="summary-card"><div class="card-label">SA JustLend</div><div class="card-value">' + CommonRenderer.formatCurrency(tron.sa_justlend_usdt) + '</div></div>' +
                '</div>';

            // Comparison table
            html += '<table class="data-table"><thead><tr><th>Chain</th><th>Entity</th><th class="text-right">Aave/Spark</th><th class="text-right">JustLend</th><th class="text-right">USDD Held</th></tr></thead><tbody>' +
                '<tr><td rowspan="2">Ethereum</td><td>HTX (' + nEthAave + ' addr) <span class="tag tag-htx">HTX</span></td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(eth.htx_aave_usdt_total) + '</td>' +
                '<td class="text-right font-mono text-slate-400">-</td>' +
                '<td class="text-right font-mono">' + (eth.htx_usdd_total > 0 ? CommonRenderer.formatCurrency(eth.htx_usdd_total) : '-') + '</td></tr>' +
                '<tr><td>SA (USDD)</td>' +
                '<td class="text-right font-mono">' + (eth.sa_aave_usdt > 0 ? CommonRenderer.formatCurrency(eth.sa_aave_usdt) : '<span class="text-green-600">$0 (uses Spark)</span>') + '</td>' +
                '<td class="text-right font-mono text-slate-400">-</td><td></td></tr>' +
                '<tr><td rowspan="2">Tron</td><td>HTX (' + nTronJl + ' addr) <span class="tag tag-htx">HTX</span></td>' +
                '<td class="text-right font-mono text-slate-400">-</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(tron.htx_justlend_usdt_total) + '</td>' +
                '<td class="text-right font-mono">' + (tron.htx_usdd_total > 0 ? CommonRenderer.formatCurrency(tron.htx_usdd_total) : '-') + '</td></tr>' +
                '<tr><td>SA (USDD)</td>' +
                '<td class="text-right font-mono text-slate-400">-</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(tron.sa_justlend_usdt) + '</td><td></td></tr>' +
                '</tbody></table>';

            // VAT positions (if any HTX address has direct vault positions)
            var vatPos = tron.htx_vat_positions || [];
            if (vatPos.length > 0) {
                html += '<div class="risk-flag risk-critical" style="margin-top:0.75rem"><strong>ALERT:</strong> ' + vatPos.length + ' HTX address(es) have direct positions in USDD vaults:</div>' +
                    '<table class="data-table mt-2"><thead><tr><th>Address</th><th>Ilk</th><th class="text-right">Collateral</th><th class="text-right">Debt</th></tr></thead><tbody>';
                vatPos.forEach(function(p) {
                    html += '<tr><td class="font-mono text-xs">' + p.address.slice(0, 10) + '...</td><td>' + p.ilk + '</td>' +
                        '<td class="text-right font-mono">' + p.ink.toLocaleString() + '</td>' +
                        '<td class="text-right font-mono">' + p.art.toLocaleString() + '</td></tr>';
                });
                html += '</tbody></table>';
            }

            var verdictCls = htx.double_counted ? 'risk-flag risk-critical' : 'risk-flag risk-info';
            html += '<div class="' + verdictCls + '" style="margin-top:0.75rem">' +
                '<strong>Verdict:</strong> ' + (htx.verdict || 'Checking...') + '</div>';

            html += '</div>';
        }

        // ====== 8. HTX Wallet Monitor ======
        var htxW = specific.htx_wallets;
        if (htxW) {
            var ethT = htxW.ethereum ? htxW.ethereum.totals : {};
            var tronT = htxW.tron ? htxW.tron.totals : {};
            var ethAddrs = htxW.ethereum ? htxW.ethereum.addresses : [];
            var tronAddrs = htxW.tron ? htxW.tron.addresses : [];

            html += '<div class="panel">' +
                '<div class="panel-title">HTX Wallet Monitor (21 PoR Addresses)</div>' +
                '<p class="text-sm text-slate-500 mb-3">Live balances across all HTX proof-of-reserves addresses. Source: <a href="https://github.com/huobiapi/Tool-Node.js-VerifyAddress/tree/main/snapshot" target="_blank" class="text-blue-500 hover:underline">HTX PoR CSV</a></p>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">Stablecoin Total</div><div class="card-value">' + CommonRenderer.formatCurrency(htxW.grand_total_usd) + '</div><div class="text-xs text-slate-400 mt-1">USDT + lending positions</div></div>' +
                    '<div class="summary-card"><div class="card-label">Aave aUSDT</div><div class="card-value">' + CommonRenderer.formatCurrency(ethT.aave_usdt || 0) + '</div><div class="text-xs text-slate-400 mt-1">Ethereum</div></div>' +
                    '<div class="summary-card"><div class="card-label">TRX Holdings</div><div class="card-value">' + ((tronT.trx || 0) / 1e9).toFixed(2) + 'B TRX</div><div class="text-xs text-slate-400 mt-1">~$' + ((tronT.trx || 0) * 0.315 / 1e6).toFixed(0) + 'M</div></div>' +
                    '<div class="summary-card"><div class="card-label">Active Wallets</div><div class="card-value">' + (ethAddrs.length + tronAddrs.length) + ' / 21</div></div>' +
                '</div>';

            // ETH addresses table
            if (ethAddrs.length > 0) {
                html += '<table class="data-table"><thead><tr><th colspan="5" class="text-xs uppercase tracking-wide text-slate-500">Ethereum Addresses (' + ethAddrs.length + ')</th></tr>' +
                    '<tr><th>Address</th><th class="text-right">USDT</th><th class="text-right">Aave aUSDT</th><th class="text-right">ETH</th><th></th></tr></thead><tbody>';
                ethAddrs.sort(function(a, b) { return (b.aave_usdt + b.usdt) - (a.aave_usdt + a.usdt); }).forEach(function(w) {
                    var short = w.address.slice(0, 8) + '...' + w.address.slice(-4);
                    html += '<tr><td class="font-mono text-xs">' + short + '</td>' +
                        '<td class="text-right font-mono">' + (w.usdt > 100 ? CommonRenderer.formatCurrency(w.usdt) : '-') + '</td>' +
                        '<td class="text-right font-mono">' + (w.aave_usdt > 100 ? CommonRenderer.formatCurrency(w.aave_usdt) : '-') + '</td>' +
                        '<td class="text-right font-mono">' + (w.eth > 0.1 ? w.eth.toFixed(1) : '-') + '</td>' +
                        '<td class="text-right">' + self._ethLink(w.address) + '</td></tr>';
                });
                html += '</tbody></table>';
            }

            // Tron addresses table
            if (tronAddrs.length > 0) {
                html += '<table class="data-table mt-4"><thead><tr><th colspan="5" class="text-xs uppercase tracking-wide text-slate-500">Tron Addresses (' + tronAddrs.length + ')</th></tr>' +
                    '<tr><th>Address</th><th class="text-right">USDT</th><th class="text-right">JustLend</th><th class="text-right">TRX</th><th></th></tr></thead><tbody>';
                tronAddrs.sort(function(a, b) { return (b.trx + b.usdt + b.justlend_usdt) - (a.trx + a.usdt + a.justlend_usdt); }).forEach(function(w) {
                    var short = w.address.slice(0, 8) + '...' + w.address.slice(-4);
                    var trxM = w.trx > 1e6 ? (w.trx / 1e6).toFixed(0) + 'M' : w.trx > 1000 ? (w.trx / 1000).toFixed(0) + 'K' : w.trx.toFixed(0);
                    html += '<tr><td class="font-mono text-xs">' + short + '</td>' +
                        '<td class="text-right font-mono">' + (w.usdt > 100 ? CommonRenderer.formatCurrency(w.usdt) : '-') + '</td>' +
                        '<td class="text-right font-mono">' + (w.justlend_usdt > 100 ? CommonRenderer.formatCurrency(w.justlend_usdt) : '-') + '</td>' +
                        '<td class="text-right font-mono">' + trxM + '</td>' +
                        '<td class="text-right">' + self._tronLink(w.address) + '</td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
        }

        // ====== 9. Peg Status ======
        var peg = specific.peg;
        if (peg && peg.price) {
            var deviation = Math.abs(1.0 - peg.price) * 100;
            var pegCls = deviation < 0.5 ? 'positive' : deviation < 3 ? 'warning' : 'negative';
            var pegStatus = deviation < 0.5 ? 'ON PEG' : deviation < 3 ? 'MINOR DEPEG' : 'DEPEG';

            html += '<div class="panel">' +
                '<div class="panel-title">Peg Status</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">' +
                    '<div class="summary-card"><div class="card-label">USDD Price</div><div class="card-value ' + pegCls + '">$' + peg.price.toFixed(4) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Deviation</div><div class="card-value ' + pegCls + '">' + deviation.toFixed(2) + '%</div><div class="text-xs text-slate-400 mt-1">' + pegStatus + '</div></div>' +
                    (peg.volume_24h ? '<div class="summary-card"><div class="card-label">24h Volume</div><div class="card-value">' + CommonRenderer.formatCurrency(peg.volume_24h) + '</div></div>' : '') +
                    (peg.market_cap ? '<div class="summary-card"><div class="card-label">Market Cap</div><div class="card-value">' + CommonRenderer.formatCurrency(peg.market_cap) + '</div></div>' : '') +
                '</div></div>';
        }

        // ====== Footer: Data Sources ======
        html += '<div class="panel">' +
            '<div class="panel-title">Data Sources & Verification</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-500">' +
                '<div><strong>VAT Contracts</strong><br>' +
                    'Tron ' + self._tronLink(CONTRACTS.tron_vat) + ' ' +
                    'ETH ' + self._ethLink(CONTRACTS.eth_vat) + ' ' +
                    'BSC ' + self._bscLink(CONTRACTS.bsc_vat) + '</div>' +
                '<div><strong>Token Contracts</strong><br>' +
                    'Tron ' + self._tronLink(CONTRACTS.tron_token) + ' ' +
                    'ETH ' + self._ethLink(CONTRACTS.eth_token) + ' ' +
                    'BSC ' + self._bscLink(CONTRACTS.bsc_token) + '</div>' +
                '<div><strong>References</strong><br>' +
                    '<a href="https://docs.usdd.io/" target="_blank" class="text-blue-500 hover:underline">USDD Docs</a> &middot; ' +
                    '<a href="https://app.usdd.io/" target="_blank" class="text-blue-500 hover:underline">USDD App</a> &middot; ' +
                    '<a href="https://usdd.io/USDD-V2-audit-report.pdf" target="_blank" class="text-blue-500 hover:underline">Audit</a> &middot; ' +
                    '<a href="https://protos.com/usdd-assets-htx-justin-sun-justlend/" target="_blank" class="text-blue-500 hover:underline">Protos</a></div>' +
            '</div></div>';

        container.innerHTML = html;
    }
};
