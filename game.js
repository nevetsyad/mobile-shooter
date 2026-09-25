// ============================================================
// 3D MOBILE SHOOTER - Phase 1: Foundation
// Core: Three.js scene, arena, player controller, HUD
// ============================================================

(function() {
    'use strict';

    // ---- Game State ----
    const STATE = {
        MENU: 'menu',
        PLAYING: 'playing',
        GAME_OVER: 'game_over',
        PAUSED: 'paused'
    };

    let gameState = STATE.MENU;
    let scene, camera, renderer, controls;
    let player, arena;
    let clock;

    // Player stats
    const PLAYER = {
        health: 100,
        maxHealth: 100,
        speed: 10,
        score: 0,
        wave: 1
    };

    // Input
    const keys = {};
    let mouseX = 0, mouseY = 0;

    // ---- DOM Elements ----
    const dom = {
        container: document.getElementById('game-container'),
        startScreen: document.getElementById('start-screen'),
        gameOver: document.getElementById('game-over'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn'),
        healthValue: document.getElementById('health-value'),
        healthBar: document.getElementById('health-bar'),
        scoreValue: document.getElementById('score-value'),
        waveValue: document.getElementById('wave-value'),
        ammoValue: document.getElementById('ammo-value'),
        ammoBar: document.getElementById('ammo-bar'),
        crosshair: document.getElementById('crosshair'),
        touchControls: document.getElementById('touch-controls'),
        joystickZone: document.getElementById('joystick-zone'),
        joystickBase: document.getElementById('joystick-base'),
        joystickThumb: document.getElementById('joystick-thumb'),
        fireZone: document.getElementById('fire-zone'),
        fireBtn: document.getElementById('fire-btn'),
        lookZone: document.getElementById('look-zone'),
        waveAnnounce: document.getElementById('wave-announce'),
        damageFlash: document.getElementById('damage-flash'),
        reloadIndicator: document.getElementById('reload-indicator'),
        finalScore: document.getElementById('final-score')
    };

    // ---- Initialize Game ----
    function init() {
        // Clock
        clock = new THREE.Clock();

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        scene.fog = new THREE.Fog(0x1a1a2e, 20, 80);

        // Camera
        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            200
        );
        camera.position.set(0, 2, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        dom.container.appendChild(renderer.domElement);

        // Controls
        controls = new THREE.PointerLockControls(camera, document.body);

        // Lighting
        setupLighting();

        // Arena
        arena = createArena();

        // Event listeners
        setupEventListeners();

        // Start render loop
        animate();
    }

    // ---- Lighting ----
    function setupLighting() {
        // Ambient
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambient);

        // Hemisphere
        const hemi = new THREE.HemisphereLight(0x606080, 0x202040, 0.4);
        scene.add(hemi);

        // Main directional (moon-like)
        const dirLight = new THREE.DirectionalLight(0x8888ff, 0.8);
        dirLight.position.set(20, 30, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -40;
        dirLight.shadow.camera.right = 40;
        dirLight.shadow.camera.top = 40;
        dirLight.shadow.camera.bottom = -40;
        scene.add(dirLight);

        // Point lights for atmosphere
        const point1 = new THREE.PointLight(0xff6600, 1, 30);
        point1.position.set(-15, 5, -15);
        scene.add(point1);

        const point2 = new THREE.PointLight(0x0066ff, 1, 30);
        point2.position.set(15, 5, 15);
        scene.add(point2);
    }

    // ---- Arena ----
    function createArena() {
        const group = new THREE.Group();
        const walls = [];

        // Ground
        const groundGeo = new THREE.PlaneGeometry(80, 80);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a3e,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        group.add(ground);

        // Grid helper on ground
        const grid = new THREE.GridHelper(80, 40, 0x3a3a5e, 0x2a2a4e);
        grid.position.y = 0.01;
        group.add(grid);

        // Arena walls
        const wallHeight = 6;
        const wallThickness = 1;
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a5e,
            roughness: 0.7,
            metalness: 0.3
        });

        // Create 4 walls
        const wallConfigs = [
            { pos: [0, wallHeight/2, -40], size: [80, wallHeight, wallThickness] },
            { pos: [0, wallHeight/2, 40], size: [80, wallHeight, wallThickness] },
            { pos: [-40, wallHeight/2, 0], size: [wallThickness, wallHeight, 80] },
            { pos: [40, wallHeight/2, 0], size: [wallThickness, wallHeight, 80] }
        ];

        wallConfigs.forEach(config => {
            const geo = new THREE.BoxGeometry(...config.size);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(...config.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            walls.push(mesh);
        });

        // Obstacles (cover objects)
        const obstacleMat = new THREE.MeshStandardMaterial({
            color: 0x4a4a6e,
            roughness: 0.6,
            metalness: 0.4
        });

        const obstacleConfigs = [
            // Crates
            { pos: [-10, 1, -10], size: [2, 2, 2] },
            { pos: [10, 1, -10], size: [2, 2, 2] },
            { pos: [-10, 1, 10], size: [2, 2, 2] },
            { pos: [10, 1, 10], size: [2, 2, 2] },
            // Barriers
            { pos: [-20, 1.5, 0], size: [4, 3, 1] },
            { pos: [20, 1.5, 0], size: [4, 3, 1] },
            { pos: [0, 1.5, -20], size: [1, 3, 4] },
            { pos: [0, 1.5, 20], size: [1, 3, 4] },
            // Pillars
            { pos: [-25, 3, -25], size: [2, 6, 2] },
            { pos: [25, 3, -25], size: [2, 6, 2] },
            { pos: [-25, 3, 25], size: [2, 6, 2] },
            { pos: [25, 3, 25], size: [2, 6, 2] }
        ];

        obstacleConfigs.forEach(config => {
            const geo = new THREE.BoxGeometry(...config.size);
            const mesh = new THREE.Mesh(geo, obstacleMat);
            mesh.position.set(...config.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            walls.push(mesh); // For collision
        });

        scene.add(group);
        return { group, walls };
    }

    // ---- Event Listeners ----
    function setupEventListeners() {
        // Keyboard
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Mouse
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mousedown', onMouseDown);

        // UI buttons
        dom.startBtn.addEventListener('click', startGame);
        dom.restartBtn.addEventListener('click', restartGame);

        // Pointer lock
        controls.addEventListener('lock', () => {
            console.log('Pointer locked');
        });
        controls.addEventListener('unlock', () => {
            if (gameState === STATE.PLAYING) {
                // Show pause or just continue
            }
        });

        // Touch controls
        setupTouchControls();

        // Resize
        window.addEventListener('resize', onWindowResize);
    }

    function onKeyDown(event) {
        keys[event.code] = true;

        if (event.code === 'KeyR' && gameState === STATE.PLAYING) {
            // Reload would go here (Phase 2)
        }
    }

    function onKeyUp(event) {
        keys[event.code] = false;
    }

    function onMouseMove(event) {
        if (gameState === STATE.PLAYING && controls.isLocked) {
            // Mouse look is handled by PointerLockControls
        }
    }

    function onMouseDown(event) {
        if (gameState === STATE.PLAYING && !controls.isLocked) {
            controls.lock();
        }
        // Fire would go here (Phase 2)
    }

    // ---- Touch Controls ----
    function setupTouchControls() {
        let joystickActive = false;
        let joystickStartX = 0, joystickStartY = 0;
        let joystickDeltaX = 0, joystickDeltaY = 0;
        let lookTouchId = null;
        let lookStartX = 0, lookStartY = 0;
        let lookDeltaX = 0, lookDeltaY = 0;
        let firePressed = false;

        // Joystick
        dom.joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystickActive = true;
            joystickStartX = touch.clientX;
            joystickStartY = touch.clientY;
        });

        dom.joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!joystickActive) return;
            const touch = Array.from(e.changedTouches).find(t => t.identifier === e.changedTouches[0].identifier);
            if (!touch) return;

            const deltaX = touch.clientX - joystickStartX;
            const deltaY = touch.clientY - joystickStartY;
            const maxDist = 50;
            const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (dist > maxDist) {
                joystickDeltaX = (deltaX / dist) * maxDist;
                joystickDeltaY = (deltaY / dist) * maxDist;
            } else {
                joystickDeltaX = deltaX;
                joystickDeltaY = deltaY;
            }

            // Update thumb position
            dom.joystickThumb.style.transform = `translate(calc(-50% + ${joystickDeltaX}px), calc(-50% + ${joystickDeltaY}px))`;
        });

        dom.joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            joystickActive = false;
            joystickDeltaX = 0;
            joystickDeltaY = 0;
            dom.joystickThumb.style.transform = 'translate(-50%, -50%)';
        });

        // Look zone
        dom.lookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            lookTouchId = touch.identifier;
            lookStartX = touch.clientX;
            lookStartY = touch.clientY;
        });

        dom.lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = Array.from(e.changedTouches).find(t => t.identifier === lookTouchId);
            if (!touch) return;

            const deltaX = touch.clientX - lookStartX;
            const deltaY = touch.clientY - lookStartY;

            // Apply look rotation
            if (gameState === STATE.PLAYING && controls.isLocked) {
                const sensitivity = 0.002;
                camera.rotation.y -= deltaX * sensitivity;
                camera.rotation.x -= deltaY * sensitivity;
                camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
            }

            lookStartX = touch.clientX;
            lookStartY = touch.clientY;
        });

        dom.lookZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            lookTouchId = null;
        });

        // Fire button
        dom.fireBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            firePressed = true;
            dom.fireBtn.style.background = 'rgba(255,50,50,0.5)';
        });

        dom.fireBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            firePressed = false;
            dom.fireBtn.style.background = 'rgba(255,50,50,0.3)';
        });
    }

    // ---- Window Resize ----
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ---- Game Flow ----
    function startGame() {
        dom.startScreen.style.display = 'none';
        gameState = STATE.PLAYING;

        // Reset player
        PLAYER.health = PLAYER.maxHealth;
        PLAYER.score = 0;
        PLAYER.wave = 1;

        // Reset camera
        camera.position.set(0, 2, 0);
        camera.rotation.set(0, 0, 0);

        // Lock pointer
        controls.lock();

        // Update HUD
        updateHUD();

        // Show wave announcement
        announceWave(1);
    }

    function restartGame() {
        dom.gameOver.style.display = 'none';
        startGame();
    }

    function gameOver() {
        gameState = STATE.GAME_OVER;
        controls.unlock();
        dom.finalScore.textContent = `Score: ${PLAYER.score}`;
        dom.gameOver.style.display = 'flex';
    }

    function announceWave(wave) {
        dom.waveAnnounce.textContent = `WAVE ${wave}`;
        dom.waveAnnounce.classList.add('show');
        setTimeout(() => {
            dom.waveAnnounce.classList.remove('show');
        }, 2000);
    }

    // ---- HUD Update ----
    function updateHUD() {
        dom.healthValue.textContent = Math.max(0, Math.round(PLAYER.health));
        dom.healthBar.style.width = `${(PLAYER.health / PLAYER.maxHealth) * 100}%`;
        dom.scoreValue.textContent = PLAYER.score;
        dom.waveValue.textContent = PLAYER.wave;
        // Ammo would be updated here (Phase 2)
    }

    // ---- Player Movement ----
    function updatePlayerMovement(delta) {
        if (gameState !== STATE.PLAYING) return;

        const speed = PLAYER.speed * delta;
        const direction = new THREE.Vector3();

        // Keyboard movement
        if (keys['KeyW'] || keys['ArrowUp']) direction.z -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) direction.z += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) direction.x -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;

        // Touch joystick movement
        if (joystickDeltaX !== 0 || joystickDeltaY !== 0) {
            direction.x += joystickDeltaX / 50;
            direction.z += joystickDeltaY / 50;
        }

        // Normalize and apply
        if (direction.length() > 0) {
            direction.normalize();

            // Get camera direction (ignore Y for movement)
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

            // Calculate movement
            const moveX = (cameraDirection.x * direction.z + right.x * direction.x) * speed;
            const moveZ = (cameraDirection.z * direction.z + right.z * direction.x) * speed;

            // Apply movement with collision detection
            const newPos = camera.position.clone();
            newPos.x += moveX;
            newPos.z += moveZ;

            // Keep within arena bounds
            const bound = 38;
            newPos.x = Math.max(-bound, Math.min(bound, newPos.x));
            newPos.z = Math.max(-bound, Math.min(bound, newPos.z));

            // Simple obstacle collision
            let collides = false;
            arena.walls.forEach(wall => {
                const wallBox = new THREE.Box3().setFromObject(wall);
                const playerBox = new THREE.Box3().setFromCenterAndSize(
                    newPos,
                    new THREE.Vector3(1, 2, 1)
                );
                if (wallBox.intersectsBox(playerBox)) {
                    collides = true;
                }
            });

            if (!collides) {
                camera.position.copy(newPos);
            }
        }

        // Keep player at fixed height
        camera.position.y = 2;
    }

    // ---- Animation Loop ----
    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);

        if (gameState === STATE.PLAYING) {
            updatePlayerMovement(delta);
            updateHUD();
        }

        renderer.render(scene, camera);
    }

    // ---- Expose for touch controls ----
    let joystickDeltaX = 0;
    let joystickDeltaY = 0;

    // Override the touch control references
    const originalSetupTouch = setupTouchControls;
    window._gameState = {
        get joystickDeltaX() { return joystickDeltaX; },
        get joystickDeltaY() { return joystickDeltaY; },
        set joystickDeltaX(val) { joystickDeltaX = val; },
        set joystickDeltaY(val) { joystickDeltaY = val; }
    };

    // ---- Start ----
    init();

})();
