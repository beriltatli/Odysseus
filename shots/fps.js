const mm = window.matchMedia.bind(window);
window.matchMedia = (q) => (q.includes("reduced-motion") ? { matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
window.__frames = 0;
const raf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (f) => raf((t) => { window.__frames++; f(t); });
