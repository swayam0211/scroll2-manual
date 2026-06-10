/**
 * RYŪJIN CHRONICLES v5 — Clean, Focused Fix
 * Bugs fixed:
 *  1. Sub-pixel gaps between slices
 *  2. Act I text visible at page load
 *  3. Sections 3-5 black (rv-pending hybrid approach)
 *  4. Slices not drifting far enough
 */
'use strict';

const INERTIA = 0.075;
const SLICE_N = 5;
const SLICE_RADIUS = 26;
const AMBIENT_MAX = 0.05;
// Drift per slice: negative=left, positive=right, center=minimal
const DRIFT = [-1, -0.5, 0.04, 0.5, 1];

/* ── State ── */
let curY = 0, tgtY = 0, prevY = 0;
let mx = 0.5, my = 0.5;
let ambOp = 0, breathPh = 0;
let soundOn = false, audioRaf = null;
let reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ── DOM ── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const grainCvs = $('grain-canvas');
const ambLight = $('ambient-light');
const sndBtn = $('sound-toggle');
const icnMuted = $('icon-muted');
const icnSound = $('icon-sound');
const ambAudio = $('ambient-audio');
const scrollInd = $('scroll-indicator');
const heroOverlay = $('hero-overlay');
const sliceWrap = $('slice-wrap');
const sliceReveal = $('slice-reveal');
const eyeGlowEl = $('eye-glow');
const sliceSec = $('s-slice');
const sliceTxtEl = $('slice-text');
const sliceLabel = $('slice-label');
const sliceBody = $('slice-body');
const sliceMicro = $('slice-micro');
const sliceWords = $$('#slice-heading .word');
const heroImg = $('hero-img');
const expandBgEl = $('expand-bg');
const eyeFrameEl = $('eye-frame');
const finalBgEl = $('final-bg');
const dustCvs = $('dust-canvas');
const secExpand = $('s-expand');
const secEye = $('s-eye');
const secFinal = $('s-final');

/* ── Helpers ── */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const easeOut = t => 1 - Math.pow(1 - t, 3.0);
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function inView(el, thr = 0.1) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * (1 - thr) && r.bottom > 0;
}

/* ════════════════════════════════════════
   1. FILM GRAIN
   ════════════════════════════════════════ */
(function () {
    if (!grainCvs) return;
    const ctx = grainCvs.getContext('2d');
    let gw = 0, gh = 0, frame = 0;
    const resize = () => { gw = grainCvs.width = window.innerWidth; gh = grainCvs.height = window.innerHeight; };
    const draw = () => {
        if (++frame % 2 === 0) {
            const id = ctx.createImageData(gw, gh), d = id.data;
            for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 14; }
            ctx.putImageData(id, 0, 0);
        }
        requestAnimationFrame(draw);
    };
    window.addEventListener('resize', resize, { passive: true });
    resize(); draw();
})();

/* ════════════════════════════════════════
   2. INERTIA SCROLL
   ════════════════════════════════════════ */
window.addEventListener('scroll', () => { tgtY = window.scrollY; }, { passive: true });

/* ════════════════════════════════════════
   3. SCROLL INDICATOR
   ════════════════════════════════════════ */
let indGone = false;
function updateIndicator(sy) {
    if (!scrollInd) return;
    if (sy > 50 && !indGone) { indGone = true; scrollInd.classList.add('hidden'); }
    if (sy <= 12 && indGone) { indGone = false; scrollInd.classList.remove('hidden'); }
}

/* ════════════════════════════════════════
   4. SLICE BUILDER
   FIX: +2px width & -1px offset eliminates sub-pixel gaps
   ════════════════════════════════════════ */
