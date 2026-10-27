// Bounded, exact-key memo for the engine's feasibility sims.
//
// simulateOffset is pure in exactly (pvKw, battKwhUsable, chemistry,
// capacityScale, e1kw, loadWh, tempsC). The key below carries the four
// inputs that vary within one search; the caller (run.js) owns the map and
// must share it only across calls whose (e1kw, loadWh, tempsC) are identical
// — it enforces that by keying the map to the site series + derate + load
// identity (simCacheFor) and starting a fresh map whenever any of them
// changes. An exact-key hit is byte-for-byte the same computation a miss
// would run: memoization, never approximation (a warm-start guess can
// diverge; a lookup cannot).

// Big enough to hold several full battery-row sweeps (battMax 150 x ~10
// probes x a few chemistries), small enough to stay flat in a long session.
export const SIM_CACHE_MAX_ENTRIES = 30000;

/** Wrap `simulate` in a memo writing into the caller-owned `cache`. */
export function memoizeSimulate(simulate, cache) {
  return (o) => {
    const key = `${o.chemistry}|${o.capacityScale}|${o.pvKw}|${o.battKwhUsable}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const r = simulate(o);
    // Bounded: a long session sweeps an unbounded union of lattices. A full
    // clear is safe (hits are pure repeats, misses recompute) and keeps the
    // worker's memory flat.
    if (cache.size >= SIM_CACHE_MAX_ENTRIES) cache.clear();
    cache.set(key, r);
    return r;
  };
}
