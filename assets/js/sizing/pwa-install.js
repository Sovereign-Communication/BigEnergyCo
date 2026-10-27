// `beforeinstallprompt` fires after first paint; showing both controls caused
// 0.121 CLS on mobile. Reveal only the control for the active layout.
export const INSTALL_NAV_BREAKPOINT_PX = 830;

// Keep both hidden until an install prompt is available.
export function installReveal(narrow, available) {
  if (!available) return { header: "none", drawer: "none" };
  return narrow
    ? { header: "none", drawer: "flex" }
    : { header: "inline-flex", drawer: "none" };
}