(function () {
    if (!sliceWrap || !heroImg) return;
    const src = heroImg.getAttribute('src');
    const pw = 100 / SLICE_N;          // 20% each

    for (let i = 0; i < SLICE_N; i++) {
        const div = document.createElement('div');
        div.className = 'slice-piece';

        // Slightly overlap each slice by 1px left and make 2px wider
        // This eliminates the 1px dark gap from sub-pixel rounding
        const left = i === 0 ? 0 : i * pw;
        const width = pw;
        div.style.cssText = `left:${left}%;width:calc(${width}% + 2px);`;
        div.dataset.i = i;

        const img = document.createElement('img');
        img.src = src; img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.loading = 'eager';
        // Image must be SLICE_N× wider; each is offset so only its slice portion shows
        img.style.cssText = `
      position:absolute; top:0; height:100%;
      width:${SLICE_N * 100}%;
      left:${i === 0 ? 0 : -(i * 100)}%;
      object-fit:cover; object-position:center 28%;
      filter:brightness(0.72) contrast(1.04);
    `;
        div.appendChild(img);
        sliceWrap.appendChild(div);
    }
})();

/* ════════════════════════════════════════
   5. SLICE ANIMATION (X-direction)
   FIX: viewport-relative drift so slices go far enough
   progress = curY / (sectionHeight - vh)  since section starts at top
   ════════════════════════════════════════ */
let sliceTxtOn = false;

function updateSlices(sy) {
    if (!sliceSec) return;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const scrollable = sliceSec.offsetHeight - vh;
    if (scrollable < 100) return;

    const prog = clamp(sy / scrollable, 0, 1);

    // Phase A [0–0.46]: slices begin separating
    // Phase B [0.28–0.72]: dragon image fades in
    // Phase C [0.66–1.00]: slices drift far and fade
    const phA = clamp(prog / 0.46, 0, 1);
    const phB = clamp((prog - 0.28) / 0.44, 0, 1);
    const phC = clamp((prog - 0.66) / 0.34, 0, 1);
    const eA = easeOut(phA);
    const eB = easeOut(phB);
    const eC = easeIO(phC);

    // Hero overlay: fades out between prog 0.05–0.22
    if (heroOverlay) {
        const ha = clamp(1 - (prog - 0.05) / 0.17, 0, 1);
        heroOverlay.style.opacity = ha.toFixed(3);
    }

    // Slices — use vw-relative drift so they actually complete
    const pieces = sliceWrap ? sliceWrap.querySelectorAll('.slice-piece') : [];
    pieces.forEach((p, i) => {
        const dir = DRIFT[i];
        const xA = dir * eA * vw * 0.15;   // Phase A: open up (max ±154px at 1024px)
        const xC = dir * eC * vw * 0.48;   // Phase C: fly off  (max ±491px at 1024px)
        const tx = xA + xC;
        const liftY = Math.abs(dir) * eA * -6;
        const radius = eA * SLICE_RADIUS;
        const shA = eA * 0.32;
        const shSp = eA * 80;

        p.style.transform = `translateX(${tx.toFixed(1)}px) translateY(${liftY.toFixed(1)}px)`;
        p.style.borderRadius = `${radius.toFixed(1)}px`;
        p.style.opacity = (1 - eC * 0.92).toFixed(3);
        p.style.boxShadow = `${(dir * eA * 4).toFixed(1)}px 12px ${shSp.toFixed(0)}px rgba(0,0,0,${shA.toFixed(2)})`;
    });

    // Reveal image
    if (sliceReveal) sliceReveal.style.opacity = clamp(eB * (1 - eC * 0.02), 0, 1).toFixed(3);

    // Eye glow
    if (eyeGlowEl) {
        const g = clamp((phB - 0.45) / 0.55, 0, 1);
        eyeGlowEl.style.opacity = (easeOut(g) * 0.82).toFixed(3);
    }

    // Slice Act I text — entire container toggled
    const showTxt = phB > 0.55;
    if (showTxt !== sliceTxtOn) {
        sliceTxtOn = showTxt;
        if (sliceTxtEl) sliceTxtEl.style.opacity = showTxt ? '1' : '0';
        if (showTxt) {
            sliceLabel && sliceLabel.classList.add('active');
            sliceBody && sliceBody.classList.add('active');
            sliceMicro && sliceMicro.classList.add('active');
            staggerWords(sliceWords, 62);
        } else {
            sliceLabel && sliceLabel.classList.remove('active');
            sliceBody && sliceBody.classList.remove('active');
            sliceMicro && sliceMicro.classList.remove('active');
            sliceWords.forEach(w => w.classList.remove('active', 'pre'));
        }
    }
}

