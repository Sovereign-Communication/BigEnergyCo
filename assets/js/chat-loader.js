// Chat widget lazy loader: loads chat.js on first interaction or when idle,
// keeping it out of the pre-interactive critical path.
(function () {
  var loaded = false;
  function loadChat() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement("script");
    s.src = "./assets/js/chat.js?v=20261008b";
    s.defer = true;
    document.body.appendChild(s);
  }
  ["click", "keydown", "touchstart"].forEach(function (evt) {
    window.addEventListener(evt, loadChat, { once: true, passive: true });
  });
  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadChat, { timeout: 5000 });
  } else {
    setTimeout(loadChat, 5000);
  }
})();
