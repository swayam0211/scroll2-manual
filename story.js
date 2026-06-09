/**
 * STORY EXPERIENCE — Cinematic 3D Interactions
 * Logic for curved layout, floating animations, and parallax.
 */

'use strict';

const CONFIG = {
    cardCount: 8,
    radius: 1200,      // Radius of the horizontal curve
    spread: 0.25,      // Spread of cards along the arc
    floatAmp: 20,      // Floating amplitude in px
    floatFreq: 0.001,  // Floating frequency
    parallaxAmp: 40,   // Max parallax offset
    zoomScale: 1.15    // Active card zoom
};

/* ── State ── */
let targetRotation = 0;
let currentRotation = 0;
let mouseX = 0;
let mouseY = 0;
let isDragging = false;
let startX = 0;

/* ── DOM ── */
const viewport = document.getElementById('story-viewport');
const wrapper = document.getElementById('cards-wrapper');
const cards = document.querySelectorAll('.card');
const ashCanvas = document.getElementById('ash-canvas');

/* ── Initialize ── */
function init() {
    setupEnvironment();
    setupCards();
    setupEvents();
    animate();
}

/**
 * Setup Environment (Ash Particles)
 */
function setupEnvironment() {
    if (!ashCanvas) return;
    const ctx = ashCanvas.getContext('2d');
    let width, height;

    const particles = Array.from({ length: 150 }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        size: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.001,
        vy: Math.random() * 0.002 + 0.001,
        opacity: Math.random() * 0.5 + 0.1
    }));

    const resize = () => {
        width = ashCanvas.width = window.innerWidth;
        height = ashCanvas.height = window.innerHeight;
    };

    const draw = () => {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x > 1) p.x = 0;
            if (p.x < 0) p.x = 1;
            if (p.y > 1) p.y = 0;

            const x = p.x * width;
            const y = p.y * height;
            const s = p.size * (1 - p.z * 0.5);

            ctx.beginPath();
            ctx.arc(x, y, s, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(237, 235, 230, ${p.opacity})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();
}

/**
 * Initial card positioning on a curve
 */
function setupCards() {
    cards.forEach((card, i) => {
        // Calculate the angular position on the arc
        const ratio = (i - (CONFIG.cardCount - 1) / 2) / CONFIG.cardCount;
        const angle = ratio * Math.PI * CONFIG.spread;

        // Initial 3D transform attributes
        card.dataset.angle = angle;
    });

    updateCards(0);
}

/**
 * Main Update Loop for Cards
 */
function updateCards(rotOffset) {
    const time = Date.now() * CONFIG.floatFreq;

    cards.forEach((card, i) => {
        const baseAngle = parseFloat(card.dataset.angle);
        const angle = baseAngle + rotOffset;

        // Calculate 3D position on horizontal circle
        const x = Math.sin(angle) * CONFIG.radius;
        const z = (Math.cos(angle) - 1) * CONFIG.radius;
        const rotationY = angle * (180 / Math.PI); // Convert to degrees

        // Add subtle floating motion
        const floatY = Math.sin(time + i) * CONFIG.floatAmp;

        // Parallax depth based on mouse
        // We multiply by (1 + z/radius) to make foreground cards react more
        const px = (mouseX - 0.5) * CONFIG.parallaxAmp * (1 + (z / CONFIG.radius));
        const py = (mouseY - 0.5) * CONFIG.parallaxAmp * (1 + (z / CONFIG.radius));

        // Interaction for "Active" card (the one closest to the front)
        // Normalize angle to [-PI, PI] to check proximity to 0
        let normAngle = angle % (Math.PI * 2);
        if (normAngle > Math.PI) normAngle -= Math.PI * 2;
        if (normAngle < -Math.PI) normAngle += Math.PI * 2;

        const isCenter = Math.abs(normAngle) < 0.15;
        if (isCenter) {
            if (!card.classList.contains('active')) {
                card.classList.add('active');
                handleSpecialInteractions(card, i);
            }
        } else {
            card.classList.remove('active');
            card.dataset.triggered = ""; // Reset trigger when not active
        }

        // Apply transforms
        card.style.transform = `
            translateX(${x + px}px) 
            translateY(${floatY + py}px) 
            translateZ(${z}px) 
            rotateY(${-rotationY}deg)
            scale(${isCenter ? CONFIG.zoomScale : 1})
        `;

        // Adjust opacity based on Z depth
        const opacity = Math.max(0.1, 1 + (z / CONFIG.radius) * 1.5);
        card.style.opacity = opacity.toFixed(3);
    });
}

/**
 * Handle card-specific special animations
 */
function handleSpecialInteractions(card, index) {
    // Card 4: Fire and Steel
    if (index === 3) {
        if (card.dataset.triggered !== "true") {
            triggerSteelFlash(card);
            card.dataset.triggered = "true";
        }
    }
    // Card 6: Breaking of Fear
    if (index === 5) {
        if (card.dataset.triggered !== "true") {
            triggerSkyCrack(card);
            card.dataset.triggered = "true";
        }
    }
}

function triggerSteelFlash(card) {
    const flash = document.createElement('div');
    flash.className = 'steel-flash';
    card.querySelector('.card-inner').appendChild(flash);
    setTimeout(() => flash.remove(), 1000);
}

function triggerSkyCrack(card) {
    card.classList.add('crack-animation');
    setTimeout(() => card.classList.remove('crack-animation'), 3000);
}

/**
 * Event Listeners
 */
function setupEvents() {
    // Mouse movement for parallax
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX / window.innerWidth;
        mouseY = e.clientY / window.innerHeight;
    });

    // Scroll/Wheel to rotate the arc
    window.addEventListener('wheel', e => {
        targetRotation -= e.deltaY * 0.0005;
    });

    // Drag interaction
    window.addEventListener('mousedown', e => {
        isDragging = true;
        startX = e.clientX;
    });

    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        const delta = e.clientX - startX;
        targetRotation += delta * 0.001;
        startX = e.clientX;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch events
    window.addEventListener('touchstart', e => {
        isDragging = true;
        startX = e.touches[0].clientX;
    });

    window.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const delta = e.touches[0].clientX - startX;
        targetRotation += delta * 0.001;
        startX = e.touches[0].clientX;
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });
}

/**
 * Animation Loop
 */
function animate() {
    // Smoothly lerp towards target rotation
    currentRotation += (targetRotation - currentRotation) * 0.1;

    updateCards(currentRotation);
    requestAnimationFrame(animate);
}

// Start the experience
window.addEventListener('DOMContentLoaded', init);