/* ════════════════════════════════════════
   6. WORD STAGGER
   ════════════════════════════════════════ */
function staggerWords(nl, delay) {
    Array.from(nl).forEach((w, i) => {
        w.classList.add('pre');
        setTimeout(() => w.classList.add('active'), 20 + i * delay);
    });
}

/* ════════════════════════════════════════
   7. SECTION PARALLAX
   ════════════════════════════════════════ */
function updateExpand() {
    if (!expandBgEl || !secExpand) return;
    const r = secExpand.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const t = clamp(-r.top / (r.height + vh), 0, 1);
    expandBgEl.style.transform = `translateY(${(t * 30).toFixed(1)}px)`;
}

function updateFinal() {
    if (!finalBgEl || !secFinal) return;
    const r = secFinal.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const t = clamp(-r.top / (r.height + vh), 0, 1);
    finalBgEl.style.transform = `translateY(${(t * 22).toFixed(1)}px)`;
}

/* ════════════════════════════════════════
   8. EYE MOUSE DEPTH (max ±6px)
   ════════════════════════════════════════ */
window.addEventListener('mousemove', e => {
    mx = e.clientX / window.innerWidth;
    my = e.clientY / window.innerHeight;
}, { passive: true });

function updateEye() {
    if (!eyeFrameEl || !secEye) return;
    const r = secEye.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    eyeFrameEl.style.transform = `translate(${((mx - 0.5) * 12).toFixed(2)}px,${((my - 0.5) * 8).toFixed(2)}px)`;
}

/* ════════════════════════════════════════
   9. AMBIENT LIGHT
   ════════════════════════════════════════ */
function updateAmbient(vel) {
    if (!ambLight) return;
    const abs = clamp(Math.abs(vel), 0, 28);
    ambOp = lerp(ambOp, 0.016 + (abs / 28) * (AMBIENT_MAX - 0.016), 0.065);
    if (abs < 0.8) { breathPh += 0.007; ambOp = lerp(ambOp, 0.012 + ((Math.sin(breathPh) + 1) / 2) * 0.014, 0.036); }
    ambLight.style.opacity = ambOp.toFixed(4);
}

/* ════════════════════════════════════════
   10. DUST PARTICLES
   ════════════════════════════════════════ */
