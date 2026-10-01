// The install-control reveal rule, and the layout shift it exists to prevent.
//
// WHY THIS TEST EXISTS: `beforeinstallprompt` fires ~800ms AFTER first paint.
// The handler used to reveal BOTH install controls at that point — the header
// button and the mobile-drawer button — which reflowed the header CTA row
// 109px sideways and pushed `section.hero` down with it. Measured on the staged
// build at P0.4, home/mobile: CLS 0.121 against the plan's 0.02 ceiling, which
// Lighthouse attributed entirely to `section.hero`. Decomposed, that is an
// impact fraction of 0.95 times a distance fraction of 109/844 — the defect is
// HORIZONTAL reflow of the header, not the 7px vertical hero shift that the
// header-height change also caused. Fixing only the vertical part would have
// left 0.11 of the 0.121 in place.
//
// WHY SOURCE ASSERTIONS AND NOT ONLY PURE CALLS: the pure rule is the fast half
// and it is what makes the intent checkable. The source assertions are the half
// that catches the rule being bypassed — a future edit that sets
// `style.display` on both buttons again would pass every `installReveal` test
// and reintroduce the shift, because the defect was never in the rule, it was
// in there being no rule. The end-to-end half is the Lighthouse gate, which
// reports CLS for all 14 templates on every run and compares against the 0.02
// ceiling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INSTALL_NAV_BREAKPOINT_PX,
  installReveal,
} from "../assets/js/sizing/pwa-install.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const UI = "assets/js/sizing/ui.js";
const CSS = "assets/site.css";
const INDEX = "index.html";

test("the prompt reveals exactly one install control, never both", () => {
  // The regression itself: two non-`none` values in one call is the 109px
  // reflow, so it is asserted as a property of every case rather than left to
  // each case's expected literal.
  for (const narrow of [true, false]) {
    for (const available of [true, false]) {
      const r = installReveal(narrow, available);
      const shown = [r.header, r.drawer].filter((d) => d !== "none");
      assert.equal(
        shown.length,
        available ? 1 : 0,
        `narrow=${narrow} available=${available} showed ${shown.length} controls`,
      );
    }
  }
});

test("a narrow viewport uses the drawer control and a wide one uses the header", () => {
  assert.deepEqual(installReveal(true, true), {
    header: "none",
    drawer: "flex",
  });
  assert.deepEqual(installReveal(false, true), {
    header: "inline-flex",
    drawer: "none",
  });
});

test("no prompt, or an accepted install, hides both controls", () => {
  for (const narrow of [true, false]) {
    assert.deepEqual(installReveal(narrow, false), {
      header: "none",
      drawer: "none",
    });
  }
});

test("the JS breakpoint is the CSS breakpoint that hides the inline nav", () => {
  // DRIFT GUARD, and the reason this is an assertion rather than a comment: the
  // rule above is only correct while the drawer exists at the same width the
  // JS assumes. If someone edits the `@media` block and not the constant, the
  // reveal starts putting a button into a layout that has no drawer — and the
  // symptom is a shift again, on whatever device happens to sit between the
  // two numbers.
  const css = read(CSS);
  // The block that turns the hamburger on and the inline nav off is the one
  // that defines "narrow" for this header; find it by its own selectors rather
  // than by its position, so reordering blocks cannot silently break this.
  const blocks = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{/g)];
  const drawerBlock = blocks.find((m) => {
    // Take the block body up to the next @media and look for the hamburger.
    const start = m.index + m[0].length;
    const rest = css.slice(start);
    const end = rest.search(/\n\}/);
    return /\.nav-toggle\s*\{[^}]*display:\s*flex/.test(
      rest.slice(0, end === -1 ? rest.length : end + 2),
    );
  });
  assert.ok(
    drawerBlock,
    "site.css: no @media (max-width: Npx) block turns .nav-toggle on — the " +
      "breakpoint this rule keys off no longer exists, so installReveal's " +
      "narrow/wide split has lost its meaning",
  );
  assert.equal(
    Number(drawerBlock[1]),
    INSTALL_NAV_BREAKPOINT_PX,
    `site.css hides the inline nav at max-width ${drawerBlock[1]}px but ` +
      `pwa-install.js assumes ${INSTALL_NAV_BREAKPOINT_PX}px`,
  );
});

