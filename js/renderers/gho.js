/** GHO additions preserve the shared six-axis frame and producer clocks. */
var GHORenderer = {
    preRender: function(data) {
        var detail = (data.asset_specific || {}).gho || {};
        var composition = detail.coverage_composition;
        if (composition && Array.isArray(composition.rows)) {
            data.backing_breakdown = composition.rows.map(function(row) {
                return {label: CommonRenderer._escapeAttr(String(row.label)), value: row.value, pct: row.pct, tags: []};
            });
        }
        return data;
    },
    _e: function(value) { return CommonRenderer._escapeAttr(String(value == null ? '' : value)); },
    _n: function(value, digits) {
        return typeof value === 'number' && Number.isFinite(value)
            ? this._e(value.toLocaleString('en-US', {maximumFractionDigits: digits == null ? 2 : digits})) : 'not measured';
    },
    _panel: function(title, body) {
        return '<div class="panel gho-detail"><div class="panel-title">' + this._e(title) + '</div>' + body + '</div>';
    },
    render: function(data, history) {
        var detail = (data.asset_specific || {}).gho;
        if (!detail || detail.schema_version !== 'gho-preview-detail/1') return;
        var self = this;
        // One clear, visible measurement gap for each axis. No historical
        // judgment is turned into a fresh warning or an automatic score.
        ['peg', 'backing', 'liquidity', 'dependencies', 'contract', 'issuer'].forEach(function(axis) {
            var section = document.getElementById('section-' + axis);
            if (!section) return;
            section.querySelectorAll('.gho-evidence, .gho-overview, .gho-axis5-proposal').forEach(function(node) { node.remove(); });
            section.querySelectorAll('.gho-detail').forEach(function(node) { node.remove(); });
            if (detail.gaps && detail.gaps[axis]) section.insertAdjacentHTML('beforeend',
                self._panel('Evidence still needed', '<p class="text-sm">' + self._e(detail.gaps[axis]) + '</p>'));
        });
        var peg = document.getElementById('section-peg');
        if (peg) peg.insertAdjacentHTML('beforeend', this._panel('Price observation clock',
            '<p class="text-sm">' + this._e(detail.price_clock_note) + '</p>' +
            '<p class="text-xs text-slate-500">Tracker row: ' + this._e(detail.row_observed_at || 'not supplied') + '</p>'));
        var exit = document.getElementById('section-liquidity');
        if (exit) {
            var rows = detail.quotes || [];
            exit.insertAdjacentHTML('beforeend', this._panel('Observed GHO → USDC quotes',
                '<p class="text-xs text-slate-500">Observed: ' + this._e(detail.quote_observed_at || 'not supplied') +
                ' · Source: ' + this._e(detail.quote_source || 'not supplied') + ' · Ethereum</p>' +
                '<p class="text-sm">Input sizing: ' + this._e(detail.quote_sizing_basis || 'not supplied') +
                ' · sizing mark: $' + this._n(detail.quote_sizing_price, 8) + ' per GHO.</p>' +
                (rows.length ? '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Input notional (USD)</th><th>Receive USDC</th><th>Cost vs input notional (bps)</th><th>Size impact (bps)</th></tr></thead><tbody>' +
                rows.map(function(row) { return '<tr><td>' + self._n(row.input_notional_usd) + '</td><td>' + self._n(row.output_usdc) +
                    '</td><td>' + self._n(row.market_notional_cost_bps) + '</td><td>' + self._n(row.impact_bps) + '</td></tr>'; }).join('') +
                '</tbody></table></div><p class="text-xs text-slate-500">Input notional is market-sized USD, not a GHO token count or $1-par proceeds benchmark. Negative cost means output exceeds that notional. Quotes are estimates; gas inclusion is not established.</p>' :
                '<p>No usable quote rows are published.</p>') +
                (detail.quote_basis ? '<details><summary>Quote measurement basis</summary><p class="text-sm">' + this._e(detail.quote_basis) + '</p></details>' : '')));
        }
        var diagnostic = detail.diagnostics;
        if (diagnostic) this._diagnostics(diagnostic);
        var measured = (data.asset_specific || {}).gho_backing;
        if (measured && measured.schema_version === 'gho-backing-detail/1') this._backing(measured);
        // The shared frame labels the unknown reference generically as NAV.
        // Here the source explicitly declares fixed par; name that reference.
        var heading = document.querySelector('#axis-peg-head .axis-sub');
        if (heading) heading.textContent = 'Recorded market observations versus $1 USD par';
        // Absence of an authored risk-flag feed is not a clean risk finding.
        var flags = document.getElementById('risk-flags');
        if (flags) flags.textContent = 'No current producer risk-flag assessment is integrated.';
        var issuer = document.getElementById('axis-issuer-body');
        if (issuer && !(data.issuer || {}).summary && !((data.issuer || {}).facts || []).length) issuer.innerHTML = this._panel('Issuer assessment — unavailable',
            '<p>' + this._e((data.issuer || {}).entity || 'Issuer identity not supplied') + '</p>' +
            '<p class="text-sm">No current producer issuer assessment is integrated.</p>' +
            (detail.report ? '<p class="text-sm">' + this._e(detail.report.note) + '</p>' +
                '<a class="text-blue-600 text-sm" target="_blank" rel="noopener noreferrer" href="https://tidresearch.com/reports/gho/">Historical GHO report ↗</a>' +
                '<p class="text-xs text-slate-500">Report URL checked in browser: ' + this._e(detail.report.verified_at) + '</p>' :
                '<p class="text-sm">A historical report exists; its current publication URL has not been verified for this preview.</p>'));
        var cards = document.querySelectorAll('#summary-cards .summary-card');
        // Only unmeasured preview blocks receive explicit missing-data text.
        // Never override an assessment supplied by a producer.
        if (!(data.contract || {}).headline && !((data.contract || {}).code_facts || []).length) {
            var contractValue = cards[4] && cards[4].querySelector('.card-value');
            if (contractValue) contractValue.textContent = 'Not assessed';
        }
        if ((data.issuer || {}).issuer_score == null && cards[5]) {
            cards[5].querySelector('.card-value').textContent = (data.issuer || {}).summary ? 'Review pending' : 'Assessment pending';
        }
        if (typeof (data.issuer || {}).issuer_score === 'number' && cards[5]) {
            cards[5].querySelector('.card-value').textContent = data.issuer.issuer_score.toFixed(1) + '/10';
        }
        var exitMark = (data.liquidity || {}).exit_mark;
        var depth = CommonRenderer.depthAtLimit(data);
        if (exitMark && depth.shape !== 'none' && cards[2]) {
            var liquidityValue = cards[2].querySelector('.card-value');
            var liquiditySub = liquidityValue && liquidityValue.nextElementSibling;
            if (liquiditySub && depth.shape === 'floor') liquiditySub.textContent += ' · floor, not a measurement';
            var quoteClock = document.createElement('div');
            quoteClock.className = 'text-xs text-slate-500';
            quoteClock.textContent = exitMark.chain + ' → ' + exitMark.sell_into + ' · quoted ' + exitMark.as_of;
            cards[2].appendChild(quoteClock);
        }
        if (measured && measured.reconciliation && cards[1]) {
            var sourceCoverage = measured.reconciliation.analytics;
            var backingValue = cards[1].querySelector('.card-value');
            backingValue.textContent = this._n(sourceCoverage.oracle_coverage_pct) + '%';
            var backingSub = backingValue.nextElementSibling;
            if (backingSub) backingSub.textContent = 'TokenLogic · ' + sourceCoverage.source_date + ' · oracle-valued';
        }
        var depCard = cards[3] && cards[3].querySelector('.card-value');
        if (depCard && !((data.dependencies || {}).upstream || []).length) depCard.textContent = 'Not mapped';
        var depSub = document.querySelector('#axis-dependencies-head .axis-sub');
        if (depSub && !((data.dependencies || {}).upstream || []).length) depSub.textContent = 'Upstream coverage unmeasured · downstream not tracked';
        if (detail.report && cards[5]) {
            var reportChip = cards[5].querySelector('.axis-rating');
            if (reportChip) reportChip.textContent = 'Historical report ↗';
        }
        var bandNote = document.querySelector('#summary-cards .axis-band-note');
        if (bandNote) bandNote.textContent = measured && measured.reconciliation
            ? 'Backing shows a dated TokenLogic oracle measure; independent dollar coverage remains unrated. Peg band is computed from recorded marks. Exit depth shows an observed bracket or floor; current authored scores remain unrated.'
            : 'Peg band is computed from recorded marks. Backing and exit depth are unmeasured; current authored assessments are pending.';
        if (bandNote && detail.score_review) bandNote.textContent = 'Backing is a dated source oracle measure; independent dollar coverage remains unrated. Exit depth is an observed bracket or floor.' +
            ' Dependencies and Issuer carry the current riskAnalyst review; ' +
            (detail.axis5_assessment && detail.axis5_assessment.score_adopted ? 'Contract & Admin is adopted for this staged dashboard.' : 'Contract & Admin remains unrated.');
        var backingHead = document.querySelector('#axis-backing-head .axis-sub');
        if (backingHead) backingHead.textContent = measured && measured.reconciliation
            ? 'Source coverage reconciled · independent dollar coverage unverified' : 'Independent collateral coverage not measured';
        if (measured && measured.reconciliation) {
            var backingClock = document.querySelector('#axis-backing-head .axis-clock');
            if (backingClock) {
                backingClock.textContent = 'Mixed clocks · see figures';
                backingClock.title = 'TokenLogic source date, Ethereum block and remote-chain block clocks are shown with their own figures.';
            }
        }
        var pegClock = document.querySelector('#axis-peg-head .axis-clock');
        if (pegClock) {
            pegClock.textContent = 'Oracle update time unknown';
            pegClock.title = detail.price_clock_note || 'Tracker row clock does not establish oracle freshness.';
        }
        var pegLabels = document.querySelectorAll('#axis-peg-body .uppercase');
        pegLabels.forEach(function(label) {
            if (label.textContent === 'NAV / theoretical') label.textContent = '$1 USD par target';
        });
        if (detail.score_review && issuer && (data.issuer || {}).issuer_score_basis) {
            issuer.insertAdjacentHTML('beforeend', this._panel('Reviewed issuer score rationale',
                '<p class="text-sm">' + this._e(data.issuer.issuer_score_basis) + '</p><p class="text-xs text-slate-500">riskAnalyst · ' +
                this._e(detail.score_review.reviewed_at) + '</p>'));
        }
        if (detail.score_review && detail.score_review.axis5 && !detail.axis5_assessment) {
            var contractBody = document.getElementById('axis-contract-body');
            var review5 = detail.score_review.axis5;
            if (contractBody) contractBody.insertAdjacentHTML('beforeend', this._panel('riskAnalyst Axis 5 review — unrated',
                '<p class="text-sm">' + this._e(review5.code_half) + '</p><p class="text-sm">' +
                this._e(review5.authority_half) + '</p><p class="text-sm">' + this._e(review5.combined_decision) + '</p>'));
        }
        if (detail.axis5_assessment && data.contract && typeof data.contract.proposed_structural_score === 'number') {
            var axis5Body = document.getElementById('axis-contract-body');
            if (axis5Body) axis5Body.insertAdjacentHTML('beforeend',
                '<details class="gho-axis5-proposal"><summary>' +
                (detail.axis5_assessment.score_adopted ? 'Contract &amp; Admin score — ' : 'Proposed Contract &amp; Admin score — ') +
                data.contract.proposed_structural_score.toFixed(1) + (detail.axis5_assessment.score_adopted ? '/10 · staged</summary>' : '/10 · not adopted</summary>') +
                this._panel('Combined assessment rationale',
                    '<p class="text-sm">' + this._e(detail.axis5_assessment.score_adopted ? data.contract.structural_score_basis : data.contract.proposed_structural_score_basis) + '</p>') + '</details>');
        }
        var oldIssuer = (data.issuer || {}).historical_assessment;
        if (oldIssuer && issuer) issuer.insertAdjacentHTML('beforeend', this._panel('Historical issuer assessment — ' +
            this._e(oldIssuer.as_of), '<p class="text-sm">' + this._e(oldIssuer.summary) + '</p><p class="text-xs text-slate-500">' +
            this._e(oldIssuer.source) + '</p>'));
        this._standardLayout(data);
        return this._coverageChart(data);
    },
    _standardLayout: function(data) {
        var self = this, detail = data.asset_specific.gho;
        var measured = data.asset_specific.gho_backing;
        var headings = {peg: 'Price sources and observation clocks', backing: 'Backing reconciliation and source evidence',
            liquidity: 'Quote basis and exit measurement limits', dependencies: 'Dependency sources and coverage',
            contract: 'Contract and admin scope limits', issuer: 'Issuer provenance and historical assessment'};
        Object.keys(headings).forEach(function(axis) {
            var section = document.getElementById('section-' + axis);
            var panels = Array.from(section.children).filter(function(node) { return node.classList.contains('gho-detail'); });
            if (!panels.length) return;
            var disclosure = document.createElement('details');
            disclosure.className = 'panel gho-evidence';
            disclosure.innerHTML = '<summary>' + self._e(headings[axis]) + '</summary>';
            panels.forEach(function(node) { disclosure.appendChild(node); });
            section.appendChild(disclosure);
        });
        var composition = detail.coverage_composition;
        var caption = document.getElementById('breakdown-caption');
        if (caption && composition) caption.textContent = composition.basis + ' Source date: ' + composition.as_of_source_date + '.';
        var breakdown = document.getElementById('breakdown-table');
        if (breakdown && composition) {
            breakdown.closest('.panel').querySelector('.panel-title').textContent = 'Collateral Breakdown';
            breakdown.querySelector('thead th').textContent = 'Collateral category';
            var allocation = document.getElementById('pie-chart');
            if (allocation) allocation.closest('.panel').querySelector('.panel-title').textContent = 'Collateral Allocation';
        }
        var analytics = measured && measured.reconciliation && measured.reconciliation.analytics;
        if (analytics) {
            var overview = document.createElement('div');
            overview.className = 'panel gho-overview';
            var metrics = [['Collateral ratio', self._n(analytics.oracle_coverage_pct) + '%'],
                ['Pro-rata collateral', '$' + self._n(analytics.pro_rata_collateral_usd)],
                ['Source circulating claims', self._n(analytics.ratio_denominator_gho) + ' GHO'],
                ['Ethereum origin supply', self._n(measured.issuance.total_supply_gho) + ' GHO']];
            overview.innerHTML = '<div class="panel-title">Backing</div><div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">' +
                metrics.map(function(row) { return '<div><div class="text-xs text-slate-400 font-medium uppercase">' + row[0] +
                    '</div><div class="text-lg font-bold font-mono">' + row[1] + '</div></div>'; }).join('') + '</div>' +
                '<p class="text-xs text-slate-500">TokenLogic oracle coverage · source date ' + self._e(analytics.source_date) +
                    '. Ethereum supply: ' + self._e(measured.as_of) + '. Different scopes; origin supply is not the ratio denominator.</p>' +
                '<p class="text-sm">Independent liquidation value and original bridge funding attribution remain unverified.</p>';
            measured.reconciliation.lending_books.rows.filter(function(row) { return row.recorded_deficit_gho > 0; }).forEach(function(row) {
                overview.innerHTML += '<p class="text-sm text-amber-700">Recorded reserve deficit: ' + self._n(row.recorded_deficit_gho, 6) +
                    ' GHO. Positive lending-book residuals remain unattributed; details below.</p>';
            });
            var chart = document.getElementById('chart-panel');
            chart.parentElement.insertBefore(overview, chart);
        }
        var diagnostic = detail.diagnostics;
        var grid = document.querySelector('#axis-peg-body .grid');
        if (grid && diagnostic && typeof diagnostic.curve_price === 'number') {
            grid.lastElementChild.innerHTML = '<div class="text-xs text-slate-400 font-medium uppercase">Cross-source check</div>' +
                '<div class="text-lg font-bold font-mono">$' + self._n(diagnostic.curve_price, 6) + '</div>' +
                '<div class="text-xs text-slate-500">CurveTracker · ' + self._e(diagnostic.curve_source.timestamp) + ' · clocks not synchronized</div>';
        }
        // The shared liquidity renderer owns both the depth floor and ladder.
        if ((data.liquidity || {}).exit_mark) {
            var liquidity = document.querySelector('#axis-liquidity-body .panel');
            if (liquidity) liquidity.insertAdjacentHTML('beforeend', '<p class="text-xs text-slate-500">Quoted: ' +
                self._e(detail.quote_observed_at) + ' · input sizing mark: $' + self._n(detail.quote_sizing_price, 8) + ' per GHO.</p>');
        }
        document.querySelectorAll('#breakdown-table, #axis-liquidity-body table, #axis-contract-body table').forEach(function(table) {
            if (table.parentElement.classList.contains('overflow-x-auto')) return;
            var wrap = document.createElement('div');
            wrap.className = 'overflow-x-auto';
            table.parentElement.insertBefore(wrap, table);
            wrap.appendChild(table);
        });
    },
    _coverageChart: function(data) {
        var ref = data.asset_specific.gho.coverage_history_ref;
        if (!ref) return Promise.resolve();
        var self = this;
        return fetch('data/' + encodeURIComponent(ref) + '?nocache=' + Date.now()).then(function(response) {
            if (!response.ok) throw new Error('Coverage history unavailable');
            return response.json();
        }).then(function(source) {
            if (source.asset_slug !== 'gho' || source.schema_version !== 'reported-coverage-history/1') throw new Error('Coverage history identity mismatch');
            var panel = document.getElementById('chart-panel');
            panel.querySelectorAll('#cr-chart-absent-note, #cr-chart-declared-note, .gho-history-note').forEach(function(node) { node.remove(); });
            var display = {entries: source.entries.map(function(row) {
                return {timestamp: row.timestamp, collateral_ratio: row.reported_collateral_ratio, collateral_ratio_scale: 'percent'};
            })};
            var cutoff = Date.now() - data.peg.chart_window_days * 86400000;
            if (display.entries.filter(function(row) { return Date.parse(row.timestamp) >= cutoff; }).length < 2) {
                throw new Error('insufficient_history_window');
            }
            CommonRenderer.renderCRChart(display, {title: 'Collateral Ratio History', dataset_label: 'TokenLogic oracle coverage',
                window_days: data.peg.chart_window_days, asset_slug: 'gho', omit_alt: true});
            var note = document.createElement('p');
            note.className = 'text-xs text-slate-500 gho-history-note';
            note.textContent = 'TokenLogic pro-rata oracle collateral / same-day source circulation. Daily source dates; midnight is a chart coordinate. Latest source date: ' + source.as_of_source_date + '.';
            panel.querySelector('.panel-title').insertAdjacentElement('afterend', note);
            var evidence = document.createElement('details');
            evidence.className = 'gho-history-note text-xs text-slate-500 mt-2';
            evidence.innerHTML = '<summary>History basis and source-date precision</summary><p>' + self._e(source.basis) +
                '</p><p>' + self._e(source.clock_note) + '</p><p>' + self._e(source.scope_note) + '</p>';
            panel.appendChild(evidence);
            var stats = document.getElementById('cr-chart-stats');
            if (stats) stats.classList.add('flex-wrap');
            if (stats) stats.querySelectorAll('span').forEach(function(node) {
                if (node.textContent.startsWith('Today ')) {
                    node.textContent = node.textContent.replace(/^Today /, 'Latest source reading ');
                    node.title = 'Latest dated TokenLogic reading against the plotted window; source date ' + source.as_of_source_date + '.';
                }
            });
        }).catch(function(error) {
            var panel = document.getElementById('chart-panel');
            if (window._crChart) { window._crChart.destroy(); window._crChart = null; }
            panel.querySelectorAll('#cr-chart-absent-note, #cr-chart-declared-note, .gho-history-note').forEach(function(node) { node.remove(); });
            panel.querySelector('.chart-container').style.display = 'none';
            var note = document.createElement('p');
            note.id = 'cr-chart-absent-note';
            note.textContent = error.message === 'insufficient_history_window'
                ? 'Fewer than two dated coverage observations fall inside the shared seven-day window. No wider history is substituted.'
                : 'Collateral ratio history is unavailable: the selected TokenLogic history could not be loaded. The last source snapshot remains displayed above.';
            panel.appendChild(note);
        });
    },
    _diagnostics: function(d) {
        var self = this;
        function table(rows) {
            return '<div class="overflow-x-auto"><table class="data-table"><tbody>' + rows.map(function(row) {
                return '<tr><td>' + self._e(row[0]) + '</td><td>' + self._n(row[1], 6) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        }
        var backing = document.getElementById('section-backing');
        if (backing && !d.backing_superseded) {
            backing.insertAdjacentHTML('beforeend', this._panel('Supply observations — provisional',
                '<p class="text-sm">' + this._e(d.scope_note) + '</p>' +
                '<p class="text-xs text-slate-500">Collector run started: ' + this._e(d.collector_run_started_at) +
                ' · API metrics as of: ' + this._e(d.api_metrics_as_of || 'unknown') + '</p>' +
                table([['RPC token total supply (GHO; Ethereum)', d.total_supply],
                       ['TokenLogic total supply (GHO; API-defined)', d.api_metrics.total_supply],
                       ['TokenLogic circulating supply (GHO; API-defined)', d.api_metrics.circulating_supply]]) +
                '<p class="text-sm">Token supply and circulating supply have different definitions. Neither establishes independent collateral coverage.</p>' +
                '<details><summary>Facilitator observations (' + (d.facilitators || []).length + ')</summary>' +
                '<p class="text-sm">' + this._e(d.facilitator_clock_note) + '</p><div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Facilitator</th><th>Chain</th><th>Level (GHO)</th><th>Cap (GHO)</th></tr></thead><tbody>' +
                (d.facilitators || []).map(function(row) { return '<tr><td>' + self._e(row.facilitator) + '</td><td>' + self._e(row.chain) +
                    '</td><td>' + self._n(row.level) + '</td><td>' + self._n(row.cap) + '</td></tr>'; }).join('') + '</tbody></table></div></details>'));
        }
        var exit = document.getElementById('section-liquidity');
        if (exit && Array.isArray(d.gsm.contracts)) exit.insertAdjacentHTML('beforeend', this._panel('Ethereum RemoteGSM observations — provisional',
            '<p class="text-sm">' + this._e(d.gsm_clock_note) + '</p>' +
            '<p class="text-xs text-slate-500">Collector run started: ' + this._e(d.collector_run_started_at) + '</p>' +
            d.gsm.contracts.map(function(row) {
                return '<div class="mb-4"><p class="font-semibold">' + self._e(row.label) + '</p>' +
                    '<p class="text-xs break-all">' + self._e(row.address) + '</p>' +
                    '<p class="text-sm">Read status: ' + self._e(row.status) + ' · Frozen: ' + self._e(row.is_frozen == null ? 'unknown' : row.is_frozen) +
                    ' · Seized: ' + self._e(row.is_seized == null ? 'unknown' : row.is_seized) + '</p>' +
                    table([['Available liquidity (' + (row.underlying_symbol || 'unknown token') + ' units)', row.available_liquidity],
                           ['Underlying balance (' + (row.underlying_symbol || 'unknown token') + ' units)', row.underlying_balance],
                           ['Unused GHO reserve allocation (opposite swap direction)', row.reserve_available_gho],
                           ['Buy fee (%)', row.buy_fee_pct], ['Sell fee (%)', row.sell_fee_pct]]) + '</div>';
            }).join('') + '<p class="text-sm">Wrapped stablecoin units are not independently verified dollars. GHO reserve allocation supports issuing GHO; it is not underlying liquidity available to GHO sellers. Remote-chain modules are not covered.</p>'));
        var peg = document.getElementById('section-peg');
        if (peg && typeof d.curve_price === 'number') peg.insertAdjacentHTML('beforeend', this._panel('Second recorded price source',
            '<p>CurveTracker GHO mark: $' + this._n(d.curve_price, 6) + '</p>' +
            '<p class="text-xs text-slate-500">Observed: ' + this._e(d.curve_source.timestamp || 'unknown') + '</p>' +
            '<p class="text-sm">The oracle update timestamp is unknown. These observations cannot establish a synchronized price comparison.</p>'));
    },
    _backing: function(d) {
        var section = document.getElementById('section-backing');
        if (!section) return;
        var self = this, book = d.issuance || {}, reserve = d.gsm_reserve || {};
        var clock = '<p class="text-xs text-slate-500">Ethereum block ' + this._e(d.block_number) +
            ' · Observed: ' + this._e(d.as_of) + '</p>';
        section.insertAdjacentHTML('beforeend', this._panel('Measured Ethereum issuance', clock +
            '<p class="font-semibold">' + this._n(book.total_supply_gho) + ' GHO · reconciliation ' + this._e(book.reconciliation_status) + '</p>' +
            '<p class="text-sm">' + this._e(book.scope) + '</p>' +
            '<p class="text-sm">' + this._e(book.basis) + '</p>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Facilitator</th><th>Issued GHO</th><th>Cap GHO</th></tr></thead><tbody>' +
            (book.facilitators || []).map(function(row) { return '<tr><td>' + self._e(row.label) +
                '<details><summary>Contract address</summary><span class="text-xs break-all">' + self._e(row.address) + '</span></details></td><td>' +
                self._n(row.level_gho) + '</td><td>' + self._n(row.capacity_gho) + '</td></tr>'; }).join('') + '</tbody></table></div>'));
        section.insertAdjacentHTML('beforeend', this._panel('Lending reserve claims', clock +
            '<p class="text-sm">These are GHO-denominated aToken claims. Pool GHO cash belongs to the entire lending reserve; it is not extra external collateral or an exclusively available exit.</p>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Facilitator</th><th>aToken claim (GHO)</th><th>Whole-pool cash (GHO)</th></tr></thead><tbody>' +
            (d.lending_claims || []).map(function(row) { return '<tr><td>' + self._e(row.label || row.facilitator) + '</td><td>' +
                self._n(row.claim_gho) + '</td><td>' + self._n(row.pool_gho_cash) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
            (d.reconciliation ? '<p class="text-sm">Remote reserve ledgers now match 150M GHO of origin allocations; original bridge funding receipts are not replayed. See the separate reconciliation below.</p>' :
                '<p class="text-sm">Other facilitator issuance not traced to external assets in this pass: ' + self._n(d.unresolved_issuance_gho) +
                ' GHO. Unresolved attribution is not a finding of missing backing.</p>')));
        section.insertAdjacentHTML('beforeend', this._panel('GSM reserve and external token inventory', clock +
            '<p>Idle reserve: ' + this._n(reserve.reserve_idle_gho) + ' GHO · Registered entity usage: ' + this._n(reserve.registered_entity_usage_gho) + ' GHO</p>' +
            '<p class="text-sm">' + this._e(reserve.basis) + '</p>' +
            (reserve.modules || []).map(function(row) { return '<div class="mb-4"><p class="font-semibold">' + self._e(row.wrapper_symbol || row.address) + '</p>' +
                '<p class="text-sm">Wrapper balance: ' + self._n(row.wrapper_balance, 6) + ' ' + self._e(row.wrapper_symbol || 'units') + '</p>' +
                '<p class="text-sm">Contract conversion quote: ' + self._n(row.converted_asset_units, 6) + ' ' + self._e(row.asset_symbol || 'underlying units') + '</p>' +
                '<p class="text-sm">Conversion status: ' + self._e(row.conversion_status || 'unmeasured') + '</p></div>'; }).join('') +
            '<p class="text-sm">Wrapper units and converted underlying units differ. Conversion quotes do not establish successful withdrawal, holder redemption or independently realizable dollars.</p>' +
            '<details><summary>Coverage limits and reserve comparison</summary><p>' + this._e(d.coverage_basis) + '</p><p>' +
                this._e(reserve.comparison_basis) + '</p><p>Raw comparison delta: ' + this._e(reserve.comparison_to_mainnet_facilitator_raw) + '</p></details>'));
        if (d.reconciliation) this._reconciliation(section, d.reconciliation);
    },
    _reconciliation: function(section, result) {
        var self = this, analytics = result.analytics, remote = result.remote_reserves, lending = result.lending_books;
        section.insertAdjacentHTML('beforeend', this._panel('TokenLogic collateral ratio — reconciled source inputs',
            '<p class="font-semibold">' + this._n(analytics.oracle_coverage_pct) + '% · source date ' + this._e(analytics.source_date) + '</p>' +
            '<p>Pro-rata oracle collateral: $' + this._n(analytics.pro_rata_collateral_usd) + '</p>' +
            '<p>Same-day source circulation denominator: ' + this._n(analytics.ratio_denominator_gho) + ' GHO</p>' +
            '<p class="text-sm">' + this._e(analytics.scope) + '</p>' +
            '<p class="text-sm">' + this._e(analytics.basis) + '</p>' +
            '<p class="text-sm">The current source headline is ' + this._n(analytics.headline_circulation_gho) +
                ' GHO; it is a different observation and cannot replace this ratio’s dated denominator.</p>' +
            '<details><summary>Borrower and competing-debt reconciliation (' + this._e(analytics.row_count) + ' rows)</summary>' +
            '<p class="text-sm">Whole shared collateral: $' + this._n(analytics.whole_shared_collateral_usd) +
                '. Only $' + this._n(analytics.pro_rata_collateral_usd) + ' is allocated to GHO by the source model.</p>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Market</th><th>GHO debt (source USD)</th><th>Pro-rata collateral (USD)</th></tr></thead><tbody>' +
            analytics.markets.map(function(row) { return '<tr><td>' + self._e(row.market) + '</td><td>' + self._n(row.source_gho_debt_usd) +
                '</td><td>' + self._n(row.pro_rata_collateral_usd) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
            analytics.limitations.map(function(note) { return '<p class="text-sm">' + self._e(note) + '</p>'; }).join('') + '</details>'));
        section.insertAdjacentHTML('beforeend', this._panel('Remote reserve allocation reconciliation',
            '<p class="text-sm">' + this._e(remote.basis) + '</p><p class="text-sm">' + this._e(remote.snapshot_scope) + '</p>' +
            remote.rows.map(function(row) {
                return '<div class="mb-4"><p class="font-semibold">' + self._e(row.chain) + ': ' + self._n(row.origin_allocation_gho) + ' GHO allocation</p>' +
                    '<p class="text-xs text-slate-500">Block ' + self._e(row.block_number) + ' · ' + self._e(row.as_of) + '</p>' +
                    '<p class="text-sm">Idle ' + self._n(row.idle_gho, 6) + ' + used ' + self._n(row.used_gho, 6) + ' GHO · raw-unit difference ' + self._e(row.comparison_delta_raw) + '</p>' +
                    row.entities.map(function(entity) { return '<p class="text-sm">' + self._e(entity.wrapper_symbol) + ' underlying conversion quote: ' +
                        self._n(entity.converted_asset_units, 6) + ' ' + self._e(entity.asset_symbol || 'units not established') + '</p>'; }).join('') + '</div>';
            }).join('') + '<details><summary>Funding attribution and bridge scope</summary><p class="text-sm">' + this._e(remote.funding_transfer_provenance) + '</p></details>'));
        section.insertAdjacentHTML('beforeend', this._panel('Lending reserve books — residuals retained',
            '<p class="text-sm">' + this._e(lending.basis) + '</p>' +
            '<p class="text-xs text-slate-500">Ethereum block ' + this._e(lending.rows[0].block_number) + ' · ' + this._e(lending.rows[0].as_of) + '</p>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Pool</th><th>Borrower debt (GHO)</th><th>Recorded deficit (GHO)</th><th>Residual (GHO)</th></tr></thead><tbody>' +
            lending.rows.map(function(row) { return '<tr><td><span class="text-xs break-all">' + self._e(row.pool) + '</span></td><td>' +
                self._n(row.borrower_debt_gho) + '</td><td>' + self._n(row.recorded_deficit_gho, 6) + '</td><td>' + self._n(row.residual_gho, 6) + '</td></tr>'; }).join('') +
            '</tbody></table></div><p class="text-sm">' + this._e(lending.limitations) + '</p>'));
    }
};
