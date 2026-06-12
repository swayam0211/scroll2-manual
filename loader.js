/**
 * ZEN-TECH LOADER — 2D Rotating Card Loading Screen
 *
 * Architecture:
 *  - 16 dots at 60px radius, equally spaced
 *  - 8 sumi-e ink cards at 200px radius
 *  - Sequential progress 0→100%
 *  - Every 6.25% → next dot lights up
 *  - Every 12.5% → next card fades in + floats into position
 *  - Subtle gallery orbit rotation (0→18deg) over full progress
 *  - On complete: pause, then dissolve loader to reveal main site
 */

'use strict';

(function ZenLoader() {

    /* ── Config ── */
    const DOT_COUNT = 16;
    const CARD_COUNT = 8;
    const DOT_RADIUS = 60;   // px from center
    const CARD_RADIUS = 190;  // px from center
    const LOAD_DURATION = 4200; // ms for full 0→100%
    const ORBIT_TOTAL = 18;  // degrees of gallery rotation
    const CARD_IMAGES = [
        'loding page/load1.png',
        'loding page/load2.png',
        'loding page/load3.png',
        'loding page/load4.png',
        'loding page/load5.png',
        'loding page/load6.png',
        'loding page/load7.png',
        'loding page/load8.png',
    ];

    /* ── DOM ── */
    const loader = document.getElementById('zen-loader');
    const dotsWrap = document.getElementById('zen-dots');
    const gallery = document.getElementById('zen-gallery');
    const barEl = document.getElementById('zen-bar');
    const pctEl = document.getElementById('zen-pct');
    const grainCvs = document.getElementById('zen-grain');
    const kanjiEl = document.querySelector('.zen-kanji');
    const brandEl = document.querySelector('.zen-brand');
    const taglineEl = document.querySelector('.zen-tagline');

    if (!loader) return;

    // Lock body scroll during loading
    document.body.classList.add('loading');

    /* ── Responsive radius ── */
    function getRadii() {
        const w = window.innerWidth;
        if (w <= 400) return { dot: 38, card: 115 };
        if (w <= 600) return { dot: 48, card: 140 };
        return { dot: DOT_RADIUS, card: CARD_RADIUS };
    }

    /* ── Build 16 Dots ── */
    const dots = [];
    function buildDots() {
        const { dot: r } = getRadii();
        for (let i = 0; i < DOT_COUNT; i++) {
            const angle = (i / DOT_COUNT) * Math.PI * 2 - Math.PI / 2; // start from top
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);

            const el = document.createElement('div');
            el.className = 'zen-dot';
            el.style.marginLeft = x + 'px';
            el.style.marginTop = y + 'px';
            dotsWrap.appendChild(el);
            dots.push(el);
        }
    }

    /* ── Build 8 Cards ── */
    const cards = [];
    function buildCards() {
        const { card: r } = getRadii();
        for (let i = 0; i < CARD_COUNT; i++) {
            const angle = (i / CARD_COUNT) * Math.PI * 2 - Math.PI / 2;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);

            const el = document.createElement('div');
            el.className = 'zen-card';
            el.style.marginLeft = x + 'px';
            el.style.marginTop = y + 'px';

            // Staggered float-in delay per card (50ms base + 120ms per card)
            el.style.transitionDelay = (0.05 + i * 0.12) + 's';

            const img = document.createElement('img');
            img.src = CARD_IMAGES[i];
            img.alt = `Ink artwork ${i + 1}`;
            img.loading = 'eager';
            img.draggable = false;

            el.appendChild(img);
            gallery.appendChild(el);
            cards.push(el);
        }
    }

    /* ── Grain Noise ── */
    function initGrain() {
        const landingGrain = document.getElementById('landing-grain');
        const canvases = [grainCvs, landingGrain].filter(Boolean);

        canvases.forEach(cvs => {
            const ctx = cvs.getContext('2d');
            let gw = 0, gh = 0, frame = 0;

            function resize() {
                gw = cvs.width = window.innerWidth;
                gh = cvs.height = window.innerHeight;
            }

            function draw() {
                if (++frame % 3 === 0) {
                    const id = ctx.createImageData(gw, gh);
                    const d = id.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const v = (Math.random() * 255) | 0;
                        d[i] = d[i + 1] = d[i + 2] = v;
                        d[i + 3] = 12;
                    }
                    ctx.putImageData(id, 0, 0);
                }
                if (loader && !loader.classList.contains('done')) {
                    requestAnimationFrame(draw);
                }
            }

            window.addEventListener('resize', resize, { passive: true });
            resize();
            draw();
        });
    }

    /* ── Progress Simulation ── */
    function runProgress() {
        const startTime = performance.now();
        let lastDot = -1;
        let lastCard = -1;
        let kanjiRevealed = false;

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / LOAD_DURATION, 1);
            const pct = Math.round(progress * 100);

            // Update progress bar
            if (barEl) barEl.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct;

            // Dot trigger: every 6.25% (1/16)
            const dotIndex = Math.min(Math.floor(progress * DOT_COUNT), DOT_COUNT - 1);
            if (dotIndex > lastDot) {
                for (let i = lastDot + 1; i <= dotIndex; i++) {
                    dots[i].classList.add('lit');
                }
                lastDot = dotIndex;
            }

            // Card trigger: every 12.5% (1/8)
            const cardIndex = Math.min(Math.floor(progress * CARD_COUNT), CARD_COUNT - 1);
            if (cardIndex > lastCard) {
                for (let i = lastCard + 1; i <= cardIndex; i++) {
                    cards[i].classList.add('visible');
                }
                lastCard = cardIndex;
            }

            // Gallery orbit rotation
            const orbDeg = progress * ORBIT_TOTAL;
            if (gallery) gallery.style.transform = `rotate(${orbDeg.toFixed(2)}deg)`;

            // Kanji reveal at 40%
            if (progress > 0.40 && !kanjiRevealed) {
                kanjiRevealed = true;
                if (kanjiEl) kanjiEl.classList.add('reveal');
                if (brandEl) brandEl.classList.add('reveal');
                if (taglineEl) taglineEl.classList.add('reveal');
            }

            // Continue or finish
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                // Hold for a moment then dissolve
                setTimeout(dissolve, 900);
            }
        }

        requestAnimationFrame(step);
    }

    /* ── Dissolve and Reveal Main Site ── */
    function dissolve() {
        if (!loader) return;
        loader.classList.add('done');

        // Remove from DOM after transition
        setTimeout(() => {
            loader.remove();
        }, 1400);

        // TRIGGER CLOUD REVEAL
        const cloudReveal = document.getElementById('cloud-reveal');
        if (cloudReveal) {
            // 1.2s delay as requested before split
            setTimeout(() => {
                cloudReveal.classList.add('split');

                // Once clouds start splitting, allow body scrolling
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.body.classList.remove('loading');
                if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();

            }, 1200);
        } else {
            // Fallback if no cloud reveal
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            document.body.classList.remove('loading');
            if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        }
    }

    /* ── Cloud Dust ── */
    function initCloudDust() {
        const cvs = document.getElementById('cloud-dust');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        let w, h;
        const parts = Array.from({ length: 60 }, () => ({
            x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.5,
            vx: (Math.random() - 0.5) * 0.0004, vy: -(Math.random() * 0.0008 + 0.0002), a: Math.random() * 0.5 + 0.1
        }));

        function resize() {
            w = cvs.width = window.innerWidth;
            h = cvs.height = window.innerHeight;
        }

        function draw() {
            if (!cvs.offsetParent) {
                requestAnimationFrame(draw);
                return;
            }
            ctx.clearRect(0, 0, w, h);
            parts.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0; if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
                ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,200,210,${p.a})`; ctx.fill();
            });
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize, { passive: true });
        resize();
        draw();
    }

    /* ── Initialize ── */
    function init() {
        buildDots();
        buildCards();
        initGrain();
        initCloudDust();

        const enterBtn = document.getElementById('enter-btn');
        const landingPage = document.getElementById('landing-page');

        if (enterBtn && landingPage) {
            enterBtn.addEventListener('click', () => {
                // Fade out landing page
                landingPage.classList.add('fade-out');

                // Wait for fade to finish (800ms) before starting loader
                setTimeout(() => {
                    runProgress();
                }, 800);
            });
        } else {
            // Fallback: start loader directly
            setTimeout(runProgress, 300);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
