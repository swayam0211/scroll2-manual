// visits.js — AAA Spatial Storytelling Engine

document.addEventListener("DOMContentLoaded", () => {

    // ─── 1. DOM REFERENCES (matching exact IDs from index.html) ───
    const enterBtn = document.getElementById('enter-act-iv-btn');
    const returnBtn = document.getElementById('return-btn');
    const uiWrapper = document.getElementById('ui-wrapper');
    const bgLayer = document.querySelector('.final-bg-layer');
    const webglCanvas = document.getElementById('webgl-canvas');

    // Guard: abort if required elements are missing
    if (!enterBtn || !webglCanvas || !uiWrapper) {
        console.error('[visits.js] Required DOM elements not found. Aborting.');
        return;
    }

    // ─── 2. THREE.JS RENDERER ───
    // Attach renderer to the existing <canvas id="webgl-canvas"> directly
    const renderer = new THREE.WebGLRenderer({
        canvas: webglCanvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 0, 0);
    camera.rotation.order = "YXZ";

    // ─── 3. TEXTURE LOADER HELPER ───
    const textureLoader = new THREE.TextureLoader();

    function loadTexture(url) {
        return textureLoader.load(
            url,
            (tex) => {
                // Apply correct color space
                if (typeof THREE.SRGBColorSpace !== 'undefined') {
                    tex.colorSpace = THREE.SRGBColorSpace;
                } else {
                    tex.encoding = THREE.sRGBEncoding;
                }
                tex.needsUpdate = true;
            },
            undefined,
            (err) => { console.error('[visits.js] Failed to load texture:', url, err); }
        );
    }

    // ─── 4. ENVIRONMENT (360° SPHERE) ───
    const envTexture = loadTexture('upgrade/360 1.webp');
    // Sphere starts invisible — fades in synchronized with the particle entry animation
    const sphereMaterial = new THREE.MeshBasicMaterial({ map: envTexture, side: THREE.BackSide, transparent: true, opacity: 0 });
    const sphereMesh = new THREE.Mesh(
        new THREE.SphereGeometry(500, 60, 40),
        sphereMaterial
    );
    scene.add(sphereMesh);

    // ─── 5. LORE RELICS ───
    const relicData = [
        { pos: [-189.17, 229.89, -426.03, 2], icon: 'assets/relics/1.png', card: 'upgrade/1.png' },
        { pos: [187.25, -165.10, -410.05, 1.5], icon: 'assets/relics/2.png', card: 'upgrade/2.png' },
        { pos: [478.40, 99.25, 133.26, 1.5], icon: 'assets/relics/3.png', card: 'upgrade/3.png' },
        { pos: [-133.92, -169.30, 428.37, 2], icon: 'assets/relics/4.png', card: 'upgrade/4.png' },
        { pos: [407.21, -85.55, 254.67, 2], icon: 'assets/relics/5.png', card: 'upgrade/5.png' }
    ];

    const relicMeshes = [];

    relicData.forEach(data => {
        const iconTex = loadTexture(data.icon);
        const cardTex = loadTexture(data.card);

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(80, 107),
            new THREE.MeshBasicMaterial({ map: iconTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
        );
        mesh.position.set(data.pos[0], data.pos[1], data.pos[2]).multiplyScalar(0.90);
        mesh.lookAt(camera.position);

        const initialScale = data.pos[3] || 1;
        mesh.scale.set(initialScale, initialScale, initialScale);

        mesh.userData = {
            iconTex, cardTex,
            isFlipped: false,
            originalPos: mesh.position.clone(),
            originalScale: initialScale
        };

        scene.add(mesh);
        relicMeshes.push(mesh);
    });

    // ─── 6. WARP TUNNEL PARTICLES (GALAXY UPGRADE) ───
    function createGalaxyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        // Create a smooth, faded radial glow
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 80, 0.3)'); // Soft cosmic crimson bleed
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Fades perfectly to transparent

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);

        return new THREE.CanvasTexture(canvas);
    }

    const pCount = 2000;
    const pPositions = new Float32Array(pCount * 3);
    const pColors = new Float32Array(pCount * 3);

    const palette = [
        new THREE.Color('#ff1a40'), // Crimson/Reddish-Blue
        new THREE.Color('#ffffff'), // Crisp White
        new THREE.Color('#4d1eff'), // Deep Purple-Blue
        new THREE.Color('#00bfff')  // Vibrant Cyan-Blue
    ];

    for (let i = 0; i < pCount; i++) {
        // Cosmic Swirl Shape
        const z = -Math.random() * 800; // Deep into Z
        const swirlFactor = z * 0.005; // The further back, the more it twists
        const angle = Math.random() * Math.PI * 2 + swirlFactor;

        // Create a vortex by organically expanding the radius and layering density
        const radius = 20 + Math.pow(Math.random(), 1.5) * (200 + Math.abs(z) * 0.1);

        pPositions[i * 3] = Math.cos(angle) * radius;
        pPositions[i * 3 + 1] = Math.sin(angle) * radius;
        pPositions[i * 3 + 2] = z;

        const color = palette[Math.floor(Math.random() * palette.length)];
        pColors[i * 3] = color.r;
        pColors[i * 3 + 1] = color.g;
        pColors[i * 3 + 2] = color.b;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const pMat = new THREE.PointsMaterial({
        size: 6,
        map: createGalaxyTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,  // Fixes black box clipping bug
        depthTest: false    // Forces render OVER the 360 sphere
    });
    const particles = new THREE.Points(pGeo, pMat);
    particles.renderOrder = 999; // Guarantees particles draw last, on top of everything
    scene.add(particles);

    // ─── 7. RAYCASTER (RELIC CLICK) ───
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('click', (e) => {
        // Only process clicks when the canvas is active
        if (webglCanvas.style.pointerEvents === 'none' || !webglCanvas.style.opacity || parseFloat(webglCanvas.style.opacity) < 0.5) return;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(relicMeshes);
        if (!hits.length) return;

        const mesh = hits[0].object;
        const ud = mesh.userData;
        if (gsap.isTweening(mesh.rotation)) return;

        if (!ud.isFlipped) {
            gsap.to(mesh.rotation, {
                y: mesh.rotation.y + Math.PI * 12, duration: 1.8, ease: "power2.inOut",
                onUpdate() { if (this.progress() >= 0.5 && mesh.material.map !== ud.cardTex) mesh.material.map = ud.cardTex; }
            });
            const tp = mesh.position.clone().lerp(camera.position, 0.4);
            gsap.to(mesh.position, { x: tp.x, y: tp.y, z: tp.z, duration: 1.8, ease: "power2.inOut" });
            gsap.to(mesh.scale, { x: 2.5, y: 2.5, z: 2.5, duration: 1.8, ease: "power2.inOut" });
        } else {
            gsap.to(mesh.rotation, {
                y: mesh.rotation.y - Math.PI * 12, duration: 1.8, ease: "power2.inOut",
                onUpdate() { if (this.progress() >= 0.5 && mesh.material.map !== ud.iconTex) mesh.material.map = ud.iconTex; }
            });
            gsap.to(mesh.position, { x: ud.originalPos.x, y: ud.originalPos.y, z: ud.originalPos.z, duration: 1.8, ease: "power2.inOut" });
            gsap.to(mesh.scale, { x: ud.originalScale, y: ud.originalScale, z: ud.originalScale, duration: 1.8, ease: "power2.inOut" });
        }
        ud.isFlipped = !ud.isFlipped;
    });

    // ─── 8. MOUSE LOOK & SCROLL ZOOM ───
    window.addEventListener('mousemove', (event) => {
        if (parseFloat(webglCanvas.style.opacity || 0) < 0.5) return;

        const normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
        const normalizedY = -(event.clientY / window.innerHeight) * 2 + 1;

        const targetRotationY = normalizedX * -Math.PI; // Full left/right pan
        const targetRotationX = normalizedY * (Math.PI / 4); // Clamped up/down tilt

        gsap.to(camera.rotation, { y: targetRotationY, x: targetRotationX, duration: 1, ease: "power2.out" });
    });

    document.addEventListener('wheel', (e) => {
        if (parseFloat(webglCanvas.style.opacity || 0) < 0.5) return;
        const fov = Math.max(45, Math.min(75, camera.fov + e.deltaY * 0.05));
        gsap.to(camera, { fov, duration: 0.5, onUpdate: () => camera.updateProjectionMatrix() });
    });

    // ─── 9. ANIMATION LOOP ───
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ==========================================
    // 🛠️ PRO-TIP: 3D COORDINATE FINDER 
    // ==========================================
    const helperRaycaster = new THREE.Raycaster();
    const helperMouse = new THREE.Vector2();

    window.addEventListener('dblclick', (event) => {
        // Only run if the 3D scene is active and visible
        if (webglCanvas.style.pointerEvents === 'none' || parseFloat(webglCanvas.style.opacity || 0) < 0.5) return;

        // 1. Calculate mouse position in normalized coordinates (-1 to +1)
        helperMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        helperMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // 2. Shoot the ray from the camera
        helperRaycaster.setFromCamera(helperMouse, camera);

        // 3. Check where it hits the 360 background sphere (sphereMesh)
        const intersects = helperRaycaster.intersectObject(sphereMesh);

        if (intersects.length > 0) {
            const point = intersects[0].point;

            // 4. Format the numbers nicely
            const exactX = point.x.toFixed(2);
            const exactY = point.y.toFixed(2);
            const exactZ = point.z.toFixed(2);

            // 5. Print to console with a bright color so it's easy to see
            console.log(`%c📍 PLACEMENT COORDINATES: [${exactX}, ${exactY}, ${exactZ}]`, 'color: #00ffcc; font-weight: bold; font-size: 14px;');
        }
    });
    // ==========================================

    // ─── 10. WARP TRANSITIONS ───
    // NOTE: GSAP does NOT touch #ui-wrapper or #webgl-canvas on page load.
    // Everything starts at its natural CSS state (ui-wrapper: opacity 1, canvas: opacity 0).

    enterBtn.addEventListener('click', () => {
        // Lock document scrolling
        document.body.style.overflow = 'hidden';

        // Fade out: background layer + ui wrapper
        gsap.to([bgLayer, uiWrapper], { opacity: 0, duration: 0.8, pointerEvents: 'none' });

        // Fade in: 3D canvas — force full viewport dimensions immediately
        gsap.to(webglCanvas, {
            opacity: 1,
            duration: 0.8,
            onStart() {
                webglCanvas.style.pointerEvents = 'auto';
                renderer.setSize(window.innerWidth, window.innerHeight);
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                // Hard reset: make mesh visible, force opacity to 0 — guarantees clean 0→1 on every entry
                sphereMesh.visible = true;
                sphereMaterial.opacity = 0;
                relicMeshes.forEach(m => { m.material.opacity = 0; });
            }
        });

        // ── SYNCHRONIZED ENTRY SEQUENCE ──
        const WARP_DURATION = 2.5;

        // 1. Fire the particle warp tunnel
        pMat.opacity = 1;
        particles.position.z = 0;
        gsap.to(particles.position, {
            z: 800,
            duration: WARP_DURATION,
            ease: "power3.in",
            onComplete() {
                // Fade out particles once they've passed
                gsap.to(pMat, { opacity: 0, duration: 0.5 });
                returnBtn.style.display = 'block';
                gsap.fromTo(returnBtn, { opacity: 0 }, { opacity: 1, duration: 0.5 });
            }
        });

        // 2. Simultaneously fade the 360 sphere FROM 0 TO 1, completing at the EXACT same moment
        gsap.to(sphereMaterial, {
            opacity: 1,
            duration: WARP_DURATION, // Matches particle duration exactly
            ease: "power2.in"
        });

        // 3. Characters fade from 0 to 1, starting when Sphere reaches 95% opacity
        gsap.to(relicMeshes.map(m => m.material), {
            opacity: 1,
            duration: 0.5,
            delay: WARP_DURATION * 0.95
        });
    });

    returnBtn.addEventListener('click', () => {
        // Hide return button
        gsap.to(returnBtn, {
            opacity: 0, duration: 0.4,
            onComplete() { returnBtn.style.display = 'none'; }
        });

        // 1. Instantly snap the 5 Characters to opacity: 0
        relicMeshes.forEach(mesh => {
            gsap.set(mesh.material, { opacity: 0 });
        });

        // 2. Fade out the 360 sphere background over 0.8s
        gsap.to(sphereMesh.material, { opacity: 0, duration: 0.8 });

        // 3. Turn on the particle system and blast them AWAY from the camera
        pMat.opacity = 1;
        particles.position.z = 800; // Start behind the camera so they fly into the distance

        gsap.to(particles.position, {
            z: 0,
            duration: 1.5,
            ease: "power3.out",
            onComplete() {
                pMat.opacity = 0;

                // 4. Restore document scrolling
                document.body.style.overflow = '';

                // Fade out canvas
                gsap.to(webglCanvas, {
                    opacity: 0, duration: 0.8,
                    onComplete() { webglCanvas.style.pointerEvents = 'none'; }
                });

                // Fade in original layers
                gsap.to([bgLayer, uiWrapper], { opacity: 1, duration: 0.8, pointerEvents: 'auto' });
                // Hide sphere entirely — forward entry will re-enable and fade from 0
                sphereMesh.visible = false;
            }
        });
    });
});
