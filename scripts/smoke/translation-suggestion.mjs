const ISSUE_ORIGIN = "https://github.com";
const ISSUE_PATH = "/Sovereign-Communication/BigEnergyCo/issues/new";

async function clickSuggestionLink(ctx) {
  const point = await ctx.evaluate(`(() => {
    const link = document.querySelector("[data-translation-suggestion]");
    if (!link) return { error: "suggestion link is missing" };
    link.scrollIntoView({ block: "center" });
    window.__translationSuggestionHref = "";
    const observe = (event) => {
      if (event.isTrusted && link.dataset.translationSuggestionReady !== "true") return;
      event.preventDefault();
      link.removeEventListener("click", observe);
      window.__translationSuggestionHref = link.href;
    };
    link.addEventListener("click", observe);
    const range = document.createRange();
    range.selectNodeContents(link);
    for (const rect of range.getClientRects()) {
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (
        x >= 0 &&
        x < innerWidth &&
        y >= 0 &&
        y < innerHeight &&
        (hit === link || link.contains(hit))
      ) return { x, y };
    }
    return { error: "suggestion text has no visible hit-tested rectangle" };
  })()`);
  if (point?.error) return { href: null, reason: point.error };
  await ctx.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });
  await ctx.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  await ctx.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  const observed = await ctx.poll(
    () => ctx.evaluate("Boolean(window.__translationSuggestionHref)"),
    5000,
    50,
  );
  return observed
    ? { href: await ctx.evaluate("window.__translationSuggestionHref") }
    : { href: null, reason: "browser click produced no draft" };
}

export async function probeTranslationSuggestion(ctx, expectedTexts) {
  if (!expectedTexts?.en || !expectedTexts?.es)
    return { passed: false, reason: "expected locale text is unavailable" };
  await ctx.send("Page.navigate", { url: ctx.base });
  const loaded = await ctx.poll(
    () => ctx.evaluate('document.readyState === "complete"'),
    10000,
    100,
  );
  if (!loaded) return { passed: false, reason: "page load timed out" };
  const loaderReady = await ctx.poll(
    () =>
      ctx.evaluate(
        'document.querySelector("[data-translation-suggestion]")?.dataset.translationSuggestionLoaderReady === "true"',
      ),
    10000,
    50,
  );
  if (!loaderReady)
    return {
      passed: false,
      reason: "lazy suggestion click handler did not install",
    };
  const observed = await ctx.evaluate(`(async () => {
    const expectedTexts = ${JSON.stringify(expectedTexts)};
    const link = document.querySelector("[data-translation-suggestion]");
    const select = document.querySelector("#langSelect");
    const target = document.querySelector('[data-i18n="heroTitle1"]');
    if (!link || !select || !target) {
      return { error: "suggestion link, locale picker, or translated target is missing" };
    }
    const rect = link.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 &&
      getComputedStyle(link).visibility !== "hidden";
    const waitForLocaleText = async (locale) => {
      select.value = locale;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 100; i++) {
        if (
          document.documentElement.lang === locale &&
          target.textContent.trim() === expectedTexts[locale]
        ) return true;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return false;
    };
    const englishRendered = await waitForLocaleText("en");
    window.getSelection()?.removeAllRanges();
    return { visible, label: link.textContent.trim(), englishRendered };
  })()`);

  if (!observed || observed.error || !observed.englishRendered)
    return {
      passed: false,
      reason: observed?.error || "English translation did not render",
    };
  const emptyClick = await clickSuggestionLink(ctx);
  if (!emptyClick.href)
    return {
      passed: false,
      reason: `empty draft click did not complete: ${emptyClick.reason}`,
    };
  const localized = await ctx.evaluate(`(async () => {
    const expectedTexts = ${JSON.stringify(expectedTexts)};
    const select = document.querySelector("#langSelect");
    const target = document.querySelector('[data-i18n="heroTitle1"]');
    select.value = "es";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    for (let i = 0; i < 100; i++) {
      if (
        document.documentElement.lang === "es" &&
        target.textContent.trim() === expectedTexts.es
      ) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  })()`);
  if (!localized)
    return { passed: false, reason: "Spanish translation did not render" };

  const selectionReady = await ctx.evaluate(`(() => {
    const target = document.querySelector('[data-i18n="heroTitle1"]');
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  })()`);
  const selectedClick = await clickSuggestionLink(ctx);
  if (!selectedClick.href)
    return {
      passed: false,
      reason: `selected-text draft click did not complete: ${selectedClick.reason}`,
    };
  const final = await ctx.evaluate(`(() => {
    const link = document.querySelector("[data-translation-suggestion]");
    const selection = window.getSelection();
    const externalDraftRequests = performance.getEntriesByType("resource")
      .filter((entry) => entry.name.startsWith("https://github.com/Sovereign-Communication/BigEnergyCo/issues/new"))
      .length;
    const result = {
      locale: document.documentElement.lang,
      page: location.pathname,
      selectedText: selection.toString(),
      externalDraftRequests,
    };
    return result;
  })()`);
  await ctx.evaluate(`(async () => {
    const select = document.querySelector("#langSelect");
    const target = document.querySelector('[data-i18n="heroTitle1"]');
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    window.getSelection()?.removeAllRanges();
    for (let i = 0; i < 100; i++) {
      if (document.documentElement.lang === "en" && target.textContent.trim() === ${JSON.stringify(expectedTexts.en)}) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  })()`);

  const empty = new URL(emptyClick.href);
  const selected = new URL(selectedClick.href);
  const emptyBody = empty.searchParams.get("body") || "";
  const selectedBody = selected.searchParams.get("body") || "";
  const expectedPage = new URL(ctx.base).pathname;
  const passed =
    observed.visible &&
    observed.englishRendered &&
    localized &&
    final.locale === "es" &&
    final.page === expectedPage &&
    empty.origin === ISSUE_ORIGIN &&
    empty.pathname === ISSUE_PATH &&
    emptyBody.includes("Locale: en") &&
    emptyBody.includes("Page: " + expectedPage) &&
    emptyBody.includes("Translation key: (select the translated text)") &&
    !emptyBody.includes("Displayed text:") &&
    selected.origin === ISSUE_ORIGIN &&
    selected.pathname === ISSUE_PATH &&
    selected.searchParams.get("title")?.includes("es " + expectedPage) &&
    selectedBody.includes("Locale: es") &&
    selectedBody.includes("Page: " + expectedPage) &&
    selectedBody.includes("Translation key: heroTitle1") &&
    selectionReady === final.selectedText &&
    selectedBody.includes("Displayed text: " + final.selectedText) &&
    final.externalDraftRequests === 0;

  return {
    passed,
    visible: observed.visible,
    label: observed.label,
    locale: final.locale,
    page: final.page,
    key: "heroTitle1",
    emptyKey: emptyBody.match(/Translation key: ([^\n]+)/)?.[1] || "",
    selectedText: final.selectedText,
    issueOrigin: selected.origin,
    issuePath: selected.pathname,
    externalDraftRequests: final.externalDraftRequests,
    reason: passed
      ? ""
      : "prefill, locale synchronization, visibility, or no-request check failed",
  };
}