(function () {
    if (!dustCvs) return;
    const ctx = dustCvs.getContext('2d'); let dw = 0, dh = 0;
    const pts = Array.from({ length: 36 }, () => ({
        x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.3,
        vx: (Math.random() - 0.5) * 0.00009, vy: -(Math.random() * 0.00013 + 0.00003), a: Math.random() * 0.24 + 0.04
    }));
    const resize = () => { dw = dustCvs.width = dustCvs.offsetWidth || window.innerWidth; dh = dustCvs.height = dustCvs.offsetHeight || window.innerHeight; };
    const draw = () => {
        ctx.clearRect(0, 0, dw, dh);
        pts.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0; if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
            ctx.beginPath(); ctx.arc(p.x * dw, p.y * dh, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(215,210,200,${p.a})`; ctx.fill();
        });
        requestAnimationFrame(draw);
    };
    window.addEventListener('resize', resize, { passive: true }); resize(); draw();
})();

/* ════════════════════════════════════════
   11. REVEAL QUEUE  (Hybrid approach)
   ─────────────────────────────────────────
   Content starts VISIBLE in CSS.
   On init: elements below fold get 'rv-pending' (opacity:0).
   RAF: when in view → 'rv-active' triggers transition.
   If JS is slow / fails → content stays visible. ✓
   ════════════════════════════════════════ */
const revQueue = [];

function buildRevealQueue() {
    const selectors = [
        // Section 3
        '#s-expand .section-body',
        '#s-expand .reveal-micro',
        // Section 4
        '#s-eye .eye-text',
        '#s-eye .section-body',
        '#s-eye .quote-attr',
        // Section 5
        '#s-final .final-title',
        '#s-final .final-body',
        '#s-final .final-cta',
        '#s-final .reveal-accent',
        '#s-final .label',
        // Section 3 & 4 labels
        '#s-expand .label',
        '#s-eye .label',
    ];

    selectors.forEach(sel => {
        $$(sel).forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.top > window.innerHeight * 0.85) {
                el.classList.add('rv-pending');
                revQueue.push({ el, done: false, isHeading: false });
            }
        });
    });

    // Section title words (rw class) — stagger reveal
    ['#s-expand .section-title', '#s-eye .section-title', '#s-final .final-title'].forEach(sel => {
        const heading = document.querySelector(sel);
        if (!heading) return;
        const r = heading.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.85) {
            revQueue.push({ el: heading, done: false, isHeading: true });
        }
    });
}

function runRevealQueue() {
    revQueue.forEach(item => {
        if (item.done) return;
        if (!inView(item.el, 0.1)) return;
        item.done = true;
        if (item.isHeading) {
            const words = item.el.querySelectorAll('.rw');
            staggerWords(words, 65);
        } else {
            item.el.classList.remove('rv-pending');
            item.el.classList.add('rv-active');
        }
    });
}

/* ════════════════════════════════════════
   12. AUDIO
   ════════════════════════════════════════ */
if (ambAudio) { ambAudio.volume = 0; ambAudio.muted = true; }
function fadeAudio(vol, ms) {
    if (audioRaf) cancelAnimationFrame(audioRaf);
    if (!ambAudio) return;
    const s0 = ambAudio.volume, t0 = performance.now();
    const step = now => { const t = Math.min((now - t0) / ms, 1); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; ambAudio.volume = s0 + (vol - s0) * e; if (t < 1) audioRaf = requestAnimationFrame(step); };
    audioRaf = requestAnimationFrame(step);
}
sndBtn && sndBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    icnMuted && icnMuted.classList.toggle('hidden', soundOn);
    icnSound && icnSound.classList.toggle('hidden', !soundOn);
    if (soundOn) { if (ambAudio) { ambAudio.muted = false; ambAudio.play().catch(() => { }); setTimeout(() => fadeAudio(0.06, 3000), 100); } }
    else { fadeAudio(0, 1400); setTimeout(() => { if (ambAudio) { ambAudio.muted = true; ambAudio.pause(); } }, 1500); }
});

/* ── Story State ── */
const STORY_CONFIG = {
    cardCount: 8,
    radius: 1200,
    spread: 0.25,
    floatAmp: 20,
    floatFreq: 0.001,
    parallaxAmp: 40,
    zoomScale: 1.15
};
const storyCards = $$('.story-card');
const storyAshCvs = $('story-ash-canvas');
const secStory = $('s-story');
let storyRotX = 0;
let storyDragX = 0;
let isStoryDragging = false;
let storyStartX = 0;

if (secStory) {
    secStory.addEventListener('mousedown', e => {
        isStoryDragging = true;
        storyStartX = e.clientX;
    });
    window.addEventListener('mousemove', e => {
        if (!isStoryDragging) return;
        const delta = e.clientX - storyStartX;
        storyDragX += delta * 0.001;
        storyStartX = e.clientX;
    });
    window.addEventListener('mouseup', () => { isStoryDragging = false; });

    // Touch support
    secStory.addEventListener('touchstart', e => {
        isStoryDragging = true;
        storyStartX = e.touches[0].clientX;
    }, { passive: true });
    window.addEventListener('touchmove', e => {
        if (!isStoryDragging) return;
        const delta = e.touches[0].clientX - storyStartX;
        storyDragX += delta * 0.001;
        storyStartX = e.touches[0].clientX;
    }, { passive: true });
    window.addEventListener('touchend', () => { isStoryDragging = false; });
}

/* ════════════════════════════════════════
   STORY ASH PARTICLES
   ════════════════════════════════════════ */
(function () {
    if (!storyAshCvs) return;
    const ctx = storyAshCvs.getContext('2d');
    let width, height;
    const particles = Array.from({ length: 120 }, () => ({
        x: Math.random(), y: Math.random(), z: Math.random(),
        size: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.001,
        vy: Math.random() * 0.002 + 0.001,
        opacity: Math.random() * 0.4 + 0.1
    }));
    const resize = () => {
        width = storyAshCvs.width = window.innerWidth;
        height = storyAshCvs.height = window.innerHeight;
    };
    const draw = () => {
        if (!inView(secStory)) { requestAnimationFrame(draw); return; }
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x > 1) p.x = 0; if (p.x < 0) p.x = 1; if (p.y > 1) p.y = 0;
            const x = p.x * width; const y = p.y * height;
            const s = p.size * (1 - p.z * 0.5);
            ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(237, 235, 230, ${p.opacity})`; ctx.fill();
        });
        requestAnimationFrame(draw);
    };
    window.addEventListener('resize', resize, { passive: true });
    resize(); draw();
})();

