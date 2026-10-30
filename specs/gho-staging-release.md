# GHO staging release

Branch: staging/gho-dashboard. This branch contains the GHO six-axis dashboard,
selected data snapshots, adopted 6.0/4.0/6.5 assessments, collection/selection
tools, specification and tests. No unrelated family/fxsave work is included.
GHO stays published:false in the asset registry; access it directly with
`?asset=gho`. GitHub Pages production deploys main only; this branch does not
trigger that workflow. A separate staging preview is deployed from the exact
branch code and GHO-only data bundle.

Data is a review snapshot with original per-source clocks and limitations;
no recurring GHO collector or public report adoption is introduced. Full
historical research archives remain in producer review stores and are not
website content. The compact release receipt binds all selected GHO data.

Offline consumer checks: `python3 -m unittest discover -s tests -p test_gho_preview.py`
and `python3 -m unittest discover -s tests -p test_gho_axis5_candidate.py`.
For browser acceptance, serve the repo with python http.server and set
GHO_PREVIEW_URL and GHO_PREVIEW_DIR to this checkout before running
`node tests/test_gho_browser.cjs`. Browser dependencies and Chrome are configurable
through the existing test environment variables.

Hosting target is the existing tidresearch-staging Netlify site, under its
separate gho-dashboard alias. This does not replace staging.tidresearch.com
or production. Upload contains only application JS/CSS, index and GHO data;
no raw internal research directories or unrelated data snapshots. The release
receipt records hashes for every upload file.
