# Mezzanine Hastra Optimizer — finite review handback

RiskAnalyst protocol assessment mezzanine-protocol-initial-2026-11-11-v1 is 3.5 overall provisional, with contract 3.5, economic 3.0 and project 3.5. This scope assigns no individual tranche grade.

115 Security files and 97 financial files passed hash verification. Security Ethereum26389424 at04:55:11UTC and BM26389426 at04:55:35UTC retain separate clocks. Senior and junior 21-decimal shares wrap 18-decimal mzUSD. Active accounting NAV is 2.717586m / 1.100457m mzUSD. Junior is 28.82254% of combined active tranche NAV or 19.63366% of total 5.604950m mzUSD supply. The two denominators serve different purposes. Base claims held inside tranches are counted once.

Vault and idle reservoir hold 27,284.21716 wYLDS. Wrapped settlement inventory is separate from verified USDC cash, funded execution reserves and independently recoverable strategyNAV. The execution reserve is for specified costs and has no established funded amount.

Direct withdrawal is disabled. Epoch duration is 600300 seconds with 603900 pending, senior 1 / junior 2 epoch waits and 50% pending-yield reduction. Junior-first loss ordering conditionally skips paused tranches; both were observed PROTOCOL-unpaused. Finalized reserved claims are excluded from activeNAV. Complete cash settlement, strategy debt/leverage/HF, full current authority and exact audit-build correspondence remain open.

Report owner path is /home/danger/riskAnalyst/reports/mezzanine.md.

Frozen local private evidence is retained under `.private-reviews/mezzanine-financial-2026-11-11`. Public aggregate facts are summarized here. Raw dossiers remain private.

- `aggregate-v1/acceptance.json` SHA256 `0ff5e1ff5e9e6709828e51e72ff889aff81fa6d88cdecb3ce2a2eeb3827a202e`
- `v1/package.json` SHA256 `fed341538c817f163741d022e1b16ac3cb5195ce269ad0d07974ef82bcd30767`