/* ════════════════════════════════════════
   STORY CARD ANIMATION
   ════════════════════════════════════════ */
function updateStoryCards(sy) {
    if (!secStory || !storyCards.length) return;
    const r = secStory.getBoundingClientRect();
    const vh = window.innerHeight;

    // Calculate progress through the section (0 to 1)
    const start = sy + r.top;
    const end = start + r.height - vh;
    let prog = clamp((sy - start) / (end - start), 0, 1);

    // Map progress to rotation + any manual drag offset
    const rotTarget = (prog - 0.5) * 2.0 + storyDragX;
    storyRotX = lerp(storyRotX, rotTarget, 0.1);

    const time = Date.now() * STORY_CONFIG.floatFreq;

    storyCards.forEach((card, i) => {
        const baseAngle = ((i - (STORY_CONFIG.cardCount - 1) / 2) / STORY_CONFIG.cardCount) * Math.PI * STORY_CONFIG.spread;
        const angle = baseAngle + storyRotX;

        const x = Math.sin(angle) * STORY_CONFIG.radius;
        const z = (Math.cos(angle) - 1) * STORY_CONFIG.radius;
        const rotationY = angle * (180 / Math.PI);
        const floatY = Math.sin(time + i) * STORY_CONFIG.floatAmp;

        const px = (mx - 0.5) * STORY_CONFIG.parallaxAmp * (1 + (z / STORY_CONFIG.radius));
        const py = (my - 0.5) * STORY_CONFIG.parallaxAmp * (1 + (z / STORY_CONFIG.radius));

        // Active detection
        let normAngle = angle % (Math.PI * 2);
        if (normAngle > Math.PI) normAngle -= Math.PI * 2;
        if (normAngle < -Math.PI) normAngle += Math.PI * 2;

        const isCenter = Math.abs(normAngle) < 0.15;
        if (isCenter) {
            if (!card.classList.contains('active')) {
                card.classList.add('active');
                if (i === 3 && card.dataset.triggered !== 'true') {
                    const flash = document.createElement('div');
                    flash.className = 'steel-flash';
                    card.querySelector('.story-card-inner').appendChild(flash);
                    card.dataset.triggered = 'true';
                    setTimeout(() => flash.remove(), 1000);
                }
                if (i === 5 && card.dataset.triggered !== 'true') {
                    card.classList.add('crack-animation');
                    card.dataset.triggered = 'true';
                    setTimeout(() => card.classList.remove('crack-animation'), 3000);
                }
            }
        } else {
            card.classList.remove('active');
            card.dataset.triggered = '';
        }

        card.style.transform = `
            translateX(${x + px}px) 
            translateY(${floatY + py}px) 
            translateZ(${z}px) 
            rotateY(${-rotationY}deg)
            scale(${isCenter ? STORY_CONFIG.zoomScale : 1})
        `;

        const opacity = Math.max(0.1, 1 + (z / STORY_CONFIG.radius) * 1.5);
        card.style.opacity = opacity.toFixed(3);
    });
}

/* ════════════════════════════════════════
   MAIN RAF LOOP
   ════════════════════════════════════════ */
function tick() {
    if (!reduced) { curY = lerp(curY, tgtY, INERTIA); if (Math.abs(curY - tgtY) < 0.08) curY = tgtY; } else curY = tgtY;
    const vel = curY - prevY; prevY = curY;
    updateIndicator(curY);
    updateSlices(curY);
    updateStoryCards(curY);
    updateExpand();
    updateEye();
    updateFinal();
    updateAmbient(vel);
    runRevealQueue();
    requestAnimationFrame(tick);
}

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
function init() {
    if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }
    window.scrollTo(0, 0);
    curY = tgtY = prevY = 0;
    if (sliceReveal) sliceReveal.style.opacity = '0';
    buildRevealQueue();
    tick();
}

