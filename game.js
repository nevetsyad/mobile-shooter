// ============================================================
// SARA GOES TO WORK - Phase 2: Combat
// Weapons, enemies, waves, ammo, reload, collisions, sound
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
    let arena;
    let clock;

    // Player stats
    const PLAYER = {
        health: 100,
        maxHealth: 100,
        speed: 10,
        score: 0,
        wave: 1
    };

    // Weapon system
    const WEAPON = {
        maxAmmo: 30,
        ammo: 30,
        fireRate: 100,       // ms between shots
        lastShot: 0,
        reloading: false,
        reloadTime: 2000,    // ms
        recoil: 0.02,
        recoilRecovery: 0.95,
        currentRecoil: 0
    };

    // Enemies
    let enemies = [];
    let bullets = [];
    let particles = [];
    let muzzleFlashes = [];

    // Wave system
    let waveConfig = {
        enemiesPerWave: 5,
        spawnInterval: 2000,
        spawnTimer: 0,
        enemiesSpawned: 0,
        enemiesAlive: 0,
        waveComplete: false,
        waveDelay: 3000
    };

    // Input
    const keys = {};
    let joystickDeltaX = 0;
    let joystickDeltaY = 0;
    let touchFirePressed = false;

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

    // ---- Audio System ----
    let audioCtx;

    function initAudio() {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    function playSound(type) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        switch(type) {
            case 'shoot':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            case 'hit':
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            case 'kill':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'reload':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.setValueAtTime(600, now + 0.1);
                osc.frequency.setValueAtTime(1000, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'damage':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
                break;
            case 'wave':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.setValueAtTime(500, now + 0.1);
                osc.frequency.setValueAtTime(600, now + 0.2);
                osc.frequency.setValueAtTime(800, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
        }
    }

    // ---- Initialize Game ----
    function init() {
        clock = new THREE.Clock();

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        scene.fog = new THREE.Fog(0x1a1a2e, 20, 80);

        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            200
        );
        camera.position.set(0, 2, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        dom.container.appendChild(renderer.domElement);

        controls = new THREE.PointerLockControls(camera, document.body);
        controls.addEventListener('lock', () => {});
        controls.addEventListener('unlock', () => {});

        setupLighting();
        arena = createArena();
        setupEventListeners();
        animate();
    }

    // ---- Lighting ----
    function setupLighting() {
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0x606080, 0x202040, 0.4);
        scene.add(hemi);

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

        [[0, wallHeight/2, -40, [80, wallHeight, wallThickness]],
         [0, wallHeight/2, 40, [80, wallHeight, wallThickness]],
         [-40, wallHeight/2, 0, [wallThickness, wallHeight, 80]],
         [40, wallHeight/2, 0, [wallThickness, wallHeight, 80]]].forEach(config => {
            const geo = new THREE.BoxGeometry(...config[3]);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(config[0], config[1], config[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
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
            const geo = new THREE.BoxGeometry(...config[3]);
            const mesh = new THREE.Mesh(geo, obstacleMat);
            mesh.position.set(config[0], config[1], config[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            walls.push(mesh);
        });

        scene.add(group);
        return { group, walls };
    }

    // ---- Weapon Model ----
    let weaponGroup;

    function createWeapon() {
        weaponGroup = new THREE.Group();

        // Gun body
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x333333, roughness: 0.3, metalness: 0.8
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, -0.2);
        weaponGroup.add(body);

        // Barrel
        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
            color: 0x222222, roughness: 0.2, metalness: 0.9
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.5);
        weaponGroup.add(barrel);

        // Handle
        const handleGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
        const handleMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a, roughness: 0.5, metalness: 0.5
        });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.set(0, -0.08, -0.1);
        handle.rotation.x = 0.2;
        weaponGroup.add(handle);

        // Muzzle flash
        const flashGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00, transparent: true, opacity: 0
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.set(0, 0.02, -0.6);
        flash.name = 'muzzleFlash';
        weaponGroup.add(flash);
        muzzleFlashes.push(flash);

        weaponGroup.position.set(0.25, -0.2, -0.5);
        camera.add(weaponGroup);
        scene.add(camera);
    }

    // ---- Enemy System ----
    function createEnemy(type) {
        const enemy = new THREE.Group();
        let health, speed, damage, scoreValue, size, color;

        switch(type) {
            case 'grunt':
                health = 30; speed = 3; damage = 10; scoreValue = 100;
                size = [0.8, 1.6, 0.8]; color = 0xff4444;
                break;
            case 'fast':
                health = 20; speed = 6; damage = 8; scoreValue = 150;
                size = [0.6, 1.2, 0.6]; color = 0xffaa00;
                break;
            case 'tank':
                health = 80; speed = 1.5; damage = 20; scoreValue = 300;
                size = [1.2, 2.2, 1.2]; color = 0x8844ff;
                break;
            default:
                health = 30; speed = 3; damage = 10; scoreValue = 100;
                size = [0.8, 1.6, 0.8]; color = 0xff4444;
        }

        // Body
        const bodyGeo = new THREE.BoxGeometry(...size);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: color, roughness: 0.5, metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = size[1] / 2;
        body.castShadow = true;
        enemy.add(body);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.15, size[1] * 0.7, size[2] / 2 + 0.05);
        enemy.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.15, size[1] * 0.7, size[2] / 2 + 0.05);
        enemy.add(eyeR);

        // Pupils
        const pupilGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
        pupilL.position.set(-0.15, size[1] * 0.7, size[2] / 2 + 0.12);
        enemy.add(pupilL);
        const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
        pupilR.position.set(0.15, size[1] * 0.7, size[2] / 2 + 0.12);
        enemy.add(pupilR);

        // Spawn position (random edge of arena)
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 5;
        enemy.position.x = Math.cos(angle) * dist;
        enemy.position.z = Math.sin(angle) * dist;
        enemy.position.y = 0;

        enemy.userData = {
            type, health, maxHealth: health, speed, damage,
            scoreValue, size, attackCooldown: 0, attackRate: 1000,
            state: 'chase', hitFlash: 0
        };

        scene.add(enemy);
        enemies.push(enemy);
        waveConfig.enemiesAlive++;

        return enemy;
    }

    function spawnEnemy() {
        const types = ['grunt', 'grunt', 'grunt', 'fast', 'tank'];
        if (PLAYER.wave >= 3) types.push('tank', 'tank');
        if (PLAYER.wave >= 5) types.push('fast', 'fast');

        const type = types[Math.floor(Math.random() * types.length)];
        createEnemy(type);
        waveConfig.enemiesSpawned++;
    }

    function updateEnemies(delta) {
        const playerPos = camera.position.clone();
        playerPos.y = 0;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const data = enemy.userData;

            // Face player
            const enemyPos = enemy.position.clone();
            enemyPos.y = 0;
            const direction = new THREE.Vector3().subVectors(playerPos, enemyPos);
            direction.y = 0;
            direction.normalize();

            enemy.lookAt(new THREE.Vector3(
                playerPos.x, enemy.position.y, playerPos.z
            ));

            // Chase player
            if (data.state === 'chase') {
                const dist = enemyPos.distanceTo(playerPos);
                if (dist > 2) {
                    const moveSpeed = data.speed * delta;
                    enemy.position.x += direction.x * moveSpeed;
                    enemy.position.z += direction.z * moveSpeed;
                }

                // Attack player
                if (dist < 2.5) {
                    data.attackCooldown -= delta * 1000;
                    if (data.attackCooldown <= 0) {
                        damagePlayer(data.damage);
                        data.attackCooldown = data.attackRate;
                        playSound('hit');
                    }
                }
            }

            // Hit flash effect
            if (data.hitFlash > 0) {
                data.hitFlash -= delta;
                enemy.children[0].material.emissive.setHex(0xffffff);
                enemy.children[0].material.emissiveIntensity = data.hitFlash * 5;
            } else {
                enemy.children[0].material.emissive.setHex(0x000000);
                enemy.children[0].material.emissiveIntensity = 0;
            }

            // Keep in bounds
            enemy.position.x = Math.max(-38, Math.min(38, enemy.position.x));
            enemy.position.z = Math.max(-38, Math.min(38, enemy.position.z));

            // Simple obstacle avoidance (very basic)
            arena.walls.forEach(wall => {
                const wallBox = new THREE.Box3().setFromObject(wall);
                const enemyBox = new THREE.Box3().setFromObject(enemy);
                if (wallBox.intersectsBox(enemyBox)) {
                    // Push enemy away from wall
                    const pushDir = new THREE.Vector3().subVectors(
                        enemyPos, wall.position
                    ).normalize();
                    enemy.position.x += pushDir.x * delta * 5;
                    enemy.position.z += pushDir.z * delta * 5;
                }
            });
        }
    }

    // ---- Bullet System ----
    function shoot() {
        if (WEAPON.reloading || WEAPON.ammo <= 0) {
            if (WEAPON.ammo <= 0 && !WEAPON.reloading) {
                reload();
            }
            return;
        }

        const now = performance.now();
        if (now - WEAPON.lastShot < WEAPON.recoil) return;
        if (now - WEAPON.lastShot < WEAPON.fireRate) return;

        WEAPON.lastShot = now;
        WEAPON.ammo--;

        // Recoil
        WEAPON.currentRecoil += WEAPON.recoil;
        camera.rotation.x += WEAPON.currentRecoil;

        // Muzzle flash
        const flash = muzzleFlashes[0];
        flash.material.opacity = 1;
        flash.scale.set(2, 2, 2);

        playSound('shoot');

        // Create bullet
        const bulletGeo = new THREE.SphereGeometry(0.05, 6, 6);
        const bulletMat = new THREE.MeshBasicMaterial({
            color: 0xffff00
        });
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);

        // Start at weapon position
        const weaponWorldPos = new THREE.Vector3();
        flash.getWorldPosition(weaponWorldPos);
        bullet.position.copy(weaponWorldPos);

        // Direction from camera
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        bullet.userData = {
            direction: direction.clone(),
            speed: 50,
            life: 2,
            damage: 15
        };

        // Trail effect
        const trailGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
        const trailMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00, transparent: true, opacity: 0.5
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.15;
        bullet.add(trail);

        scene.add(bullet);
        bullets.push(bullet);

        updateHUD();
    }

    function updateBullets(delta) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const data = bullet.userData;

            // Move bullet
            const moveDist = data.speed * delta;
            bullet.position.add(data.direction.clone().multiplyScalar(moveDist));
            bullet.lookAt(bullet.position.clone().add(data.direction));

            data.life -= delta;

            // Check enemy collisions
            let hitEnemy = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                const dist = bullet.position.distanceTo(enemy.position);
                const hitDist = enemy.userData.size[1] / 2 + 0.1;

                if (dist < hitDist) {
                    // Hit!
                    enemy.userData.health -= data.damage;
                    enemy.userData.hitFlash = 0.2;

                    // Create hit particles
                    createParticles(bullet.position.clone(), 0xffff00, 5);

                    if (enemy.userData.health <= 0) {
                        // Enemy killed
                        killEnemy(j);
                    } else {
                        playSound('hit');
                    }

                    hitEnemy = true;
                    break;
                }
            }

            // Check wall collisions
            if (!hitEnemy) {
                for (let k = 0; k < arena.walls.length; k++) {
                    const wallBox = new THREE.Box3().setFromObject(arena.walls[k]);
                    if (wallBox.containsPoint(bullet.position)) {
                        createParticles(bullet.position.clone(), 0x888888, 3);
                        hitEnemy = true;
                        break;
                    }
                }
            }

            // Remove if hit, expired, or out of bounds
            if (hitEnemy || data.life <= 0 ||
                Math.abs(bullet.position.x) > 50 ||
                Math.abs(bullet.position.z) > 50) {
                scene.remove(bullet);
                bullets.splice(i, 1);
            }
        }
    }

    // ---- Particle System ----
    function createParticles(position, color, count) {
        for (let i = 0; i < count; i++) {
            const geo = new THREE.SphereGeometry(0.03, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: color, transparent: true, opacity: 1
            });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(position);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 3,
                (Math.random() - 0.5) * 5
            );

            particle.userData = {
                velocity, life: 0.5 + Math.random() * 0.5
            };

            scene.add(particle);
            particles.push(particle);
        }
    }

    function updateParticles(delta) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            const data = p.userData;

            data.velocity.y -= 9.8 * delta; // gravity
            p.position.add(data.velocity.clone().multiplyScalar(delta));
            data.life -= delta;
            p.material.opacity = data.life * 2;

            if (data.life <= 0) {
                scene.remove(p);
                particles.splice(i, 1);
            }
        }
    }

    // ---- Kill Enemy ----
    function killEnemy(index) {
        const enemy = enemies[index];
        const data = enemy.userData;

        // Explosion particles
        createParticles(enemy.position.clone(), 0xff4444, 15);
        createParticles(enemy.position.clone(), 0xffaa00, 10);

        // Score
        PLAYER.score += data.scoreValue;

        playSound('kill');

        // Remove enemy
        scene.remove(enemy);
        enemies.splice(index, 1);
        waveConfig.enemiesAlive--;

        // Check wave completion
        if (waveConfig.enemiesSpawned >= waveConfig.enemiesPerWave &&
            waveConfig.enemiesAlive <= 0) {
            completeWave();
        }

        updateHUD();
    }

    // ---- Wave System ----
    function completeWave() {
        PLAYER.wave++;
        waveConfig.enemiesPerWave = 5 + PLAYER.wave * 2;
        waveConfig.enemiesSpawned = 0;
        waveConfig.enemiesAlive = 0;
        waveConfig.waveComplete = false;
        waveConfig.spawnTimer = 0;

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
                waveConfig.enemiesAlive = 0;
                waveConfig.spawnTimer = 0;
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

    // ---- Player Damage ----
    function damagePlayer(amount) {
        PLAYER.health -= amount;
        PLAYER.health = Math.max(0, PLAYER.health);

        // Damage flash
        dom.damageFlash.classList.add('show');
        setTimeout(() => dom.damageFlash.classList.remove('show'), 150);

        playSound('damage');
        updateHUD();

        if (PLAYER.health <= 0) {
            gameOver();
        }
    }

    // ---- Reload ----
    function reload() {
        if (WEAPON.reloading || WEAPON.ammo === WEAPON.maxAmmo) return;

        WEAPON.reloading = true;
        dom.reloadIndicator.classList.add('show');
        playSound('reload');

        setTimeout(() => {
            WEAPON.ammo = WEAPON.maxAmmo;
            WEAPON.reloading = false;
            dom.reloadIndicator.classList.remove('show');
            updateHUD();
        }, WEAPON.reloadTime);
    }

    // ---- Event Listeners ----
    function setupEventListeners() {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);

        dom.startBtn.addEventListener('click', startGame);
        dom.restartBtn.addEventListener('click', restartGame);

        setupTouchControls();
        window.addEventListener('resize', onWindowResize);
    }

    function onKeyDown(event) {
        keys[event.code] = true;
        if (event.code === 'KeyR' && gameState === STATE.PLAYING) {
            reload();
        }
    }

    function onKeyUp(event) {
        keys[event.code] = false;
    }

    function onMouseMove(event) {
        // Mouse look handled by PointerLockControls
    }

    let mouseDown = false;
    function onMouseDown(event) {
        if (gameState === STATE.PLAYING && !controls.isLocked) {
            controls.lock();
        } else if (gameState === STATE.PLAYING && controls.isLocked) {
            mouseDown = true;
        }
    }

    document.addEventListener('mouseup', () => {
        mouseDown = false;
    });

    // ---- Touch Controls ----
    function setupTouchControls() {
        let joystickActive = false;
        let joystickStartX = 0, joystickStartY = 0;
        let lookTouchId = null;
        let lookStartX = 0, lookStartY = 0;

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
            const touch = Array.from(e.changedTouches).find(
                t => t.identifier === e.changedTouches[0].identifier
            );
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

            dom.joystickThumb.style.transform =
                `translate(calc(-50% + ${joystickDeltaX}px), calc(-50% + ${joystickDeltaY}px))`;
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
            const touch = Array.from(e.changedTouches).find(
                t => t.identifier === lookTouchId
            );
            if (!touch) return;

            const deltaX = touch.clientX - lookStartX;
            const deltaY = touch.clientY - lookStartY;

            if (gameState === STATE.PLAYING && controls.isLocked) {
                const sensitivity = 0.002;
                camera.rotation.y -= deltaX * sensitivity;
                camera.rotation.x -= deltaY * sensitivity;
                camera.rotation.x = Math.max(-Math.PI/2,
                    Math.min(Math.PI/2, camera.rotation.x));
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
            touchFirePressed = true;
            dom.fireBtn.style.background = 'rgba(255,50,50,0.5)';
        });

        dom.fireBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            touchFirePressed = false;
            dom.fireBtn.style.background = 'rgba(255,50,50,0.3)';
        });
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ---- Game Flow ----
    function startGame() {
        initAudio();
        dom.startScreen.style.display = 'none';
        gameState = STATE.PLAYING;

        // Reset
        PLAYER.health = PLAYER.maxHealth;
        PLAYER.score = 0;
        PLAYER.wave = 1;

        WEAPON.ammo = WEAPON.maxAmmo;
        WEAPON.reloading = false;

        // Clear enemies and bullets
        enemies.forEach(e => scene.remove(e));
        bullets.forEach(b => scene.remove(b));
        particles.forEach(p => scene.remove(p));
        enemies = [];
        bullets = [];
        particles = [];

        // Reset wave
        waveConfig.enemiesPerWave = 5;
        waveConfig.enemiesSpawned = 0;
        waveConfig.enemiesAlive = 0;
        waveConfig.waveComplete = false;
        waveConfig.spawnTimer = 0;

        // Reset camera
        camera.position.set(0, 2, 0);
        camera.rotation.set(0, 0, 0);

        createWeapon();
        controls.lock();
        updateHUD();
        announceWave(1);
    }

    function restartGame() {
        dom.gameOver.style.display = 'none';
        startGame();
    }

    function gameOver() {
        gameState = STATE.GAME_OVER;
        controls.unlock();
        dom.finalScore.textContent = `Score: ${PLAYER.score} | Wave: ${PLAYER.wave}`;
        dom.gameOver.style.display = 'flex';
    }

    function announceWave(wave) {
        dom.waveAnnounce.textContent = `WAVE ${wave}`;
        dom.waveAnnounce.classList.add('show');
        setTimeout(() => dom.waveAnnounce.classList.remove('show'), 2000);
    }

    // ---- HUD Update ----
    function updateHUD() {
        dom.healthValue.textContent = Math.max(0, Math.round(PLAYER.health));
        dom.healthBar.style.width =
            `${(PLAYER.health / PLAYER.maxHealth) * 100}%`;

        if (PLAYER.health < 30) {
            dom.healthBar.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
        } else if (PLAYER.health < 60) {
            dom.healthBar.style.background = 'linear-gradient(90deg, #ff8800, #ffaa44)';
        } else {
            dom.healthBar.style.background = 'linear-gradient(90deg, #44ff44, #66ff66)';
        }

        dom.scoreValue.textContent = PLAYER.score;
        dom.waveValue.textContent = PLAYER.wave;
        dom.ammoValue.textContent = `${WEAPON.ammo}/${WEAPON.maxAmmo}`;
        dom.ammoBar.style.width = `${(WEAPON.ammo / WEAPON.maxAmmo) * 100}%`;

        if (WEAPON.ammo <= 5) {
            dom.ammoBar.style.background =
                'linear-gradient(90deg, #ff0000, #ff4444)';
        }
    }

    // ---- Player Movement ----
    function updatePlayerMovement(delta) {
        if (gameState !== STATE.PLAYING) return;

        const speed = PLAYER.speed * delta;
        const direction = new THREE.Vector3();

        if (keys['KeyW'] || keys['ArrowUp']) direction.z -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) direction.z += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) direction.x -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;

        if (joystickDeltaX !== 0 || joystickDeltaY !== 0) {
            direction.x += joystickDeltaX / 50;
            direction.z += joystickDeltaY / 50;
        }

        if (direction.length() > 0) {
            direction.normalize();

            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))
                .normalize();

            const moveX = (cameraDirection.x * direction.z +
                right.x * direction.x) * speed;
            const moveZ = (cameraDirection.z * direction.z +
                right.z * direction.x) * speed;

            const newPos = camera.position.clone();
            newPos.x += moveX;
            newPos.z += moveZ;

            const bound = 38;
            newPos.x = Math.max(-bound, Math.min(bound, newPos.x));
            newPos.z = Math.max(-bound, Math.min(bound, newPos.z));

            let collides = false;
            arena.walls.forEach(wall => {
                const wallBox = new THREE.Box3().setFromObject(wall);
                const playerBox = new THREE.Box3().setFromCenterAndSize(
                    newPos, new THREE.Vector3(1, 2, 1)
                );
                if (wallBox.intersectsBox(playerBox)) {
                    collides = true;
                }
            });

            if (!collides) {
                camera.position.copy(newPos);
            }
        }

        camera.position.y = 2;

        // Shooting
        if (mouseDown || touchFirePressed) {
            shoot();
        }

        // Auto reload when empty
        if (WEAPON.ammo === 0 && !WEAPON.reloading) {
            reload();
        }

        // Recoil recovery
        if (WEAPON.currentRecoil > 0) {
            WEAPON.currentRecoil *= WEAPON.recoilRecovery;
            if (WEAPON.currentRecoil < 0.001) {
                WEAPON.currentRecoil = 0;
            }
        }

        // Muzzle flash fade
        const flash = muzzleFlashes[0];
        if (flash.material.opacity > 0) {
            flash.material.opacity *= 0.5;
            flash.scale.multiplyScalar(0.9);
        }
    }

    // ---- Animation Loop ----
    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);

        if (gameState === STATE.PLAYING) {
            updatePlayerMovement(delta);
            updateEnemies(delta);
            updateBullets(delta);
            updateParticles(delta);
            updateWaveSystem(delta);
            updateHUD();
        }

        renderer.render(scene, camera);
    }

    // ---- Start ----
    init();

})();
