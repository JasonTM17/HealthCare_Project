/* Runs before hydration. Preview is a read-only document even before authorization. */
(() => {
  if (!new URLSearchParams(window.location.search).has("cmsPreview")) return;
  const denied = () => new DOMException("Thao tác nghiệp vụ bị tắt trong bản xem trước CMS.", "NotAllowedError");
  const readable = (url, method) => {
    if (method !== "GET" && method !== "HEAD") return false;
    let target;
    try { target = new URL(url, window.location.href); } catch { return false; }
    if (target.origin !== window.location.origin) return false;
    // Only public catalogue/content and the authenticated draft/session reads are needed.
    if (!target.pathname.startsWith("/api/")) return true;
    return /^\/api\/v1\/(?:hospital\/(?:branches|doctors|specialties|packages|services|articles|faqs|careers)(?:\/|$)|hospital\/health-questions$|careers\/jobs$|cms\/content\/|admin\/cms\/content\/[^/]+\/draft$|auth\/(?:session|browser-sessions\/current)$|health$)/.test(target.pathname);
  };
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (!readable(url, method)) return Promise.reject(denied());
    return fetchOriginal(input, init);
  };
  const openOriginal = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    if (!readable(String(url), String(method).toUpperCase())) throw denied();
    return openOriginal.call(this, method, url, ...args);
  };
  navigator.sendBeacon = () => false;
  HTMLFormElement.prototype.submit = function () { throw denied(); };
  HTMLFormElement.prototype.requestSubmit = function () { throw denied(); };
  document.addEventListener("submit", (event) => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    // Native annotated fields receive the click through React. Other controls remain inert.
    if (target?.closest("[data-cms-native-field]")) { event.preventDefault(); return; }
    if (target?.closest("a,button,input,select,textarea,[role=button]")) {
      event.preventDefault(); event.stopImmediatePropagation();
      window.dispatchEvent(new Event("healthcare:cms-preview-blocked"));
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-cms-native-field]") && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); return; }
    if ((event.key === "Enter" || event.key === " ") && target?.closest("a,button,input,select,textarea,[role=button]")) {
      event.preventDefault(); event.stopImmediatePropagation();
      window.dispatchEvent(new Event("healthcare:cms-preview-blocked"));
    }
  }, true);
})();