/* ════════════════════════════════════════
   INTERACTIVE FLIP GRID
   ════════════════════════════════════════ */
function initGridFlip() {
    const expandBg = document.getElementById('expand-bg');
    if (!expandBg) return;

    const cols = 9;
    const rows = 7;
    const totalBoxes = cols * rows;
    let isReversing = false;
    let flippedCount = 0;
    let isLocked = false;
    const boxes = [];

    const overlay = expandBg.querySelector('.expand-overlay');

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const box = document.createElement('div');
            box.className = 'flip-box';

            const front = document.createElement('div');
            front.className = 'flip-face flip-face--front';
            
            const posX = cols > 1 ? (c / (cols - 1)) * 100 : 0;
            const posY = rows > 1 ? (r / (rows - 1)) * 100 : 0;

            front.style.backgroundPosition = `${posX}% ${posY}%`;

            box.appendChild(front);

            if (overlay) {
                expandBg.insertBefore(box, overlay);
            } else {
                expandBg.appendChild(box);
            }

            boxes.push(box);

            box.addEventListener('mouseenter', () => {
                if (isLocked) return;

                box.style.transform = "translateY(-5px) translateX(" + (Math.random() * 20 - 10) + "px) rotateZ(" + (Math.random() * 30 - 15) + "deg)";

                if (!isReversing) {
                    if (!box.classList.contains('is-falling')) {
                        box.classList.add('is-falling');
                        flippedCount++;
                        checkComplete();
                    }
                } else {
                    if (!box.classList.contains('is-rising')) {
                        box.classList.add('is-rising');
                        flippedCount++;
                        checkComplete();
                    }
                }
            });
        }
    }

    function checkComplete() {
        if (flippedCount / totalBoxes >= 0.95) {
            isLocked = true;
            
            if (!isReversing) {
                const unflipped = boxes.filter(b => !b.classList.contains('is-falling'));
                unflipped.forEach((b, i) => {
                    setTimeout(() => {
                        b.style.transform = "translateY(-5px) translateX(" + (Math.random() * 20 - 10) + "px) rotateZ(" + (Math.random() * 30 - 15) + "deg)";
                        b.classList.add('is-falling');
                    }, i * 50);
                });
                
                setTimeout(() => {
                    isReversing = true;
                    flippedCount = 0;
                    boxes.forEach(b => {
                        b.style.transform = '';
                        b.classList.remove('is-falling');
                    });
                    setTimeout(() => { isLocked = false; }, 800);
                }, unflipped.length * 50 + 800);
            } else {
                const unflipped = boxes.filter(b => !b.classList.contains('is-rising'));
                unflipped.forEach((b, i) => {
                    setTimeout(() => {
                        b.style.transform = "translateY(-5px) translateX(" + (Math.random() * 20 - 10) + "px) rotateZ(" + (Math.random() * 30 - 15) + "deg)";
                        b.classList.add('is-rising');
                    }, i * 50);
                });
                
                setTimeout(() => {
                    isReversing = false;
                    flippedCount = 0;
                    boxes.forEach(b => {
                        b.style.transform = '';
                        b.classList.remove('is-rising');
                    });
                    setTimeout(() => { isLocked = false; }, 800);
                }, unflipped.length * 50 + 800);
            }
        }
    }
}

function initEyeAnimation() {
    const eyeContainer = document.querySelector('.eye-container');
    const eyeVideo = document.querySelector('.eye-video');

    if (eyeContainer && eyeVideo) {
        eyeContainer.addEventListener('mouseenter', () => {
            eyeContainer.classList.add('is-active');
            eyeVideo.currentTime = 0;
            eyeVideo.play();
        });

        eyeContainer.addEventListener('mouseleave', () => {
            eyeContainer.classList.remove('is-active');
            eyeVideo.pause();
        });
    }
}

window.addEventListener('resize', () => { reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches; }, { passive: true });
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => { init(); initGridFlip(); initEyeAnimation(); }) : (init(), initGridFlip(), initEyeAnimation());
