// Visible-text extraction for DOM claims. Paste into a browser evaluate call
// against a served page (python3 -m http.server, then ?asset=<slug>).
//
// ⚠️ WHY THIS EXISTS: on 2026-10-04 four separate claims about what a reader
// sees were wrong, and every one came from asking a question the instrument
// could not answer:
//
//   `innerHTML.includes(x)`        asked "did a reader see x?"  -> NO. Returns
//                                 true for text in a 0x0 box, inside
//                                 display:none, and inside a collapsed
//                                 <details>. Five sections were reported as
//                                 rendering on this basis; they were hidden.
//   `classList.contains('hidden')` asked "is this hidden?"      -> NO. The
//                                 bespoke renderers hide sections with
//                                 `style.display = 'none'` and never set the
//                                 class, so this passes on hidden content.
//   `innerText`                    asked "what is on the page?" -> UNDER-reports.
//                                 Collapsed <details> content is absent from
//                                 it, which produced three false negatives in
//                                 one hour.
//   one element's bounding box     asked "is the page informative?" -> NO. That
//                                 is a claim about every OTHER element.
//                                 `#section-liquidity` measured 0x0 and the
//                                 page's bespoke panel was rendering the same
//                                 evidence a few inches away.
//   a Python re-derivation         asked "what does the renderer do?" -> NO. A
//                                 second implementation is a new artifact with
//                                 its own bugs; it agreed on 4 of 5 assets and
//                                 the 5th was the one that mattered.
//
// ⚠️ AND THE SUBTLEST ONE: searching for a TOKEN and reporting a CONCEPT.
// "floor" matched the band's own subtitle `0.5% depth (floor)` and was reported
// as the producer's explanation ("A FLOOR, not a measurement") rendering. It was
// not. A string match tells you a word is present, never that a reader was told.
// Search for the WHOLE SENTENCE you claim a reader read.
//
// RULE OF THUMB: if a claim contains the word "reader", use visibleText().

/** Visible text of a subtree: text nodes whose ancestors are all displayed. */
function visibleText(root) {
    root = root || document.body;
    var W = root.ownerDocument.defaultView;
    var out = '';
    var walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        var el = walker.currentNode.parentElement;
        if (el && isVisible(el, W)) out += ' ' + walker.currentNode.nodeValue;
    }
    return out.replace(/\s+/g, ' ').trim();
}

/**
 * Text a reader can reach by HOVERING: title and aria-label on visible elements.
 *
 * ⚠️ NOT COSMETIC. `structural_score_basis` renders as a title="" on the
 * "Structural 4/10" chip in the summary band — a VISIBLE 114x26 element. On usdat
 * that tooltip carries "One key can queue a full-reach upgrade of the token, the
 * vault and the withdrawal queue", which is FACTUALLY WRONG (the control is a
 * 2-of-3 MPC representation) and contradicts the MPC framing rendered as plain
 * text elsewhere on the same page.
 *
 * I reported that claim as unreachable because visibleText() walks TEXT NODES and
 * a title attribute is not one. The tool said "not visible"; a reader reads it by
 * pointing at the chip. Fourth instrument-weaker-than-the-claim of the day, and
 * the only one where the tool itself was the cause.
 *
 * ⚠️ Absence from visibleText() does NOT mean a reader cannot read it.
 */
function hoverText(root) {
    root = root || document.body;
    var W = root.ownerDocument.defaultView;
    var out = '';
    var nodes = root.querySelectorAll('[title],[aria-label]');
    for (var i = 0; i < nodes.length; i++) {
        if (!isVisible(nodes[i], W)) continue;
        out += ' ' + (nodes[i].getAttribute('title') || '') +
               ' ' + (nodes[i].getAttribute('aria-label') || '');
    }
    return out.replace(/\s+/g, ' ').trim();
}

/** Computed style on the element AND every ancestor, plus a non-zero box. */
function isVisible(el, W) {
    W = W || el.ownerDocument.defaultView;
    var n = el;
    while (n && n.tagName !== 'BODY') {
        var cs = W.getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        // ⚠️ A collapsed <details> is NOT display:none — its children simply do
        // not render. innerHTML sees them; a reader does not.
        if (n.tagName === 'DETAILS' && !n.open && n.firstElementChild !== null) {
            var summary = n.querySelector(':scope > summary');
            if (!summary || !summary.contains(el)) return false;
        }
        n = n.parentElement;
    }
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
}

/**
 * Did a reader see this phrase? Pass the WHOLE sentence, not a keyword.
 *
 * Returns THREE answers, because on 2026-10-04 each instrument caught the case
 * another missed and neither is a superset of the other:
 *
 *   innerHTML   over-reports  — true inside display:none and collapsed <details>
 *   innerText   under-reports — omits collapsed <details>; blind to
 *                               visibility:hidden, zero-opacity and off-screen
 *   visibleText this file's walk — needs the explicit <details> branch, which is
 *                               why that branch is tested rather than assumed
 *
 * ⚠️ `disagree` is the field to read. When the three do not agree, the claim is
 * not yet settled and the next step is to look at the element, not to pick the
 * answer you prefer. Measured on crvusd: 20 of 20 <details> are closed, all 20
 * report a NON-ZERO box, innerText excludes all 20 correctly, and a box-only
 * check calls all 20 visible.
 */
function readerSaw(phrase, root) {
    root = root || document.body;
    var vis = visibleText(root).indexOf(phrase) >= 0;
    var hover = hoverText(root).indexOf(phrase) >= 0;
    var text = (root.innerText || '').replace(/\s+/g, ' ').indexOf(phrase) >= 0;
    var html = root.innerHTML.indexOf(phrase) >= 0;
    return {
        phrase: phrase,
        inVisibleText: vis,
        // ⚠️ Reachable by hover on a VISIBLE element. Deliberately NOT part of
        // `disagree` — text-vs-tooltip is a real distinction, not instruments
        // contradicting each other. `readerCanReach` is the field for "did we
        // publish this claim", and it is TRUE for a tooltip-only string.
        inHoverText: hover,
        readerCanReach: vis || hover,
        inInnerText: text,
        inInnerHTML: html,
        disagree: !(vis === text && text === html)
    };
}

// ⚠️ NEGATIVE CONTROL, NOT OPTIONAL. A check that cannot come out the other way
// has told you nothing. Before trusting a "renders correctly" result, break the
// input that is supposed to drive it and confirm the old face comes back — that
// is what proved the withdrawn-attachment-point branch was doing the work, and
// it is also what surfaced fxusd, a second unreported defect found by verifying
// that a fix changed NOTHING ELSE.
//
// ⚠️ AND RUN A POSITIVE CONTROL FOR THE OPPOSITE CAUSE: measuring that one page
// hides a section cannot distinguish "hidden here" from "hidden everywhere".
// tidresearch pinned ours to the bespoke renderers by measuring crvusd, where
// the same section renders at 753x6775. Without that the finding is true and
// unactionable.
if (typeof module !== 'undefined') module.exports = { visibleText, hoverText, isVisible, readerSaw };
