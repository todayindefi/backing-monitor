/** sfrxUSD strategy and settlement detail; observations remain producer-owned. */
var SfrxUSDRenderer = {
    preRender: function(data) {
        var detail = (data.asset_specific || {}).sfrxusd || {};
        var b = data.backing || {};
        // Field adaptation only: these are issuer assets/claims, not share supply.
        b.total_backing = b.assets_usd;
        b.total_liabilities = b.liabilities_usd;
        b.surplus_deficit = b.surplus_usd;
        b.surplus_deficit_basis = 'Issuer assets minus issuer net circulating claims, in USD.';
        data.summary = data.summary || {};
        data.summary.total_backing = b.assets_usd;
        data.summary.collateral_ratio_scale = b.collateral_ratio_scale;
        if (Array.isArray(b.breakdown)) {
            data.backing_breakdown = b.breakdown.map(function(row) {
                return { label: row.label, value: row.value_usd, pct: row.share_pct };
            });
        }
        if (data.peg) {
            data.peg.chart_history_array = 'observations';
            data.peg.chart_history_field = 'price';
            data.peg.chart_reference_field = 'theoretical_price';
            data.peg.chart_time_unit = 'hour';
        }
        data.asset_specific = data.asset_specific || {};
        data.asset_specific.chart_title = 'Issuer-reported strategy coverage — observed history';
        data.asset_specific.chart_dataset_label = 'Issuer coverage %';
        var dep = data.dependencies || {};
        if (Array.isArray(dep.downstream_tracked)) {
            dep.downstream = dep.downstream_tracked.map(function(slug) { return { name: slug, slug: slug }; });
            dep.downstream_tracked = true;
        }
        if (detail.primary_exit) {
            data.liquidity = data.liquidity || {};
            data.liquidity.primary_redemption_depth_status = detail.primary_exit.status;
            data.liquidity.primary_redemption_note = detail.primary_exit.status_basis;
        }
        return data;
    },
    e: function(value) { return CommonRenderer._escapeAttr(String(value == null ? '' : value)); },
    n: function(value, decimals) {
        return typeof value === 'number' && Number.isFinite(value)
            ? value.toLocaleString('en-US', { maximumFractionDigits: decimals == null ? 2 : decimals })
            : 'not measured';
    },
    value: function(value, unit, decimals) {
        return this.e(this.n(value, decimals)) + (typeof value === 'number' && Number.isFinite(value) ? ' ' + this.e(unit || '') : '');
    },
    panel: function(title, body) {
        return '<div class="panel sfrxusd-panel"><div class="panel-title">' + this.e(title) + '</div>' + body + '</div>';
    },
    note: function(text, warning) {
        return text ? '<p class="text-sm mt-2 ' + (warning ? 'text-amber-700' : 'text-slate-500') + '">' + this.e(text) + '</p>' : '';
    },
    disclosure: function(title, body) {
        return '<details class="mt-3"><summary>' + this.e(title) + '</summary>' + body + '</details>';
    },
    table: function(headings, rows) {
        var self = this;
        return '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
            headings.map(function(h) { return '<th>' + self.e(h) + '</th>'; }).join('') +
            '</tr></thead><tbody>' + rows.map(function(row) {
                return '<tr>' + row.map(function(cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
            }).join('') + '</tbody></table></div>';
    },
    metrics: function(rows) {
        var self = this;
        return this.table(['Measure', 'Value'], rows.map(function(row) {
            return [self.e(row[0]), self.value(row[1], row[2], row[3])];
        }));
    },
    pricing: function(p) {
        if (!p) return this.panel('Administered share pricing', this.note('Pricing detail is not published.', true));
        var pps = p.administered_pps || {}, ref = p.usd_share_reference || {};
        var mark = p.frxusd_usd_mark || {}, accrual = p.accrual || {}, market = p.market_mark || {};
        return this.panel('Administered share pricing', this.metrics([
            ['Administered PPS', pps.value, 'frxUSD / share', 8],
            ['USD share reference', ref.value, 'USD / share', 8],
            ['Market mark', market.price, 'USD / share', 8],
            ['Configured accrual APY', accrual.implied_apy_pct, '%', 2],
            ['Formula-derived totalAssets', (p.total_assets_formula || {}).value, 'frxUSD'],
            ['frxUSD held by Ethereum token', (p.frxusd_held_by_token || {}).value, 'frxUSD']
        ]) + this.note(accrual.basis, true) + this.note(ref.withheld_reason, true) +
            this.note('PPS block ' + this.e(pps.block || 'unavailable') + ' · ' + (pps.block_time || 'time unavailable') +
                '. Pricing parameters last synchronized ' + (accrual.last_sync_at || 'not established') + '.') +
            this.disclosure('Price sources and comparison clocks',
                this.note(pps.method) + this.note(pps.admin_basis) + this.note(ref.formula) +
                this.note('frxUSD/USD: ' + this.n(mark.value, 8) + ' · ' + (mark.source || 'source unavailable') +
                    ' · ' + (mark.updated_at || 'source time unavailable') + ' · ' + (mark.status || 'unknown')) +
                this.note('Market: ' + (market.source || 'unknown') + ' · ' + (market.last_updated_at || 'source time unavailable') +
                    ' · ' + (market.scope || 'scope unavailable')) +
                this.note((p.total_assets_formula || {}).basis) + this.note((p.convert_to_assets_1_share || {}).basis)));
    },
    accounting: function(a, strategies) {
        if (!a) return this.panel('Strategy accounting', this.note('Accounting detail is not published.', true));
        var mixed = a.liability_mark_consistency || {}, self = this;
        var offsets = a.liability_offsets_shares || {};
        var discrepancy = strategies && Array.isArray(strategies.rows) ? strategies.rows.filter(function(r) {
            return r.status !== 'matches';
        }) : [];
        return this.panel('Issuer-reported strategy coverage', this.note('Issuer snapshot ' + (a.as_of || 'time unavailable') +
            ' · Ethereum block ' + ((a.issuer_blocks || {}).ethereum || 'unknown') +
            ' · Fraxtal block ' + ((a.issuer_blocks || {}).fraxtal || 'unknown')) + this.metrics([
            ['Reported assets', a.issuer_assets_usd, 'USD'],
            ['Net circulating claims', a.issuer_net_claims_usd, 'USD'],
            ['Issuer coverage', a.issuer_coverage_pct, '%', 5],
            ['Surplus', a.issuer_surplus_usd, 'USD'],
            ['Surplus / net claims', a.issuer_surplus_bps_of_claims, 'bp', 2]
        ]) + this.note(a.independent_global_coverage_basis, true) +
            (mixed.consistent === false ? this.note('Issuer liability rows use different share marks. Single-PPS claims differ by ' +
                this.n(mixed.difference_vs_issuer_usd) + ' USD; reported coverage is retained.', true) : '') +
            this.note(a.issuer_coverage_basis) +
            (discrepancy.length ? this.disclosure('Unresolved or unqueried asset rows (' + discrepancy.length + ')',
                this.table(['Position', 'Status', 'Difference, USD'], discrepancy.map(function(r) {
                    return [self.e(r.description), self.e(r.status), self.value(r.difference_usd, 'USD')];
                }))) : '') +
            this.disclosure('Net liability definitions and alternative marks', this.metrics([
                ['Issuer gross global shares', a.gross_supply_total_shares, 'shares'],
                ['Issuer net circulating shares', a.net_circulating_shares, 'shares'],
                ['Self-held own-token amount inside reported assets', a.self_held_own_token_in_assets_usd, 'USD'],
                ['Single-PPS alternative claims', mixed.net_claims_at_single_pps_usd, 'USD'],
                ['Single-PPS alternative coverage', mixed.coverage_at_single_pps_pct, '%', 5]
            ]) + this.table(['Issuer liability offset', 'Shares'], Object.keys(offsets).map(function(k) {
                return [self.e(k.replace(/_/g, ' ')), self.value(offsets[k], 'shares')];
            })) + this.note(mixed.basis) + this.note('Self-held shares and owned LP own-token legs do not constitute external collateral.')) +
            '<p class="text-sm mt-3"><a href="?asset=frxusd">View the separate frxUSD reserve layer</a></p>');
    },
    strategies: function(s, limits) {
        var self = this;
        if (!s || !Array.isArray(s.rows)) return this.panel('Strategy positions', this.note('Position measurements are unavailable.', true));
        var rows = s.rows.map(function(r) {
            return [self.e(r.description), self.e(r.chain), self.value(r.issuer_value_usd, 'USD'),
                self.value(r.observed_value_usd, 'USD'), self.e(r.status)];
        });
        var w = (limits || {}).rows || [];
        return this.panel('Strategy positions and unwind limits', this.note('Issuer-listed positions · ' + (s.as_of || 'time unavailable')) +
            this.note(s.discovery) + this.disclosure('Issuer-listed strategy reconciliation (' + rows.length + ' rows)',
                this.table(['Position', 'Chain', 'Issuer value', 'Reconstructed value', 'Status'], rows)) +
            this.note((limits || {}).basis, true) +
            this.disclosure('Read-only withdrawal limits and shared inventory', this.note('Observed ' + ((limits || {}).as_of || 'time unavailable')) +
                this.table(['Position', 'Claim', 'maxWithdraw', 'Shared hub cash', 'Constraint'], w.map(function(r) {
                    return [self.e(r.position), self.value(r.claim, r.units), self.value(r.max_withdraw, r.units),
                        self.value(r.shared_hub_cash, r.units), self.e(r.constraint) + ' · block ' + self.e(r.block)];
                }))));
    },
    primary: function(p) {
        if (!p) return this.panel('Primary redemption', this.note('Primary route is not integrated.', true));
        var inv = p.destination_inventory || {}, pricing = p.pricing || {}, fee = p.fee || {};
        var sim = p.simulation || {}, self = this;
        return this.panel('Primary redemption — frxUSD payout through Fraxtal',
            this.note(p.status_basis, true) + this.note(p.payout_token, true) + this.metrics([
                ['Destination cash', inv.frxusd_cash, 'frxUSD'],
            ['View redemption bound', inv.max_shares_redeemable, 'sfrxUSD shares'],
            ['Simulated execution bound', (((sim.fraxtal_redeem_leg || {}).bound_check) || {}).contract_max_shares, 'sfrxUSD shares'],
                ['Redeemer fee', fee.bps, 'bp', 3]
            ]) + this.note(inv.inventory_vs_capacity, true) +
            this.note('Fraxtal inventory block ' + (inv.block || 'unknown') +
                ' · parameter lastSync ' + (typeof pricing.last_sync === 'number' ? new Date(pricing.last_sync * 1000).toISOString() : 'unknown')) +
            this.note(pricing.freshness_basis, true) +
            this.disclosure('Route links, eligibility and read-only simulations', this.note(p.eligibility) +
                this.note(inv.basis) + this.table(['Route component', 'Address'], Object.keys(p.route_contracts || {}).map(function(k) {
                    return [self.e(k.replace(/_/g, ' ')), self.e(p.route_contracts[k])];
                })) + this.table(['Simulation', 'Result'], Object.keys(sim).map(function(k) {
                    return [self.e(k.replace(/_/g, ' ')), self.e(JSON.stringify(sim[k]))];
                })) + this.note((p.messaging || {}).dvn_executor_config)));
    },
    ladder: function(l) {
        if (!l) return this.panel('Dollar exit route detail', this.note('Executable dollar ladder is unavailable.', true));
        var self = this, h = l.headline || {};
        var treasury = (l.rungs || []).some(function(r) { return r.route_touches_treasury_owned_pool === true; });
        var diag = ((l.diagnostics || {}).curve_research_route || {});
        return this.panel('Ethereum market exit — USDC settlement',
            this.note('Quoted ' + (l.measured_at || 'time unavailable') + ' · ' + (l.aggregator || 'source unavailable')) +
            this.note(h.value_basis) +
            (treasury ? this.note('The quoted route uses treasury-owned pools. Their inventory can be withdrawn by the operator.', true) : '') +
            this.note(typeof l.nonmonotonic_output_warning === 'string' ? l.nonmonotonic_output_warning :
                ((l.nonmonotonic_output_warning || {}).message || ''), true) +
            this.disclosure('USDC quote profile: total discount and additional size impact', this.table(
                ['NAV input, USD', 'Input shares', 'USDC output', 'All-in cost, bp', 'Size impact, bp', 'Status'],
                (l.rungs || []).map(function(r) {
                    return [self.value(r.size_usd, 'USD'), self.value(r.input_amount, 'shares'),
                        self.value(r.output_usdc, 'USDC'), self.value(r.all_in_cost_bps, 'bp'),
                        self.value(r.size_impact_bps, 'bp'), self.e(r.status)];
                })) + this.note(l.notional_basis) + this.note(JSON.stringify(l.cost_conventions || {}))) +
            (Array.isArray(diag.rows) ? this.disclosure('Separate Curve diagnostic: frxUSD output and marked USDT route',
                this.note(diag.basis) + this.table(['Input', 'frxUSD output', 'USDT output', 'USDT mark'], diag.rows.map(function(r) {
                    return [self.value(r.size_usd || r.input_nav_usd, 'USD'), self.value(r.output_frxusd, 'frxUSD'),
                        self.value(r.output_usdt, 'USDT'), self.value((diag.usdt_mark || {}).price, 'USD / USDT', 6)];
                })) + this.note('Diagnostic block ' + (diag.block_number || 'unknown') + ' · ' +
                    (diag.block_time || 'time unavailable') + ' · USDT mark updated ' + ((diag.usdt_mark || {}).updated_at || 'unknown'))) : ''));
    },
    ownership: function(o) {
        if (!o || !Array.isArray(o.pools)) return this.panel('Pool ownership', this.note('Ownership measurements are unavailable.', true));
        var self = this;
        return this.panel('Treasury control of exit inventory',
            this.note('Ethereum block ' + (o.block || 'unknown') + ' · read ' + (o.read_at || 'time unavailable')) +
            this.table(['Pool', 'Role', 'Named holder ownership'], o.pools.map(function(r) {
                return [self.e(r.name), self.e(r.pool_role), self.value(r.named_holders_pct_of_lp_supply, '%', 5)];
            })) + this.note(o.semantics, true) + this.disclosure('Ownership sources and coverage limits',
                this.note(o.source) + (o.limitations || []).map(function(t) { return self.note(t); }).join('')));
    },
    render: function(data) {
        var detail = (data.asset_specific || {}).sfrxusd || {}, self = this;
        function put(id, html) { var slot = document.getElementById(id); if (slot) slot.innerHTML = html; }
        put('peg-extra-panels', this.pricing(detail.pricing));
        put('backing-extra-panels', this.accounting(detail.accounting, detail.strategies) +
            this.strategies(detail.strategies, detail.withdrawal_limits));
        var liq = data.liquidity || {}, mark = liq.exit_mark || {};
        put('liquidity-extra-panels', this.primary(detail.primary_exit) + this.ladder(mark.source_observation) + this.ownership(liq.lp_ownership));
        var dep = data.dependencies || {};
        put('dependencies-extra-panels', this.panel('Assessment status and scope',
            (dep.assessment_status === 'provisional_revision' ? this.note(
                'Provisional Dependencies ' + dep.underlying_score + '/10; published report remains ' + dep.canonical_report_score + '/10.', true) : '') +
            (dep.assessment_status === 'editorially_reconciled' ? this.note(
                'Authored Dependencies ' + dep.underlying_score + '/10.') : '') +
            (data.dashboard_published ? '' : this.note(dep.promotion_requires, true)) + this.note(dep.coverage_note)));
        var c = data.contract || {}, walk = c.commissioned_walk || {};
        var eligible = c.method === 'hand-walk' && Array.isArray(c.layers) && c.layers.length > 0 && c.source_file;
        put('contract-extra-panels', this.panel('Authority evidence eligibility',
            (eligible ? this.note('Eligible committed authority walk: ' + c.layers.length + ' layers across Ethereum and Fraxtal.') +
                this.note('Authority observation: ' + (c.observed_at || 'not supplied') + ' · Source: ' + c.source_file) :
                this.note(walk.eligibility || 'Eligible commissioned authority observations are not supplied.', true)) +
            this.note('Editorial assessment: ' + (c.structural_score_generated_at || 'not supplied')) +
            this.disclosure('Historical research authority roots', this.table(['Chain', 'Role', 'Threshold', 'Delay'],
                ((c.authority_research || {}).roots || []).map(function(r) {
                    return [self.e(r.chain), self.e(r.role), self.e(r.threshold + ' of ' + r.owners), self.e(r.execution_delay)];
                })) + this.note((c.authority_research || {}).signer_independence) +
                this.note('Research observation: ' + ((c.authority_research || {}).observed_at || 'unknown')))) +
            this.panel('Audit and bounty scope', this.note((c.audit || {}).firm + ' · ' + ((c.audit || {}).date || 'date unavailable')) +
                this.note((c.audit || {}).scope) + this.note((c.audit || {}).limits, true) + this.note((c.bounty || {}).note, true)));
        // Label issuer provenance without duplicating the shared issuer assessment.
        put('issuer-extra-panels', this.panel('Issuer assessment status',
            (data.dashboard_published ? '' : this.note((data.issuer || {}).authored_vs_band_note)) +
            this.note('Editorial evidence dated ' + ((data.issuer || {}).issuer_score_generated_at || 'not supplied'))));
        var breakdown = document.getElementById('breakdown-table');
        if (breakdown && breakdown.parentElement && !breakdown.parentElement.classList.contains('overflow-x-auto')) {
            var scroll = document.createElement('div');
            scroll.className = 'overflow-x-auto';
            breakdown.parentElement.insertBefore(scroll, breakdown);
            scroll.appendChild(breakdown);
        }
        // Keep the issuer qualification visible beside the top coverage figure.
        var band = document.getElementById('summary-cards');
        if (band && data.backing && data.backing.coverage_status === 'issuer_reported') {
            var caption = document.createElement('p');
            caption.className = 'col-span-full text-sm text-amber-700 sfrxusd-coverage-note';
            caption.textContent = 'Coverage is issuer reported; independent global coverage remains unestablished.';
            band.appendChild(caption);
        }
    }
};
