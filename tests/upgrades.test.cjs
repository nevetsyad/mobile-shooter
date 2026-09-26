const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../game.js'), 'utf8');
function setup(names, extra = {}) {
    const c = vm.createContext({
        STATE: { PLAYING: 1 },
        gameState: 1,
        Math,
        Object,
        upgradeRanks: { magazine: 0, reload: 0, blast: 0 },
        upgradeOpen: false,
        UPGRADE_CAPS: { magazine: 4, reload: 4, blast: 4 },
        UPGRADE_BASE: { maxAmmo: 30, reloadTime: 1500, radius: 5.4, damage: 58 },
        WEAPON: { maxAmmo: 30, ammo: 12, reloadTime: 1500 },
        rfpRadius: 5.4,
        rfpDamage: 58,
        waveConfig: { waveComplete: true, waveDelay: 1000000000 },
        controls: { isLocked: false },
        dom: { upgradeScreen: { style: {}, querySelectorAll: () => [] } },
        resetInput() {},
        updateHUD() {},
        ...extra
    });
    for (const name of names) {
        const start = source.indexOf(`    function ${name}(`);
        const end = source.indexOf('\n    function ', start + 1);
        vm.runInContext(source.slice(start, end), c);
    }
    return c;
}
const names = ['upgradeThreat', 'applyUpgrade', 'resetUpgrades', 'upgradeText', 'renderUpgradeChoices', 'offerUpgrade', 'chooseUpgrade', 'updateWaveSystem'];

test('one choice changes the advertised stat and a second choice is ignored until offered again', () => {
    const c = setup(names);
    assert.equal(c.offerUpgrade(), true);
    assert.equal(c.chooseUpgrade('magazine'), true);
    assert.equal(c.WEAPON.maxAmmo, 36);
    assert.equal(c.WEAPON.ammo, 18);
    assert.equal(c.upgradeOpen, false);
    assert.equal(c.chooseUpgrade('magazine'), false);
    assert.equal(c.WEAPON.maxAmmo, 36);
});

test('caps stop further magazine, reload, and blast changes', () => {
    const c = setup(names);
    for (let i = 0; i < 4; i++) assert.equal(c.applyUpgrade('reload'), true);
    assert.equal(c.WEAPON.reloadTime, 700);
    assert.equal(c.applyUpgrade('reload'), false);
    for (let i = 0; i < 4; i++) c.applyUpgrade('blast');
    assert.equal(c.rfpDamage, 90);
    assert.equal(c.rfpRadius, 6.8);
    assert.equal(c.applyUpgrade('blast'), false);
    for (let i = 0; i < 4; i++) c.applyUpgrade('magazine');
    assert.equal(c.WEAPON.maxAmmo, 54);
    assert.equal(c.applyUpgrade('magazine'), false);
});

test('the picker pauses the wave and a maxed board does not block the next wave', () => {
    const c = setup(names);
    c.offerUpgrade();
    c.updateWaveSystem(100);
    assert.equal(c.waveConfig.waveComplete, true);
    c.chooseUpgrade('reload');
    assert.equal(c.WEAPON.reloadTime, 1300);
    assert.equal(c.waveConfig.waveDelay, 400);
    c.upgradeRanks = { magazine: 4, reload: 4, blast: 4 };
    assert.equal(c.offerUpgrade(), false);
    assert.equal(c.upgradeOpen, false);
});

test('restart resets upgrade ranks and advertised stats', () => {
    const c = setup(names);
    c.applyUpgrade('magazine');
    c.applyUpgrade('blast');
    c.resetUpgrades();
    assert.equal(c.WEAPON.maxAmmo, 30);
    assert.equal(c.WEAPON.reloadTime, 1500);
    assert.equal(c.rfpDamage, 58);
    assert.equal(c.rfpRadius, 5.4);
    assert.equal(c.upgradeThreat(), 1);
});

test('each taken rank adds six percent enemy health', () => {
    const c = setup(names);
    c.upgradeRanks.magazine = 2;
    c.upgradeRanks.blast = 1;
    assert.equal(c.upgradeThreat(), 1.18);
});
