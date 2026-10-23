const mm = window.matchMedia.bind(window);
window.matchMedia = (q) => (q.includes("reduced-motion") ? { matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