test("the drawer control is inside the closed drawer, so revealing it is free", () => {
  // The narrow branch of the rule is only a no-op if the drawer it reveals
  // into is itself display:none until opened. Assert the markup nesting, so a
  // future markup move that puts the control in the header flow is caught here
  // rather than in a CLS reading.
  const html = read(INDEX);
  const drawer = html.indexOf('id="mobileNavDrawer"');
  const control = html.indexOf('id="btnInstallAppMobile"');
  assert.ok(
    drawer !== -1 && control !== -1,
    "both controls must exist in index.html",
  );
  assert.ok(
    control > drawer,
    "#btnInstallAppMobile must come after #mobileNavDrawer in the markup",
  );
  // The drawer closes with display:none (`.mobile-nav-drawer` has no `open`
  // class in the markup), so nothing inside it contributes to layout until the
  // nav is actually opened.
  const drawerEl = html.slice(drawer, control);
  assert.ok(
    !/class="[^"]*\bopen\b/.test(drawerEl),
    "#mobileNavDrawer must not carry the `open` class in the served markup",
  );
});

test("both install controls start hidden, so the header needs no reserved slot", () => {
  const html = read(INDEX);
  for (const id of ["btnInstallApp", "btnInstallAppMobile"]) {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at !== -1, `${id} missing from index.html`);
    const open = html.indexOf(">", at);
    const tag = html.slice(at, open);
    assert.match(
      tag,
      /display:\s*none/,
      `${id} must start display:none — the whole point of the viewport rule is ` +
        "that a hidden control reserves no space, so a static one would leave " +
        "a permanent empty gap in the navigation",
    );
  }
});

test("setupPwaControls routes every reveal through the rule", () => {
  // The bypass guard. A literal `style.display = "inline-flex"` or `"flex"`
  // inside the handler is the defect returning; the rule must be the only
  // thing that decides a control's visibility.
  const ui = read(UI);
  const start = ui.indexOf("function setupPwaControls()");
  assert.ok(start !== -1, "setupPwaControls not found in ui.js");
  const body = ui.slice(start, ui.indexOf("\nfunction ", start + 10));

  assert.ok(
    body.includes("installReveal("),
    "setupPwaControls must call installReveal()",
  );
  assert.ok(
    body.includes("applyInstallVisibility(true)") &&
      body.includes("applyInstallVisibility(false)"),
    "both the prompt and the accepted/appinstalled paths must go through " +
      "applyInstallVisibility so there is one rule rather than three",
  );
  // No install control may be shown by assigning a display value directly.
  // Scoped to btnH/btnM on purpose: the offline badge legitimately sets
  // `display` on itself (see the test below), and widening this guard to every
  // `.style.display` in the function would have banned the badge's own
  // behaviour rather than the regression it is here to catch.
  const direct = body.match(/\bbtn[HM]\.style\.display\s*=\s*"(?!none)/g) || [];
  assert.deepEqual(
    direct,
    [],
    "setupPwaControls sets a visible display value directly on an install " +
      "control; show it through installReveal() instead",
  );
});

test("the offline badge keeps its own display handling", () => {
  // The install fix must not have quietly absorbed the badge. The badge has
  // different semantics — an online/offline flash that relies on reading its
  // own current value back — so it stays on explicit display assignments.
  const ui = read(UI);
  const start = ui.indexOf("function setupPwaControls()");
  const body = ui.slice(start, ui.indexOf("\nfunction ", start + 10));
  assert.ok(
    /badge\.style\.display\s*=\s*"inline-flex"/.test(body),
    "the offline badge reveal must survive: it is a status indicator with " +
      "online/offline flash semantics, not a layout-sensitive install control",
  );
  assert.ok(
    body.includes("online-flash"),
    "the offline badge's online-flash class handling must survive the change",
  );
});
