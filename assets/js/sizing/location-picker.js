// Location-picker mechanics: the city combobox (suggestions, keyboard
// navigation, hands-free auto-resolve, lazy per-country loading) and the
// browser-geolocation "locate me" flow, extracted from ui.js. cities.js owns
// the domain layer (search, catalogs, online lookups); this module owns only
// the widgets. Every location decision funnels through the injected onPick
// callback, so the controller keeps single ownership of run state.
import {
  CITY_CATALOG,
  formatCityLabel,
  loadCountryCities,
  lookupCityOnline,
  lookupCountryOnline,
  mergeCities,
  nearestCity,
  normalizeCityQuery,
  searchCities,
  shouldAutoResolve,
  typedCityCandidates,
} from "./cities.js?v=20260925c";

function byId(id) {
  return document.getElementById(id);
}

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style") e.style.cssText = v;
    else if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }

  if (text !== undefined) e.textContent = text;

  return e;
}

export function setupCitySearch({
  onPick,
  onQueryChange = () => {},
  setStatus,
}) {
  const search = byId("citySearch");
  const list = byId("citySuggestions");

  if (!search || !list) {
    console.error("City search elements not found");
    return null;
  }

  let active = -1;
  let lookupGeneration = 0;
  // Fresh input → seed results instantly; any country partitions the query
  // names arrive in the background and re-open the list with the union.
  const draw = (results = searchCities(search.value, CITY_CATALOG)) => {
    list.innerHTML = "";
    list.hidden = !search.value.trim() || !results.length;
    results.forEach((c, i) => {
      const population =
        Number.isFinite(c.population) && c.population > 0
          ? ` · population ${c.population.toLocaleString()}`
          : "";
      const button = el(
        "button",
        { type: "button", role: "option", class: "city-suggestion" },
        `${formatCityLabel(c)}${population}`,
      );
      button.dataset.index = String(i);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        lookupGeneration += 1;
        cancelAutoResolve();
        onPick(
          c.lat,
          c.lon,
          `Sunshine data from ${formatCityLabel(c)}`,
          c.r,
          c.country,
        );
        lastResolvedQuery = normalizeCityQuery(search.value);
        lastResolvedLabel = search.value = formatCityLabel(c);
        list.hidden = true;
        search.setAttribute("aria-expanded", "false");
      });
      list.appendChild(button);
    });
    active = -1;
    search.setAttribute("aria-expanded", list.hidden ? "false" : "true");
  };
  let autoResolveTimer = null;
  let lastResolvedQuery = "";
  // The exact box text the last pick wrote (formatCityLabel's own output).
  // Re-resolving that same text cannot change the coordinates, so it must
  // never reach onPick — the controller would markPrecalcDirty and destroy
  // a result the visitor never changed.
  let lastResolvedLabel = "";
  const cancelAutoResolve = () => {
    if (autoResolveTimer !== null) {
      clearTimeout(autoResolveTimer);
      autoResolveTimer = null;
    }
  };
  const reset = () => {
    lookupGeneration += 1;
    cancelAutoResolve();
    lastResolvedQuery = "";
    lastResolvedLabel = "";
    search.value = "";
    list.innerHTML = "";
    list.hidden = true;
    search.setAttribute("aria-expanded", "false");
  };
  search.addEventListener("input", () => {
    lookupGeneration += 1;
    draw();
  });
  search.addEventListener("input", () => {
    // Lazy country loading: a typed query tags its own countries ("Aust"
    // → Austin/US + Australia/AU). Never fires for a query the seed
    // already answers exactly, so the common path costs zero requests.
    const query = search.value.trim();
    const generation = lookupGeneration;
    if (!query || searchCities(query, CITY_CATALOG, 1).length) return;
    typedCityCandidates(query).then((rows) => {
      if (rows.length <= CITY_CATALOG.length) return;
      CITY_CATALOG.splice(0, CITY_CATALOG.length, ...rows);
      // Superseded input: the user moved on; never redraw over their text.
      if (generation === lookupGeneration && search.value.trim() === query)
        draw();
    });
  });
  // Auto-lookup: 2s after the typing cadence stops, resolve the typed text
  // to coordinates without requiring Enter/Tab. Fires the same code path
  // Enter/Tab use, so behavior is identical — just hands-free.
  search.addEventListener("input", (event) => {
    cancelAutoResolve();
    const query = search.value.trim();
    if (query === lastResolvedLabel) return;
    // Editing away from the selected label means the coordinates no longer
    // match the visible query. Require a suggestion/lookup to resolve it.
    lastResolvedQuery = "";
    lastResolvedLabel = "";
    onQueryChange(query);
    // IME composition (CJK input): keystrokes mid-composition are not the
    // final text — let composition finish before scheduling the lookup.
    if (event.isComposing) return;
    if (!shouldAutoResolve(query, lastResolvedQuery)) return;
    autoResolveTimer = setTimeout(() => {
      autoResolveTimer = null;
      const query = search.value.trim();
      if (!shouldAutoResolve(query, lastResolvedQuery)) return;
      // The user arrow-navigating an open suggestion list is actively
      // choosing — don't auto-resolve out from under them.
      if (!list.hidden && active >= 0) return;
      resolveTypedCity();
    }, 2000);
  });
  const resolveTypedCity = async () => {
    cancelAutoResolve();
    const query = search.value.trim();
    const generation = lookupGeneration;
    if (!query) return;
    // The seed catalog cannot resolve formatCityLabel's own output, and
    // Tab/Enter call here WITHOUT the timer's shouldAutoResolve gate — so
    // the module's own label used to go online, re-pick identical
    // coordinates, and invalidate a fresh result (observed: four phantom
    // invalidations in one keyboard walk). Same label → same place → stop.
    if (query === lastResolvedLabel) return;
    // Seed-catalog hit first (instant, offline): resolve immediately —
    // country partitions only extend the search, they never gate it.
    const local = searchCities(query, CITY_CATALOG, 1)[0];
    if (local) {
      lastResolvedQuery = query;
      onPick(
        local.lat,
        local.lon,
        `Sunshine data from ${formatCityLabel(local)}`,
        local.r,
        local.country,
      );
      lastResolvedLabel = search.value = formatCityLabel(local);
      list.hidden = true;
      search.setAttribute("aria-expanded", "false");
      return;
    }
    // No seed hit: try the query's own country partitions (Berlin→DE) —
    // an offline hit here beats sending the query to the geocoder.
    setStatus("Searching city data…");
    const offline = (await typedCityCandidates(query)).find(
      (c) => normalizeCityQuery(c.name) === normalizeCityQuery(query),
    );
    // The box changed while partitions loaded: this resolution is stale —
    // never overwrite what the user is typing; the new input re-resolves.
    if (generation !== lookupGeneration || search.value.trim() !== query)
      return;
    if (offline) {
      lastResolvedQuery = query;
      onPick(
        offline.lat,
        offline.lon,
        `Sunshine data from ${formatCityLabel(offline)}`,
        offline.r,
        offline.country,
      );
      lastResolvedLabel = search.value = formatCityLabel(offline);
      list.hidden = true;
      search.setAttribute("aria-expanded", "false");
      return;
    }
    // Still nothing: the online geocoder resolves any place on Earth.
    setStatus("Looking up your city…");
    const match = await lookupCityOnline(query);
    // Superseded input: the new text owns the status line; stay silent.
    if (generation !== lookupGeneration || search.value.trim() !== query)
      return;
    if (!match) {
      setStatus("No match found — check the spelling or pick a suggestion.");
      return;
    }
    // Warm the partition the geocoder named so later queries in that
    // country search locally and offline.
    const cc = String(match.country || "").toUpperCase();
    if (cc.length === 2)
      loadCountryCities(cc).then((rows) => {
        if (!rows.length) return;
        CITY_CATALOG.splice(
          0,
          CITY_CATALOG.length,
          ...mergeCities(CITY_CATALOG, rows),
        );
      });
    lastResolvedQuery = query;
    onPick(
      match.lat,
      match.lon,
      `Sunshine data from ${formatCityLabel(match)}`,
      match.r,
      match.country,
    );
    lastResolvedLabel = search.value = formatCityLabel(match);
    list.hidden = true;
    search.setAttribute("aria-expanded", "false");
  };
  search.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      // Let focus move naturally, but resolve the typed city first.
      // The explicit paths cancel the pending auto-lookup so it cannot
      // double-fire after an immediate resolution.
      cancelAutoResolve();
      resolveTypedCity();
      return;
    }
    if (event.key === "Enter") {
      cancelAutoResolve();
      const options = list.querySelectorAll("[role=option]");
      // If the user arrowed to a specific suggestion, let that handler pick it.
      if (!(active >= 0 && options.length)) {
        event.preventDefault();
        resolveTypedCity();
      }
    }
  });
  search.addEventListener("keydown", (event) => {
    const options = [...list.querySelectorAll("[role=option]")];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length) {
        active =
          (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
          options.length;
        options.forEach((o, i) =>
          o.setAttribute("aria-selected", i === active ? "true" : "false"),
        );
        options[active].focus();
      }
    } else if (event.key === "Escape") {
      list.hidden = true;
      search.setAttribute("aria-expanded", "false");
    } else if (event.key === "Enter" && active >= 0 && options[active]) {
      event.preventDefault();
      options[active].click();
      search.focus();
    }
  });
  search.addEventListener("blur", () => {
    cancelAutoResolve();
    setTimeout(() => {
      list.hidden = true;
      search.setAttribute("aria-expanded", "false");
    }, 150);
  });
  return reset;
}

