const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../game.js'), 'utf8');
const start = source.indexOf('    function officeLayout(');
const end = source.indexOf('\n    function ', start + 1);
const ctx = vm.createContext({});
vm.runInContext(source.slice(start, end), ctx);
const props = ctx.officeLayout();

function gap(a, b) {
    const ax = Math.abs(a.x - b.x) - a.size[0] / 2 - b.size[0] / 2;
    const az = Math.abs(a.z - b.z) - a.size[2] / 2 - b.size[2] / 2;
    if (ax < 0 && az < 0) return Math.min(ax, az);
    if (ax < 0) return az;
    if (az < 0) return ax;
    return Math.hypot(ax, az);
}

test('office props keep a walkable gap and leave the spawn clear', () => {
    assert.equal(props.length, 12);
    for (const prop of props) {
        assert.ok(Math.abs(prop.x) + prop.size[0] / 2 < 36);
        assert.ok(Math.abs(prop.z) + prop.size[2] / 2 < 36);
        const hitsSpawn = Math.abs(prop.x) < 2 + prop.size[0] / 2 && Math.abs(prop.z) < 2 + prop.size[2] / 2;
        assert.equal(hitsSpawn, false);
    }
    for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
            assert.ok(gap(props[i], props[j]) >= 1.6, `${i} and ${j} are too close`);
        }
    }
});

test('each office zone has a landmark kind', () => {
    const zones = new Set(props.map(prop => prop.zone));
    assert.deepEqual([...zones].sort(), ['conference', 'cubicles', 'filing', 'reception']);
    assert.ok(props.some(prop => prop.kind === 'desk'));
    assert.ok(props.some(prop => prop.kind === 'cabinet'));
    assert.ok(props.some(prop => prop.kind === 'table'));
    assert.ok(props.some(prop => prop.kind === 'pillar'));
});
