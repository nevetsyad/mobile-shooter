// ============================================================
// SARA GOES TO WORK - Phase 4: cover, flanking, sprint, pause
// Procedural music, shooter and bomber enemies, saved best wave
// ============================================================

(function() {
    'use strict';

    if (typeof THREE === 'undefined') {
        const screen = document.getElementById('start-screen');
        if (screen) {
            const note = document.createElement('p');
            note.textContent = '3D engine failed to load. Refresh and try again.';
            screen.appendChild(note);
        }
        return;
    }

    function createControls(camera, domElement) {
        const controls = {
            isLocked: false,
            lock() {
                const request = domElement.requestPointerLock;
                if (!request) return;
                try {
                    const pending = request.call(domElement);
                    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
                } catch (err) {}
            },
            unlock() {
                try {
                    if (document.exitPointerLock) document.exitPointerLock();
                } catch (err) {}
            }
        };
        document.addEventListener('pointerlockchange', () => {
            controls.isLocked = document.pointerLockElement === domElement;
        });
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement !== domElement) return;
            camera.rotation.order = 'YXZ';
            camera.rotation.y -= (event.movementX || 0) * 0.002;
            camera.rotation.x -= (event.movementY || 0) * 0.002;
            camera.rotation.x = Math.max(-1.45, Math.min(1.45, camera.rotation.x));
        });
        return controls;
    }

    function viewportSize() {
        const view = window.visualViewport;
        return {
            width: Math.max(1, Math.round(view ? view.width : window.innerWidth)),
            height: Math.max(1, Math.round(view ? view.height : window.innerHeight)),
            top: Math.round(view ? view.offsetTop : 0),
            left: Math.round(view ? view.offsetLeft : 0)
        };
    }

    function markTouchUI() {
        const touch = window.matchMedia('(hover: none), (pointer: coarse)').matches
            || navigator.maxTouchPoints > 0;
        document.documentElement.classList.toggle('touch-ui', touch);
    }

    let weaponAnchor = { x: 0.16, y: -0.16, z: -0.62, scale: 1 };

    function updateWeaponAnchor() {
        const aspect = Math.max(0.45, camera && camera.aspect ? camera.aspect : 1);
        weaponAnchor = {
            x: Math.min(0.16, 0.12 * aspect + 0.04),
            y: aspect < 1 ? -0.1 : -0.16,
            z: -0.62,
            scale: aspect < 0.7 ? 0.62 : aspect < 1 ? 0.78 : 1
        };
        if (weaponGroup) weaponGroup.scale.setScalar(weaponAnchor.scale);
    }

    const STATE = {
        MENU: 'menu',
        PLAYING: 'playing',
        GAME_OVER: 'game_over',
        PAUSED: 'paused'
    };

    let gameState = STATE.MENU;
    let scene, camera, renderer, controls;
    let arena;
    let wallBoxes = [];
    let coverPoints = [];
    let sprintHeld = false;
    const STAMINA = { current: 100, max: 100, regenDelay: 0 };
    let clock;

    const PLAYER = {
        health: 100,
        maxHealth: 100,
        speed: 10,
        score: 0,
        wave: 1
    };

    const WEAPON = {
        maxAmmo: 30,
        ammo: 30,
        fireRate: 100,
        lastShot: 0,
        reloading: false,
        reloadTime: 1500,
        recoil: 0.035,
        recoilRecovery: 0.82,
        currentRecoil: 0,
        bobTime: 0,
        bobMoving: false
    };

    let enemies = [];
    let bullets = [];
    let particles = [];
    let muzzleFlashes = [];
    let highScore = 0;
    let bestWave = 0;
    let newBestThisRun = false;
    let reloadToken = 0;
    let enemyShots = [];
    let musicGain = null;
    let musicFilter = null;
    let hatBuffer = null;
    const MUSIC = {
        playing: false,
        muted: false,
        step: 0,
        nextTime: 0,
        timer: 0
    };

    const GEO = {};
    const MAT = {};
    const ray = new THREE.Ray();
    const rayHit = new THREE.Vector3();
    const moveDir = new THREE.Vector3();
    const playerBox = new THREE.Box3();
    const enemyBox = new THREE.Box3();

    let waveConfig = {
        enemiesPerWave: 5,
        spawnInterval: 2000,
        spawnTimer: 0,
        enemiesSpawned: 0,
        enemiesAlive: 0,
        waveComplete: false,
        waveDelay: 2500
    };

    const keys = {};
    let joystickDeltaX = 0;
    let joystickDeltaY = 0;
    let touchFirePressed = false;
    let mouseDown = false;

    const dom = {
        container: document.getElementById('game-container'),
        startScreen: document.getElementById('start-screen'),
        gameOver: document.getElementById('game-over'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn'),
        healthValue: document.getElementById('health-value'),
        healthBar: document.getElementById('health-bar'),
        scoreValue: document.getElementById('score-value'),
        bestValue: document.getElementById('best-value'),
        menuBest: document.getElementById('menu-best'),
        finalBest: document.getElementById('final-best'),
        waveValue: document.getElementById('wave-value'),
        ammoValue: document.getElementById('ammo-value'),
        ammoBar: document.getElementById('ammo-bar'),
        crosshair: document.getElementById('crosshair'),
        pauseBtn: document.getElementById('pause-btn'),
        resumeBtn: document.getElementById('resume-btn'),
        pauseScreen: document.getElementById('pause-screen'),
        sprintBtn: document.getElementById('sprint-btn'),
        staminaBar: document.getElementById('stamina-bar'),
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
        finalScore: document.getElementById('final-score'),
        muteBtn: document.getElementById('mute-btn')
    };

    let audioCtx;

    function loadHighScore() {
        try {
            highScore = parseInt(localStorage.getItem('sgtw_highscore') || '0', 10) || 0;
            bestWave = parseInt(localStorage.getItem('sgtw_bestwave') || '0', 10) || 0;
            MUSIC.muted = localStorage.getItem('sgtw_music') === 'off';
        } catch (err) {
            highScore = 0;
            bestWave = 0;
        }
    }

    function rememberWave() {
        if (PLAYER.wave <= bestWave) return false;
        bestWave = PLAYER.wave;
        try {
            localStorage.setItem('sgtw_bestwave', String(bestWave));
        } catch (err) {}
        return true;
    }

    function rememberScore() {
        if (PLAYER.score <= highScore) return false;
        highScore = PLAYER.score;
        newBestThisRun = true;
        try {
            localStorage.setItem('sgtw_highscore', String(highScore));
        } catch (err) {}
        return true;
    }

    function initPools() {
        GEO.bullet = new THREE.SphereGeometry(0.05, 6, 6);
        GEO.trail = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
        GEO.particle = new THREE.SphereGeometry(0.035, 4, 4);
        GEO.bullet.userData.shared = true;
        GEO.trail.userData.shared = true;
        GEO.particle.userData.shared = true;
        MAT.bullet = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        MAT.trail = new THREE.MeshBasicMaterial({
            color: 0xffaa00, transparent: true, opacity: 0.55
        });
        MAT.bullet.userData.shared = true;
        MAT.trail.userData.shared = true;
        MAT.enemyShot = new THREE.MeshBasicMaterial({ color: 0x66eeff });
        MAT.enemyShot.userData.shared = true;
    }

    function initAudio() {
        if (audioCtx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
    }

    function playSound(type) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        switch (type) {
            case 'shoot':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
                gain.gain.setValueAtTime(0.22, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'hit':
                osc.type = 'square';
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'kill':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(620, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
                gain.gain.setValueAtTime(0.22, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
                osc.start(now);
                osc.stop(now + 0.24);
                break;
            case 'reload':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(540, now + 0.08);
                osc.frequency.setValueAtTime(980, now + 0.16);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
                osc.start(now);
                osc.stop(now + 0.24);
                break;
            case 'empty':
                osc.type = 'square';
                osc.frequency.setValueAtTime(90, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
                osc.start(now);
                osc.stop(now + 0.06);
                break;
            case 'damage':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
                gain.gain.setValueAtTime(0.28, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.22);
                break;
            case 'wave':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(420, now);
                osc.frequency.setValueAtTime(520, now + 0.08);
                osc.frequency.setValueAtTime(640, now + 0.16);
                osc.frequency.setValueAtTime(820, now + 0.26);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);
                osc.start(now);
                osc.stop(now + 0.42);
                break;
            case 'enemyShot':
                osc.type = 'square';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
                gain.gain.setValueAtTime(0.07, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
                break;
            case 'boom':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(96, now);
                osc.frequency.exponentialRampToValueAtTime(32, now + 0.28);
                gain.gain.setValueAtTime(0.32, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
                osc.start(now);
                osc.stop(now + 0.32);
                break;
            default:
                osc.stop(now);
                break;
        }
    }

    function ensureHatBuffer() {
        if (hatBuffer || !audioCtx) return;
        const length = Math.floor(audioCtx.sampleRate * 0.05);
        hatBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
        const data = hatBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }

    function ensureMusicBus() {
        if (!audioCtx || musicGain) return;
        musicGain = audioCtx.createGain();
        musicGain.gain.value = MUSIC.muted ? 0.0001 : 1;
        musicFilter = audioCtx.createBiquadFilter();
        musicFilter.type = 'lowpass';
        musicFilter.frequency.value = 900;
        musicGain.connect(musicFilter);
        musicFilter.connect(audioCtx.destination);
    }

    function applyMusicVolume() {
        if (!musicGain || !audioCtx) return;
        musicGain.gain.setTargetAtTime(MUSIC.muted ? 0.0001 : 1, audioCtx.currentTime, 0.04);
    }

    function updateMuteLabel() {
        if (dom.muteBtn) dom.muteBtn.textContent = MUSIC.muted ? 'MUSIC OFF' : 'MUSIC ON';
    }

    function toggleMusic() {
        MUSIC.muted = !MUSIC.muted;
        try {
            localStorage.setItem('sgtw_music', MUSIC.muted ? 'off' : 'on');
        } catch (err) {}
        applyMusicVolume();
        updateMuteLabel();
    }

    function musicTone(time, freq, type, dur, vol) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(time);
        osc.stop(time + dur + 0.02);
    }

    function musicHat(time) {
        if (!hatBuffer) return;
        const src = audioCtx.createBufferSource();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        src.buffer = hatBuffer;
        filter.type = 'highpass';
        filter.frequency.value = 5000;
        gain.gain.setValueAtTime(0.025, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);
        src.start(time);
        src.stop(time + 0.05);
    }

    function triggerMusicStep(time, step) {
        const bass = [55, 0, 82.41, 55, 73.42, 0, 65.41, 49][step];
        if (bass) musicTone(time, bass, 'triangle', 0.18, 0.05);
        if (step % 2 === 0) musicHat(time);
        if (step % 4 === 0) musicTone(time, 62, 'sine', 0.09, 0.07);
        if (PLAYER.wave >= 2) {
            const lead = [0, 220, 0, 277.18, 329.63, 0, 246.94, 196][step];
            if (lead) musicTone(time, lead, 'square', 0.11, 0.012);
        }
        if (PLAYER.wave >= 4 && step === 6) musicTone(time, 392, 'sawtooth', 0.08, 0.01);
    }

    function scheduleMusic() {
        if (!MUSIC.playing || !audioCtx) return;
        if (MUSIC.nextTime < audioCtx.currentTime) MUSIC.nextTime = audioCtx.currentTime + 0.05;
        const bpm = 96 + Math.min(32, Math.max(0, PLAYER.wave - 1) * 4);
        const stepDur = 60 / bpm / 2;
        const horizon = audioCtx.currentTime + 0.24;
        while (MUSIC.nextTime < horizon) {
            triggerMusicStep(MUSIC.nextTime, MUSIC.step % 8);
            MUSIC.step += 1;
            MUSIC.nextTime += stepDur;
        }
        if (musicFilter) {
            const open = 780 + Math.min(2400, PLAYER.wave * 160);
            musicFilter.frequency.setTargetAtTime(open, audioCtx.currentTime, 0.25);
        }
        MUSIC.timer = setTimeout(scheduleMusic, 70);
    }

    function startMusic() {
        initAudio();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        ensureHatBuffer();
        ensureMusicBus();
        applyMusicVolume();
        if (MUSIC.playing) return;
        MUSIC.playing = true;
        MUSIC.step = 0;
        MUSIC.nextTime = audioCtx.currentTime + 0.06;
        scheduleMusic();
    }

    function init() {
        markTouchUI();
        loadHighScore();
        initPools();
        clock = new THREE.Clock();

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        scene.fog = new THREE.Fog(0x1a1a2e, 20, 80);

        const view = viewportSize();
        camera = new THREE.PerspectiveCamera(
            75,
            view.width / view.height,
            0.1,
            200
        );
        camera.position.set(0, 1.7, 0);
        camera.rotation.order = 'YXZ';
        const gunLight = new THREE.PointLight(0xfff4e8, 3, 8);
        gunLight.position.set(0.2, 0.05, -0.35);
        camera.add(gunLight);
        scene.add(camera);

        const phone = document.documentElement.classList.contains('touch-ui');
        renderer = new THREE.WebGLRenderer({
            antialias: !phone,
            alpha: false,
            powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
        renderer.setSize(view.width, view.height, false);
        renderer.shadowMap.enabled = !phone;
        renderer.shadowMap.type = phone ? THREE.BasicShadowMap : THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        dom.container.appendChild(renderer.domElement);

        controls = createControls(camera, renderer.domElement);

        setupLighting();
        arena = createArena();
        cacheWallBoxes();
        setupEventListeners();
        updateScoreLabels();
        updateMuteLabel();
        onWindowResize();
        animate();
    }

    function setupLighting() {
        scene.add(new THREE.AmbientLight(0x404060, 0.55));
        scene.add(new THREE.HemisphereLight(0x606080, 0x202040, 0.45));

        const dirLight = new THREE.DirectionalLight(0x8888ff, 0.85);
        dirLight.position.set(20, 30, 10);
        const phoneShadows = document.documentElement.classList.contains('touch-ui');
        dirLight.castShadow = !phoneShadows;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -40;
        dirLight.shadow.camera.right = 40;
        dirLight.shadow.camera.top = 40;
        dirLight.shadow.camera.bottom = -40;
        scene.add(dirLight);

        const point1 = new THREE.PointLight(0xff6600, 1, 30);
        point1.position.set(-15, 5, -15);
        scene.add(point1);

        const point2 = new THREE.PointLight(0x0066ff, 1, 30);
        point2.position.set(15, 5, 15);
        scene.add(point2);
    }

    function createArena() {
        const group = new THREE.Group();
        const walls = [];

        const groundGeo = new THREE.PlaneGeometry(80, 80);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a3e, roughness: 0.8, metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        group.add(ground);

        const grid = new THREE.GridHelper(80, 40, 0x3a3a5e, 0x2a2a4e);
        grid.position.y = 0.01;
        group.add(grid);

        const wallHeight = 6;
        const wallThickness = 1;
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a5e, roughness: 0.7, metalness: 0.3
        });

        [[0, wallHeight / 2, -40, [80, wallHeight, wallThickness]],
         [0, wallHeight / 2, 40, [80, wallHeight, wallThickness]],
         [-40, wallHeight / 2, 0, [wallThickness, wallHeight, 80]],
         [40, wallHeight / 2, 0, [wallThickness, wallHeight, 80]]].forEach(config => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...config[3]), wallMat);
            mesh.position.set(config[0], config[1], config[2]);
            mesh.castShadow = !document.documentElement.classList.contains('touch-ui');
            mesh.receiveShadow = !document.documentElement.classList.contains('touch-ui');
            group.add(mesh);
            walls.push(mesh);
        });

        const obstacleMat = new THREE.MeshStandardMaterial({
            color: 0x4a4a6e, roughness: 0.6, metalness: 0.4
        });

        [[-10, 1, -10, [2, 2, 2]], [10, 1, -10, [2, 2, 2]],
         [-10, 1, 10, [2, 2, 2]], [10, 1, 10, [2, 2, 2]],
         [-20, 1.5, 0, [4, 3, 1]], [20, 1.5, 0, [4, 3, 1]],
         [0, 1.5, -20, [1, 3, 4]], [0, 1.5, 20, [1, 3, 4]],
         [-25, 3, -25, [2, 6, 2]], [25, 3, -25, [2, 6, 2]],
         [-25, 3, 25, [2, 6, 2]], [25, 3, 25, [2, 6, 2]]].forEach(config => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...config[3]), obstacleMat);
            mesh.position.set(config[0], config[1], config[2]);
            mesh.castShadow = !document.documentElement.classList.contains('touch-ui');
            mesh.receiveShadow = !document.documentElement.classList.contains('touch-ui');
            group.add(mesh);
            walls.push(mesh);
        });

        scene.add(group);
        return { group, walls };
    }

    function cacheWallBoxes() {
        arena.group.updateMatrixWorld(true);
        wallBoxes = arena.walls.map(wall => new THREE.Box3().setFromObject(wall));
        coverPoints = [];
        for (let i = 4; i < wallBoxes.length; i++) {
            const box = wallBoxes[i];
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const padX = size.x / 2 + 1.4;
            const padZ = size.z / 2 + 1.4;
            [[center.x + padX, center.z], [center.x - padX, center.z],
             [center.x, center.z + padZ], [center.x, center.z - padZ]].forEach(([x, z]) => {
                if (Math.abs(x) < 35 && Math.abs(z) < 35) coverPoints.push({ x, z });
            });
        }
    }

    function lineBlocked(x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.25) return false;
        ray.origin.set(x1, 1.1, z1);
        ray.direction.set(dx / len, 0, dz / len);
        for (let i = 4; i < wallBoxes.length; i++) {
            const hit = ray.intersectBox(wallBoxes[i], rayHit);
            if (hit && ray.origin.distanceTo(hit) < len - 0.3) return true;
        }
        return false;
    }

    function nearestCover(x, z, px, pz, wantHidden) {
        let best = null;
        let bestScore = Infinity;
        for (let i = 0; i < coverPoints.length; i++) {
            const spot = coverPoints[i];
            const dSelf = Math.hypot(spot.x - x, spot.z - z);
            const dPlayer = Math.hypot(spot.x - px, spot.z - pz);
            if (dPlayer < 3.2 || dPlayer > 18) continue;
            const hidden = lineBlocked(spot.x, spot.z, px, pz);
            if (wantHidden !== hidden) continue;
            const preferred = wantHidden ? 7 : 11;
            const score = dSelf + Math.abs(dPlayer - preferred) * 0.4;
            if (score < bestScore) {
                bestScore = score;
                best = spot;
            }
        }
        return best;
    }

    function stepToward(enemy, tx, tz, step) {
        const mx = tx - enemy.position.x;
        const mz = tz - enemy.position.z;
        const md = Math.hypot(mx, mz) || 0.001;
        if (md < 0.3) return md;
        enemy.position.x += (mx / md) * Math.min(step, md);
        enemy.position.z += (mz / md) * Math.min(step, md);
        return md;
    }

    let weaponGroup;

    function destroyWeapon() {
        if (!weaponGroup) return;
        camera.remove(weaponGroup);
        weaponGroup.traverse(obj => {
            if (obj.geometry && !obj.geometry.userData.shared) obj.geometry.dispose();
            if (obj.material && !obj.material.userData.shared) obj.material.dispose();
        });
        weaponGroup = null;
        muzzleFlashes.length = 0;
    }

    function createWeapon() {
        destroyWeapon();
        weaponGroup = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xb7b7b7, roughness: 0.45, metalness: 0.35, emissive: 0x222222 })
        );
        body.position.set(0, 0, -0.2);
        weaponGroup.add(body);

        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8),
            new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.5, emissive: 0x111111 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.5);
        weaponGroup.add(barrel);

        const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.12, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.6, metalness: 0.15, emissive: 0x1a1008 })
        );
        handle.position.set(0, -0.08, -0.08);
        handle.rotation.x = 0.25;
        weaponGroup.add(handle);

        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
        );
        flash.position.set(0, 0.02, -0.64);
        flash.name = 'muzzleFlash';
        weaponGroup.add(flash);
        muzzleFlashes.push(flash);

        updateWeaponAnchor();
        weaponGroup.position.set(weaponAnchor.x, weaponAnchor.y, weaponAnchor.z);
        weaponGroup.scale.setScalar(weaponAnchor.scale);
        camera.add(weaponGroup);
    }

    const LAWYER = { ready: false };

    function ensureLawyerParts() {
        if (LAWYER.ready) return;
        const sharedGeo = geo => {
            geo.userData.shared = true;
            return geo;
        };
        const sharedMat = opts => {
            const material = new THREE.MeshStandardMaterial(opts);
            material.userData.shared = true;
            return material;
        };
        LAWYER.geo = {
            head: sharedGeo(new THREE.SphereGeometry(0.16, 10, 8)),
            hair: sharedGeo(new THREE.BoxGeometry(0.28, 0.08, 0.26)),
            torso: sharedGeo(new THREE.BoxGeometry(0.46, 0.62, 0.28)),
            leg: sharedGeo(new THREE.BoxGeometry(0.14, 0.62, 0.16)),
            arm: sharedGeo(new THREE.BoxGeometry(0.12, 0.5, 0.12)),
            shoe: sharedGeo(new THREE.BoxGeometry(0.15, 0.08, 0.22)),
            tie: sharedGeo(new THREE.BoxGeometry(0.07, 0.28, 0.04)),
            collar: sharedGeo(new THREE.BoxGeometry(0.16, 0.08, 0.04)),
            glasses: sharedGeo(new THREE.BoxGeometry(0.26, 0.035, 0.03)),
            case: sharedGeo(new THREE.BoxGeometry(0.26, 0.18, 0.08)),
            clasp: sharedGeo(new THREE.BoxGeometry(0.08, 0.04, 0.02)),
            handle: sharedGeo(new THREE.BoxGeometry(0.12, 0.04, 0.03)),
            paper: sharedGeo(new THREE.BoxGeometry(0.14, 0.1, 0.01))
        };
        LAWYER.skin = sharedMat({ color: 0xd7b08a, roughness: 0.7 });
        LAWYER.hair = sharedMat({ color: 0x1a120c, roughness: 0.85 });
        LAWYER.shirt = sharedMat({ color: 0xf4f1ea, roughness: 0.6 });
        LAWYER.shoe = sharedMat({ color: 0x111111, roughness: 0.4, metalness: 0.2 });
        LAWYER.glass = sharedMat({ color: 0x1a1a1a, roughness: 0.15, metalness: 0.65 });
        LAWYER.leather = sharedMat({ color: 0x5a3a22, roughness: 0.45, metalness: 0.2 });
        LAWYER.gold = sharedMat({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 });
        LAWYER.ready = true;
    }

    function lawyerPiece(geo, material, x, y, z) {
        const piece = new THREE.Mesh(geo, material);
        piece.position.set(x, y, z);
        return piece;
    }

    function dressLawyer(enemy, type, size, accent) {
        ensureLawyerParts();
        const g = LAWYER.geo;
        const suitColor = {
            fast: 0x2c2418,
            tank: 0x1c1430,
            shooter: 0x142433,
            bomber: 0x14301c
        }[type] || 0x1c1c24;
        const suitMat = new THREE.MeshStandardMaterial({
            color: suitColor, roughness: 0.55, metalness: 0.12
        });
        const tieMat = new THREE.MeshStandardMaterial({
            color: accent, roughness: 0.4, metalness: 0.15,
            emissive: accent, emissiveIntensity: 0.12
        });
        const caseMat = type === 'bomber'
            ? new THREE.MeshStandardMaterial({
                color: 0x2a4a28, roughness: 0.4, metalness: 0.2,
                emissive: 0x33cc55, emissiveIntensity: 0.55
            })
            : LAWYER.leather;

        const figure = new THREE.Group();
        figure.name = 'lawyer';
        figure.add(lawyerPiece(g.leg, suitMat, -0.12, 0.4, 0));
        figure.add(lawyerPiece(g.leg, suitMat, 0.12, 0.4, 0));
        figure.add(lawyerPiece(g.shoe, LAWYER.shoe, -0.12, 0.06, 0.03));
        figure.add(lawyerPiece(g.shoe, LAWYER.shoe, 0.12, 0.06, 0.03));

        const jacket = lawyerPiece(g.torso, suitMat, 0, 0.98, 0);
        jacket.name = 'suit';
        jacket.castShadow = true;
        figure.add(jacket);
        figure.add(lawyerPiece(g.collar, LAWYER.shirt, 0, 1.22, 0.13));
        figure.add(lawyerPiece(g.tie, tieMat, 0, 1.08, 0.16));
        figure.add(lawyerPiece(g.head, LAWYER.skin, 0, 1.5, 0));
        figure.add(lawyerPiece(g.hair, LAWYER.hair, 0, 1.64, -0.01));
        figure.add(lawyerPiece(g.glasses, LAWYER.glass, 0, 1.52, 0.15));

        const armL = lawyerPiece(g.arm, suitMat, -0.3, 0.98, 0);
        const armR = lawyerPiece(g.arm, suitMat, 0.3, 0.98, 0);
        if (type === 'shooter') {
            armL.rotation.x = -1.15;
            armL.position.set(-0.28, 1.08, 0.14);
        }
        figure.add(armL);
        figure.add(armR);

        const briefcase = new THREE.Group();
        briefcase.name = 'briefcase';
        const caseBody = lawyerPiece(g.case, caseMat, 0, 0, 0);
        caseBody.castShadow = true;
        briefcase.add(caseBody);
        briefcase.add(lawyerPiece(g.clasp, LAWYER.gold, 0, 0.02, 0.045));
        briefcase.add(lawyerPiece(g.handle, LAWYER.gold, 0, 0.12, 0));
        if (type === 'shooter') {
            const paper = lawyerPiece(g.paper, tieMat, 0.02, 0.08, 0.05);
            paper.rotation.z = 0.25;
            briefcase.add(paper);
            briefcase.position.set(-0.36, 1.18, 0.36);
            briefcase.rotation.x = -0.45;
        } else if (type === 'bomber') {
            briefcase.position.set(-0.36, 0.58, 0.22);
        } else if (type === 'tank') {
            briefcase.position.set(-0.4, 0.55, 0.2);
        } else {
            briefcase.position.set(-0.34, 0.62, 0.18);
        }
        const caseScale = type === 'bomber' ? 1.45 : type === 'tank' ? 1.28 : 1;
        briefcase.scale.setScalar(caseScale);
        figure.add(briefcase);

        figure.scale.set(size[0] / 0.72, size[1] / 1.72, size[0] / 0.72);
        enemy.add(figure);
        return {
            suit: jacket,
            briefcase,
            caseScale
        };
    }

    function createEnemy(type) {
        const enemy = new THREE.Group();
        let health, speed, damage, scoreValue, size, color;

        switch (type) {
            case 'fast':
                health = 20; speed = 6.2; damage = 8; scoreValue = 150;
                size = [0.6, 1.2, 0.6]; color = 0xffaa00;
                break;
            case 'tank':
                health = 90; speed = 1.6; damage = 22; scoreValue = 300;
                size = [1.2, 2.2, 1.2]; color = 0x8844ff;
                break;
            case 'shooter':
                health = 28; speed = 2.5; damage = 12; scoreValue = 180;
                size = [0.7, 1.7, 0.7]; color = 0x33ddff;
                break;
            case 'bomber':
                health = 24; speed = 5.4; damage = 28; scoreValue = 220;
                size = [1.05, 1.15, 1.05]; color = 0x44ee66;
                break;
            default:
                health = 34; speed = 3.1; damage = 10; scoreValue = 100;
                size = [0.8, 1.6, 0.8]; color = 0xff4444;
        }

        const waveBonus = Math.max(0, PLAYER.wave - 1);
        health = Math.round(health * (1 + waveBonus * 0.08));
        speed *= Math.min(1.8, 1 + waveBonus * 0.045);
        damage = Math.round(damage * (1 + waveBonus * 0.06));
        scoreValue += waveBonus * 10;

        const lawyer = dressLawyer(enemy, type, size, color);

        const angle = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 6;
        enemy.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

        enemy.userData = {
            type, health, maxHealth: health, speed, damage, scoreValue, size,
            attackCooldown: type === 'shooter' ? 700 : 400,
            attackRate: type === 'shooter'
                ? Math.max(850, 1450 - waveBonus * 60)
                : Math.max(650, 1100 - waveBonus * 40),
            hitFlash: 0,
            strafe: Math.random() < 0.5 ? 1 : -1,
            suit: lawyer.suit,
            briefcase: lawyer.briefcase,
            caseScale: lawyer.caseScale,
            tactic: type === 'bomber' ? 'rush'
                : type === 'shooter' ? 'cover'
                : type === 'fast' || Math.random() < 0.5 ? 'flank' : 'rush',
            flankSide: Math.random() < 0.5 ? 1 : -1,
            coverX: 0,
            coverZ: 0,
            coverUntil: 0,
            coverLock: 0
        };

        scene.add(enemy);
        enemies.push(enemy);
        waveConfig.enemiesAlive++;
        return enemy;
    }

    function spawnEnemy() {
        const types = ['grunt', 'grunt', 'fast'];
        if (PLAYER.wave >= 2) types.push('shooter', 'grunt');
        if (PLAYER.wave >= 3) types.push('bomber', 'fast', 'shooter');
        if (PLAYER.wave >= 4) types.push('tank', 'shooter');
        if (PLAYER.wave >= 6) types.push('bomber', 'tank');
        createEnemy(types[Math.floor(Math.random() * types.length)]);
        waveConfig.enemiesSpawned++;
    }

    function updateEnemies(delta) {
        const px = camera.position.x;
        const pz = camera.position.z;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const data = enemy.userData;
            const dx = px - enemy.position.x;
            const dz = pz - enemy.position.z;
            const dist = Math.hypot(dx, dz) || 0.001;

            enemy.lookAt(px, enemy.position.y, pz);
            const step = data.speed * delta;
            const now = performance.now();

            if (data.type !== 'bomber' && data.hitFlash > 0.1) {
                data.coverUntil = now + (data.type === 'tank' ? 2600 : 1600);
                if (now > data.coverLock) {
                    const hide = nearestCover(enemy.position.x, enemy.position.z, px, pz, true);
                    if (hide) {
                        data.coverX = hide.x;
                        data.coverZ = hide.z;
                        data.coverLock = now + 800;
                    }
                }
            }

            if (data.type === 'bomber') {
                stepToward(enemy, px, pz, step);
                const pulse = 1 + Math.sin(now / 110) * 0.12;
                if (data.briefcase) data.briefcase.scale.setScalar(data.caseScale * pulse);
                if (dist < 1.55) {
                    killEnemy(i);
                    continue;
                }
            } else if (now < data.coverUntil && (data.coverX || data.coverZ)) {
                stepToward(enemy, data.coverX, data.coverZ, step);
                const atCover = Math.hypot(data.coverX - enemy.position.x, data.coverZ - enemy.position.z) < 0.9;
                if (data.type === 'shooter' && atCover && lineBlocked(enemy.position.x, enemy.position.z, px, pz)) {
                    enemy.position.x += (-dz / dist) * step * 0.7 * data.flankSide;
                    enemy.position.z += (dx / dist) * step * 0.7 * data.flankSide;
                }
            } else if (data.type === 'shooter') {
                if (now > data.coverLock) {
                    const peek = nearestCover(enemy.position.x, enemy.position.z, px, pz, false);
                    if (peek) {
                        data.coverX = peek.x;
                        data.coverZ = peek.z;
                    }
                    data.coverLock = now + 1200;
                }
                if (data.coverX || data.coverZ) {
                    const dSpot = Math.hypot(data.coverX - enemy.position.x, data.coverZ - enemy.position.z);
                    if (dSpot > 1.1) stepToward(enemy, data.coverX, data.coverZ, step);
                    else {
                        enemy.position.x += (-dz / dist) * step * 0.4 * data.strafe;
                        enemy.position.z += (dx / dist) * step * 0.4 * data.strafe;
                    }
                } else if (dist > 12) {
                    stepToward(enemy, px, pz, step * 0.85);
                }
            } else if (data.tactic === 'flank' && dist > 4.5) {
                stepToward(
                    enemy,
                    px + (-dz / dist) * 6 * data.flankSide,
                    pz + (dx / dist) * 6 * data.flankSide,
                    step
                );
            } else if (dist > 1.6) {
                stepToward(enemy, px, pz, step);
            }

            if (data.type === 'shooter') {
                data.attackCooldown -= delta * 1000;
                if (data.attackCooldown <= 0 && dist < 22 &&
                    !lineBlocked(enemy.position.x, enemy.position.z, px, pz)) {
                    fireEnemyShot(enemy);
                    data.attackCooldown = data.attackRate;
                }
            } else if (data.type !== 'bomber' && dist < 1.8) {
                data.attackCooldown -= delta * 1000;
                if (data.attackCooldown <= 0) {
                    damagePlayer(data.damage);
                    data.attackCooldown = data.attackRate;
                    playSound('hit');
                }
            }

            const suit = data.suit;
            if (suit) {
                if (data.hitFlash > 0) {
                    data.hitFlash -= delta;
                    suit.material.emissive.setHex(0xff4422);
                    suit.material.emissiveIntensity = data.hitFlash * 6;
                } else if (suit.material.emissiveIntensity !== 0) {
                    suit.material.emissive.setHex(0x000000);
                    suit.material.emissiveIntensity = 0;
                }
            }

            enemy.position.x = Math.max(-37, Math.min(37, enemy.position.x));
            enemy.position.z = Math.max(-37, Math.min(37, enemy.position.z));

            enemyBox.min.set(
                enemy.position.x - data.size[0] / 2,
                0,
                enemy.position.z - data.size[2] / 2
            );
            enemyBox.max.set(
                enemy.position.x + data.size[0] / 2,
                data.size[1],
                enemy.position.z + data.size[2] / 2
            );
            for (let w = 4; w < wallBoxes.length; w++) {
                if (!wallBoxes[w].intersectsBox(enemyBox)) continue;
                const c = wallBoxes[w].getCenter(rayHit);
                const pushX = enemy.position.x - c.x;
                const pushZ = enemy.position.z - c.z;
                const plen = Math.hypot(pushX, pushZ) || 1;
                enemy.position.x += (pushX / plen) * delta * 8;
                enemy.position.z += (pushZ / plen) * delta * 8;
            }
        }
    }

    function shoot() {
        if (gameState !== STATE.PLAYING) return;
        if (WEAPON.reloading) return;
        if (WEAPON.ammo <= 0) {
            playSound('empty');
            reload();
            return;
        }

        const now = performance.now();
        if (now - WEAPON.lastShot < WEAPON.fireRate) return;
        WEAPON.lastShot = now;
        WEAPON.ammo--;
        WEAPON.currentRecoil = Math.min(0.14, WEAPON.currentRecoil + WEAPON.recoil);

        const flash = muzzleFlashes[0];
        if (flash) {
            flash.material.opacity = 1;
            flash.scale.set(2.2, 2.2, 2.2);
        }

        playSound('shoot');

        const bullet = new THREE.Mesh(GEO.bullet, MAT.bullet);
        const origin = new THREE.Vector3();
        if (flash) flash.getWorldPosition(origin);
        else camera.getWorldPosition(origin);
        bullet.position.copy(origin);

        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const spread = 0.006 + WEAPON.currentRecoil * 0.12;
        direction.x += (Math.random() - 0.5) * spread;
        direction.y += (Math.random() - 0.5) * spread;
        direction.z += (Math.random() - 0.5) * spread * 0.25;
        direction.normalize();

        const trail = new THREE.Mesh(GEO.trail, MAT.trail);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.15;
        bullet.add(trail);

        bullet.userData = {
            direction,
            speed: 70,
            life: 1.4,
            damage: 18
        };

        scene.add(bullet);
        bullets.push(bullet);
        updateHUD();
    }

    function segmentHitsSphere(ax, ay, az, bx, by, bz, cx, cy, cz, radius) {
        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;
        const len2 = abx * abx + aby * aby + abz * abz;
        let t = len2 === 0 ? 0 : (acx * abx + acy * aby + acz * abz) / len2;
        t = Math.max(0, Math.min(1, t));
        const dx = ax + abx * t - cx;
        const dy = ay + aby * t - cy;
        const dz = az + abz * t - cz;
        return dx * dx + dy * dy + dz * dz <= radius * radius;
    }

    function updateBullets(delta) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const data = bullet.userData;
            const prevX = bullet.position.x;
            const prevY = bullet.position.y;
            const prevZ = bullet.position.z;
            const step = data.speed * delta;
            bullet.position.x += data.direction.x * step;
            bullet.position.y += data.direction.y * step;
            bullet.position.z += data.direction.z * step;
            data.life -= delta;

            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                const size = enemy.userData.size;
                const radius = Math.max(size[0], size[2]) * 0.62 + 0.12;
                const cy = size[1] * 0.55;
                if (segmentHitsSphere(
                    prevX, prevY, prevZ,
                    bullet.position.x, bullet.position.y, bullet.position.z,
                    enemy.position.x, cy, enemy.position.z,
                    radius
                )) {
                    enemy.userData.health -= data.damage;
                    enemy.userData.hitFlash = 0.16;
                    if (enemy.userData.type !== 'bomber') {
                        enemy.userData.coverUntil = performance.now() + 1400;
                    }
                    createParticles(bullet.position, 0xffee66, 4);
                    flashCrosshair();
                    if (enemy.userData.health <= 0) killEnemy(j);
                    else playSound('hit');
                    hit = true;
                    break;
                }
            }

            if (!hit) {
                ray.origin.set(prevX, prevY, prevZ);
                ray.direction.copy(data.direction);
                const travel = Math.hypot(
                    bullet.position.x - prevX,
                    bullet.position.y - prevY,
                    bullet.position.z - prevZ
                );
                for (let k = 0; k < wallBoxes.length; k++) {
                    const box = wallBoxes[k];
                    if (box.containsPoint(bullet.position)) {
                        hit = true;
                        break;
                    }
                    const point = ray.intersectBox(box, rayHit);
                    if (point && point.distanceTo(ray.origin) <= travel + 0.08) {
                        hit = true;
                        break;
                    }
                }
                if (hit) createParticles(bullet.position, 0x99aabb, 3);
            }

            if (hit || data.life <= 0 ||
                Math.abs(bullet.position.x) > 48 ||
                Math.abs(bullet.position.z) > 48 ||
                bullet.position.y < -1 || bullet.position.y > 12) {
                scene.remove(bullet);
                bullets.splice(i, 1);
            }
        }
    }

    function createParticles(position, color, count) {
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: 1
            });
            const particle = new THREE.Mesh(GEO.particle, mat);
            particle.position.copy(position);
            particle.userData = {
                vx: (Math.random() - 0.5) * 6,
                vy: Math.random() * 4 + 0.5,
                vz: (Math.random() - 0.5) * 6,
                life: 0.35 + Math.random() * 0.35
            };
            scene.add(particle);
            particles.push(particle);
        }
        if (particles.length > 180) {
            const extra = particles.length - 180;
            for (let i = 0; i < extra; i++) {
                const old = particles.shift();
                scene.remove(old);
                old.material.dispose();
            }
        }
    }

    function updateParticles(delta) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            const data = p.userData;
            data.vy -= 12 * delta;
            p.position.x += data.vx * delta;
            p.position.y += data.vy * delta;
            p.position.z += data.vz * delta;
            data.life -= delta;
            p.material.opacity = Math.max(0, data.life * 2.2);
            if (data.life <= 0) {
                scene.remove(p);
                p.material.dispose();
                particles.splice(i, 1);
            }
        }
    }

    function disposeObject(obj) {
        obj.traverse(child => {
            if (child.geometry && !child.geometry.userData.shared) child.geometry.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                if (mat && !mat.userData.shared) mat.dispose();
            });
        });
    }

    function fireEnemyShot(enemy) {
        const data = enemy.userData;
        const shot = new THREE.Mesh(GEO.bullet, MAT.enemyShot);
        shot.position.set(enemy.position.x, data.size[1] * 0.62, enemy.position.z);
        const dx = camera.position.x - shot.position.x;
        const dy = 1.3 - shot.position.y;
        const dz = camera.position.z - shot.position.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        shot.userData = {
            direction: new THREE.Vector3(dx / len, dy / len, dz / len),
            speed: 16,
            life: 2.4,
            damage: data.damage
        };
        scene.add(shot);
        enemyShots.push(shot);
        playSound('enemyShot');
        if (enemyShots.length > 40) {
            const old = enemyShots.shift();
            scene.remove(old);
        }
    }

    function updateEnemyShots(delta) {
        for (let i = enemyShots.length - 1; i >= 0; i--) {
            const shot = enemyShots[i];
            const data = shot.userData;
            const prevX = shot.position.x;
            const prevY = shot.position.y;
            const prevZ = shot.position.z;
            const step = data.speed * delta;
            shot.position.x += data.direction.x * step;
            shot.position.y += data.direction.y * step;
            shot.position.z += data.direction.z * step;
            data.life -= delta;

            let hit = segmentHitsSphere(
                prevX, prevY, prevZ,
                shot.position.x, shot.position.y, shot.position.z,
                camera.position.x, 1.3, camera.position.z,
                0.65
            );
            if (hit) {
                damagePlayer(data.damage);
                createParticles(shot.position, 0x66eeff, 4);
            } else {
                ray.origin.set(prevX, prevY, prevZ);
                ray.direction.copy(data.direction);
                const travel = Math.hypot(
                    shot.position.x - prevX,
                    shot.position.y - prevY,
                    shot.position.z - prevZ
                );
                for (let k = 0; k < wallBoxes.length; k++) {
                    if (wallBoxes[k].containsPoint(shot.position) ||
                        (ray.intersectBox(wallBoxes[k], rayHit) &&
                         rayHit.distanceTo(ray.origin) <= travel + 0.08)) {
                        hit = true;
                        break;
                    }
                }
            }

            if (hit || data.life <= 0 || Math.abs(shot.position.x) > 48 || Math.abs(shot.position.z) > 48) {
                scene.remove(shot);
                enemyShots.splice(i, 1);
            }
        }
    }

    function bomberBlast(position, damage) {
        createParticles(position.clone().setY(0.8), 0x44ee66, 10);
        createParticles(position.clone().setY(0.8), 0xff7722, 8);
        playSound('boom');
        const dist = Math.hypot(camera.position.x - position.x, camera.position.z - position.z);
        if (dist < 3.2) {
            damagePlayer(Math.max(6, Math.round(damage * (1 - dist / 3.4))));
        }
    }

    function killEnemy(index) {
        const enemy = enemies[index];
        if (!enemy) return;
        const data = enemy.userData;
        const color = data.type === 'tank' ? 0x8844ff
            : data.type === 'shooter' ? 0x33ddff
            : data.type === 'bomber' ? 0x44ee66
            : data.type === 'fast' ? 0xffaa00
            : 0xff4444;
        if (data.type === 'bomber') bomberBlast(enemy.position, data.damage);
        createParticles(enemy.position.clone().setY(data.size[1] * 0.5), color, 12);
        PLAYER.score += data.scoreValue;
        rememberScore();
        if (data.type !== 'bomber') playSound('kill');
        scene.remove(enemy);
        disposeObject(enemy);
        enemies.splice(index, 1);
        waveConfig.enemiesAlive = Math.max(0, waveConfig.enemiesAlive - 1);

        if (!waveConfig.waveComplete &&
            waveConfig.enemiesSpawned >= waveConfig.enemiesPerWave &&
            waveConfig.enemiesAlive <= 0) {
            completeWave();
        }
        updateHUD();
    }

    function completeWave() {
        waveConfig.waveComplete = true;
        waveConfig.waveDelay = 2200;
        PLAYER.wave++;
        waveConfig.enemiesPerWave = 4 + PLAYER.wave * 2;
        waveConfig.spawnInterval = Math.max(650, 1900 - PLAYER.wave * 90);
        PLAYER.health = Math.min(PLAYER.maxHealth, PLAYER.health + 12);
        rememberWave();
        announceWave(PLAYER.wave);
        playSound('wave');
        updateHUD();
    }

    function updateWaveSystem(delta) {
        if (waveConfig.waveComplete) {
            waveConfig.waveDelay -= delta * 1000;
            if (waveConfig.waveDelay <= 0) {
                waveConfig.waveComplete = false;
                waveConfig.enemiesSpawned = 0;
                waveConfig.enemiesAlive = enemies.length;
                waveConfig.spawnTimer = 200;
            }
            return;
        }

        waveConfig.spawnTimer -= delta * 1000;
        if (waveConfig.spawnTimer <= 0 &&
            waveConfig.enemiesSpawned < waveConfig.enemiesPerWave) {
            spawnEnemy();
            waveConfig.spawnTimer = waveConfig.spawnInterval;
        }
    }

    function damagePlayer(amount) {
        if (gameState !== STATE.PLAYING) return;
        PLAYER.health = Math.max(0, PLAYER.health - amount);
        dom.damageFlash.classList.add('show');
        setTimeout(() => dom.damageFlash.classList.remove('show'), 140);
        playSound('damage');
        updateHUD();
        if (PLAYER.health <= 0) gameOver();
    }

    function reload() {
        if (WEAPON.reloading || WEAPON.ammo === WEAPON.maxAmmo) return;
        WEAPON.reloading = true;
        const token = ++reloadToken;
        dom.reloadIndicator.classList.add('show');
        playSound('reload');
        setTimeout(() => {
            if (token !== reloadToken) return;
            WEAPON.ammo = WEAPON.maxAmmo;
            WEAPON.reloading = false;
            dom.reloadIndicator.classList.remove('show');
            updateHUD();
        }, WEAPON.reloadTime);
    }

    function setupEventListeners() {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', () => { mouseDown = false; });
        document.addEventListener('contextmenu', event => event.preventDefault());

        dom.startBtn.addEventListener('click', startGame);
        dom.restartBtn.addEventListener('click', restartGame);
        if (dom.muteBtn) dom.muteBtn.addEventListener('click', toggleMusic);
        if (dom.pauseBtn) dom.pauseBtn.addEventListener('click', togglePause);
        if (dom.resumeBtn) dom.resumeBtn.addEventListener('click', togglePause);
        if (dom.sprintBtn) {
            const startSprint = event => {
                event.preventDefault();
                sprintHeld = true;
                dom.sprintBtn.classList.add('held');
            };
            const endSprint = event => {
                event.preventDefault();
                sprintHeld = false;
                dom.sprintBtn.classList.remove('held');
            };
            dom.sprintBtn.addEventListener('touchstart', startSprint, { passive: false });
            dom.sprintBtn.addEventListener('touchend', endSprint, { passive: false });
            dom.sprintBtn.addEventListener('touchcancel', endSprint, { passive: false });
            dom.sprintBtn.addEventListener('mousedown', startSprint);
            window.addEventListener('mouseup', () => {
                if (!sprintHeld) return;
                sprintHeld = false;
                if (dom.sprintBtn) dom.sprintBtn.classList.remove('held');
            });
        }
        setupTouchControls();

    }

    function onKeyDown(event) {
        keys[event.code] = true;
        if (event.code === 'KeyR' && gameState === STATE.PLAYING) reload();
        if (event.code === 'KeyM') toggleMusic();
        if (event.code === 'Escape' || event.code === 'KeyP') {
            event.preventDefault();
            togglePause();
        }
    }

    function onKeyUp(event) {
        keys[event.code] = false;
    }

    function onMouseDown() {
        if (gameState !== STATE.PLAYING) return;
        if (!controls.isLocked) controls.lock();
        mouseDown = true;
    }

    function setupTouchControls() {
        let joystickActive = false;
        let joystickId = null;
        let joystickStartX = 0;
        let joystickStartY = 0;
        let lookTouchId = null;
        let lookStartX = 0;
        let lookStartY = 0;

        dom.joystickZone.addEventListener('touchstart', event => {
            event.preventDefault();
            const touch = event.changedTouches[0];
            joystickActive = true;
            joystickId = touch.identifier;
            joystickStartX = touch.clientX;
            joystickStartY = touch.clientY;
        }, { passive: false });

        dom.joystickZone.addEventListener('touchmove', event => {
            event.preventDefault();
            if (!joystickActive) return;
            const touch = Array.from(event.changedTouches).find(t => t.identifier === joystickId);
            if (!touch) return;
            const deltaX = touch.clientX - joystickStartX;
            const deltaY = touch.clientY - joystickStartY;
            const maxDist = 48;
            const dist = Math.hypot(deltaX, deltaY) || 1;
            const scale = dist > maxDist ? maxDist / dist : 1;
            joystickDeltaX = deltaX * scale;
            joystickDeltaY = deltaY * scale;
            dom.joystickThumb.style.transform =
                `translate(calc(-50% + ${joystickDeltaX}px), calc(-50% + ${joystickDeltaY}px))`;
        }, { passive: false });

        function endJoystick(event) {
            event.preventDefault();
            joystickActive = false;
            joystickId = null;
            joystickDeltaX = 0;
            joystickDeltaY = 0;
            dom.joystickThumb.style.transform = 'translate(-50%, -50%)';
        }
        dom.joystickZone.addEventListener('touchend', endJoystick, { passive: false });
        dom.joystickZone.addEventListener('touchcancel', endJoystick, { passive: false });

        dom.lookZone.addEventListener('touchstart', event => {
            event.preventDefault();
            const touch = event.changedTouches[0];
            lookTouchId = touch.identifier;
            lookStartX = touch.clientX;
            lookStartY = touch.clientY;
        }, { passive: false });

        dom.lookZone.addEventListener('touchmove', event => {
            event.preventDefault();
            const touch = Array.from(event.changedTouches).find(t => t.identifier === lookTouchId);
            if (!touch || gameState !== STATE.PLAYING) return;
            const deltaX = touch.clientX - lookStartX;
            const deltaY = touch.clientY - lookStartY;
            const sensitivity = 0.0045;
            camera.rotation.order = 'YXZ';
            camera.rotation.y -= deltaX * sensitivity;
            camera.rotation.x -= deltaY * sensitivity;
            camera.rotation.x = Math.max(-1.2, Math.min(1.2, camera.rotation.x));
            lookStartX = touch.clientX;
            lookStartY = touch.clientY;
        }, { passive: false });

        function endLook(event) {
            event.preventDefault();
            lookTouchId = null;
        }
        dom.lookZone.addEventListener('touchend', endLook, { passive: false });
        dom.lookZone.addEventListener('touchcancel', endLook, { passive: false });

        dom.fireBtn.addEventListener('touchstart', event => {
            event.preventDefault();
            touchFirePressed = true;
            dom.fireBtn.style.background = 'rgba(255,50,50,0.5)';
        }, { passive: false });

        function endFire(event) {
            event.preventDefault();
            touchFirePressed = false;
            dom.fireBtn.style.background = 'rgba(255,50,50,0.3)';
        }
        dom.fireBtn.addEventListener('touchend', endFire, { passive: false });
        dom.fireBtn.addEventListener('touchcancel', endFire, { passive: false });
    }

    function applyViewportBox() {
        const view = viewportSize();
        const root = document.documentElement;
        root.style.setProperty('--app-width', view.width + 'px');
        root.style.setProperty('--app-height', view.height + 'px');
        root.style.setProperty('--app-top', view.top + 'px');
        root.style.setProperty('--app-left', view.left + 'px');
        if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
        return view;
    }

    function onWindowResize() {
        const view = applyViewportBox();
        if (!camera || !renderer) return;
        camera.aspect = view.width / view.height;
        camera.updateProjectionMatrix();
        const phone = document.documentElement.classList.contains('touch-ui');
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
        renderer.setSize(view.width, view.height, false);
        renderer.domElement.style.width = view.width + 'px';
        renderer.domElement.style.height = view.height + 'px';
        updateWeaponAnchor();
    }

    markTouchUI();
    applyViewportBox();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onWindowResize);
        window.visualViewport.addEventListener('scroll', onWindowResize);
    }

    function clearActors() {
        enemies.forEach(enemy => {
            scene.remove(enemy);
            disposeObject(enemy);
        });
        bullets.forEach(bullet => scene.remove(bullet));
        particles.forEach(particle => {
            scene.remove(particle);
            particle.material.dispose();
        });
        enemyShots.forEach(shot => scene.remove(shot));
        enemies = [];
        bullets = [];
        particles = [];
        enemyShots = [];
    }

    function startGame() {
        initAudio();
        dom.startScreen.style.display = 'none';
        dom.gameOver.style.display = 'none';
        document.body.classList.add('playing');
        gameState = STATE.PLAYING;

        PLAYER.health = PLAYER.maxHealth;
        PLAYER.score = 0;
        PLAYER.wave = 1;
        WEAPON.ammo = WEAPON.maxAmmo;
        WEAPON.reloading = false;
        WEAPON.currentRecoil = 0;
        WEAPON.lastShot = 0;
        reloadToken++;
        newBestThisRun = false;
        sprintHeld = false;
        STAMINA.current = STAMINA.max;
        STAMINA.regenDelay = 0;
        if (dom.pauseScreen) dom.pauseScreen.style.display = 'none';
        if (dom.sprintBtn) dom.sprintBtn.classList.remove('held');
        dom.reloadIndicator.classList.remove('show');

        clearActors();
        waveConfig = {
            enemiesPerWave: 5,
            spawnInterval: 1600,
            spawnTimer: 400,
            enemiesSpawned: 0,
            enemiesAlive: 0,
            waveComplete: false,
            waveDelay: 2200
        };

        camera.position.set(0, 1.7, 0);
        camera.rotation.set(0, 0, 0);
        camera.rotation.order = 'YXZ';
        createWeapon();
        onWindowResize();
        try { controls.lock(); } catch (err) {}
        startMusic();
        updateHUD();
        announceWave(1);
    }

    function togglePause() {
        if (gameState === STATE.PLAYING) {
            gameState = STATE.PAUSED;
            mouseDown = false;
            touchFirePressed = false;
            sprintHeld = false;
            if (dom.sprintBtn) dom.sprintBtn.classList.remove('held');
            if (controls.isLocked) controls.unlock();
            if (dom.pauseScreen) dom.pauseScreen.style.display = 'flex';
            return;
        }
        if (gameState !== STATE.PAUSED) return;
        gameState = STATE.PLAYING;
        if (dom.pauseScreen) dom.pauseScreen.style.display = 'none';
    }

    function restartGame() {
        startGame();
    }

    function gameOver() {
        if (gameState === STATE.GAME_OVER) return;
        gameState = STATE.GAME_OVER;
        document.body.classList.remove('playing');
        mouseDown = false;
        touchFirePressed = false;
        const waveBeat = rememberWave();
        rememberScore();
        if (controls.isLocked) controls.unlock();
        sprintHeld = false;
        if (dom.pauseScreen) dom.pauseScreen.style.display = 'none';
        dom.finalScore.textContent = `Score ${PLAYER.score}  ·  Wave ${PLAYER.wave}`;
        if (dom.finalBest) {
            dom.finalBest.textContent = newBestThisRun
                ? `New best: ${highScore}`
                : waveBeat
                    ? `Best wave: ${bestWave}`
                    : `Best: ${highScore}`;
        }
        dom.gameOver.style.display = 'flex';
        updateScoreLabels();
    }

    function announceWave(wave) {
        dom.waveAnnounce.textContent = wave === 1 ? 'WAVE 1' : `WAVE ${wave}`;
        dom.waveAnnounce.classList.add('show');
        setTimeout(() => dom.waveAnnounce.classList.remove('show'), 1600);
    }

    function flashCrosshair() {
        if (!dom.crosshair) return;
        dom.crosshair.classList.add('hit');
        setTimeout(() => dom.crosshair.classList.remove('hit'), 80);
    }

    function updateScoreLabels() {
        const label = bestWave ? `Best ${highScore} · W${bestWave}` : `Best ${highScore}`;
        if (dom.bestValue) dom.bestValue.textContent = label;
        if (dom.menuBest) {
            const bits = [];
            if (highScore) bits.push(`Best score: ${highScore}`);
            if (bestWave) bits.push(`Best wave: ${bestWave}`);
            dom.menuBest.textContent = bits.join(' · ');
        }
    }

    function updateHUD() {
        const health = Math.max(0, Math.round(PLAYER.health));
        dom.healthValue.textContent = health;
        dom.healthBar.style.width = `${(PLAYER.health / PLAYER.maxHealth) * 100}%`;
        if (PLAYER.health < 30) {
            dom.healthBar.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
        } else if (PLAYER.health < 60) {
            dom.healthBar.style.background = 'linear-gradient(90deg, #ff8800, #ffaa44)';
        } else {
            dom.healthBar.style.background = 'linear-gradient(90deg, #3dff7a, #7dff9a)';
        }

        dom.scoreValue.textContent = PLAYER.score;
        dom.waveValue.textContent = PLAYER.wave;
        dom.ammoValue.textContent = WEAPON.reloading ? '...' : `${WEAPON.ammo}/${WEAPON.maxAmmo}`;
        dom.ammoBar.style.width = `${(WEAPON.ammo / WEAPON.maxAmmo) * 100}%`;
        dom.ammoBar.style.background = WEAPON.ammo <= 5
            ? 'linear-gradient(90deg, #ff0000, #ff4444)'
            : 'linear-gradient(90deg, #ffaa00, #ffcc44)';
        updateScoreLabels();
    }

    function blocked(x, z) {
        playerBox.min.set(x - 0.4, 0.15, z - 0.4);
        playerBox.max.set(x + 0.4, 1.7, z + 0.4);
        for (let i = 0; i < wallBoxes.length; i++) {
            if (wallBoxes[i].intersectsBox(playerBox)) return true;
        }
        return false;
    }

    function updatePlayerMovement(delta) {
        if (gameState !== STATE.PLAYING) return;

        const wantsSprint = (keys['ShiftLeft'] || keys['ShiftRight'] || sprintHeld) &&
            (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'] ||
             keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] ||
             joystickDeltaX !== 0 || joystickDeltaY !== 0) &&
            STAMINA.current > 1;
        let sprintMul = 1;
        if (wantsSprint) {
            sprintMul = 1.65;
            STAMINA.current = Math.max(0, STAMINA.current - delta * 36);
            STAMINA.regenDelay = 0.5;
        } else {
            STAMINA.regenDelay = Math.max(0, STAMINA.regenDelay - delta);
            if (STAMINA.regenDelay === 0) {
                STAMINA.current = Math.min(STAMINA.max, STAMINA.current + delta * 24);
            }
        }
        if (dom.staminaBar) {
            dom.staminaBar.style.width = `${(STAMINA.current / STAMINA.max) * 100}%`;
        }

        const speed = PLAYER.speed * sprintMul * delta;
        let inputX = 0;
        let inputZ = 0;
        if (keys['KeyW'] || keys['ArrowUp']) inputZ += 1;
        if (keys['KeyS'] || keys['ArrowDown']) inputZ -= 1;
        if (keys['KeyA'] || keys['ArrowLeft']) inputX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) inputX += 1;
        if (joystickDeltaX !== 0 || joystickDeltaY !== 0) {
            inputX += joystickDeltaX / 48;
            inputZ += -joystickDeltaY / 48;
        }

        const len = Math.hypot(inputX, inputZ);
        WEAPON.bobMoving = len > 0.08;
        if (len > 0) {
            inputX /= len;
            inputZ /= len;

            camera.getWorldDirection(moveDir);
            moveDir.y = 0;
            if (moveDir.lengthSq() < 0.0001) moveDir.set(0, 0, -1);
            moveDir.normalize();
            const rightX = -moveDir.z;
            const rightZ = moveDir.x;
            const moveX = (moveDir.x * inputZ + rightX * inputX) * speed;
            const moveZ = (moveDir.z * inputZ + rightZ * inputX) * speed;

            const nextX = Math.max(-36.5, Math.min(36.5, camera.position.x + moveX));
            const nextZ = Math.max(-36.5, Math.min(36.5, camera.position.z + moveZ));
            if (!blocked(nextX, nextZ)) {
                camera.position.x = nextX;
                camera.position.z = nextZ;
            } else if (!blocked(nextX, camera.position.z)) {
                camera.position.x = nextX;
            } else if (!blocked(camera.position.x, nextZ)) {
                camera.position.z = nextZ;
            }
        }

        camera.position.y = 1.7;

        if (mouseDown || touchFirePressed) shoot();
        if (WEAPON.ammo === 0 && !WEAPON.reloading) reload();

        if (WEAPON.currentRecoil > 0) {
            WEAPON.currentRecoil *= Math.pow(WEAPON.recoilRecovery, delta * 60);
            if (WEAPON.currentRecoil < 0.001) WEAPON.currentRecoil = 0;
        }

        if (weaponGroup) {
            WEAPON.bobTime += delta * (WEAPON.bobMoving ? 9.5 : 1.4);
            const amp = WEAPON.bobMoving ? 1 : 0.25;
            weaponGroup.position.x = weaponAnchor.x + Math.cos(WEAPON.bobTime * 0.5) * 0.012 * amp;
            weaponGroup.position.y = weaponAnchor.y + Math.sin(WEAPON.bobTime) * 0.014 * amp;
            weaponGroup.position.z = weaponAnchor.z + WEAPON.currentRecoil * 0.35;
            weaponGroup.scale.setScalar(weaponAnchor.scale);
            weaponGroup.rotation.x = -WEAPON.currentRecoil * 4.5;
        }

        const flash = muzzleFlashes[0];
        if (flash && flash.material.opacity > 0) {
            flash.material.opacity *= 0.45;
            flash.scale.multiplyScalar(0.86);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.05);
        if (gameState === STATE.PLAYING) {
            updatePlayerMovement(delta);
            updateEnemies(delta);
            updateBullets(delta);
            updateEnemyShots(delta);
            updateParticles(delta);
            updateWaveSystem(delta);
        }
        renderer.render(scene, camera);
    }

    try {
        init();
    } catch (err) {
        console.error(err);
        const screen = document.getElementById('start-screen');
        if (screen) {
            const note = document.createElement('p');
            note.textContent = 'Game failed to start. ' + (err && err.message ? err.message : 'Refresh and try again.');
            screen.appendChild(note);
        }
    }
})();