// The old whole-world loader cached every partition under one localStorage
// key (~4.6 MB). Country data now loads on demand under per-country keys, so
// drop the legacy blob once per browser to keep quotas clean.
export function purgeLegacyCityCache() {
  try {
    localStorage.removeItem("beco-city-catalog-v6-pop10k-us");
  } catch {
    /* optional cache */
  }
}

export function locateMe({ onPick, setStatus, isCurrent = () => true }) {
  if (!navigator.geolocation) {
    setStatus(
      "Warning: Your browser can't share a location. Search for a city instead.",
    );

    return;
  }

  setStatus(" Asking your browser for your location…");

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      if (!isCurrent()) return;
      const lat = pos.coords.latitude,
        lon = pos.coords.longitude;

      onPick(lat, lon, "Using your precise location");

      if (byId("coordDetails")) byId("coordDetails").open = true;

      setStatus(" Location set. Resolving the nearest city for area prices…");

      // Proper area-price lookup: always resolve the nearest reference city
      // (no distance gate) so its state/region/country drives the tariff,
      // currency, and install-labor factors — the coordinate-box estimate is
      // only a fallback if the catalog never loads.
      const near = nearestCity(lat, lon, CITY_CATALOG, Infinity);
      if (near) {
        onPick(
          lat,
          lon,
          `Using your precise location — prices based on ${formatCityLabel(near)}`,
          near.r,
          near.country,
        );
      } else {
        onPick(lat, lon, "Using your precise location");
      }

      // Location is consent to use coordinates, not consent to calculate.
      // A prior result may refresh quietly; the first run always needs the
      // explicit sizing button.

      // Refine in the background: reverse-geocode the fix to a country so the
      // nearest reference city (and its tariff/currency) is not limited to
      // the 67 seed cities. Sizing already started from the seed context;
      // a different country context re-pins prices and re-runs once.
      const geo = await lookupCountryOnline(lat, lon);
      // Anything that resolved or was typed since the GPS fix landed wins:
      // the refine re-pins label, price context, and the coordinate boxes
      // themselves, so it must not fire over a newer location choice.
      if (!isCurrent()) return;
      if (!geo?.country || geo.country === near?.country) return;
      const refined = nearestCity(lat, lon, CITY_CATALOG, Infinity);
      onPick(
        lat,
        lon,
        `Using your precise location — prices based on ${geo.r && geo.r !== "Worldwide" ? geo.r : geo.country}`,
        geo.r === "Worldwide" ? refined?.r : geo.r,
        geo.country,
      );
    },
    () =>
      setStatus(
        "Warning: Couldn't get your location. Search for a city instead.",
      ),
    { timeout: 8000 },
  );
}
