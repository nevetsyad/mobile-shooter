const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../game.js'), 'utf8');
function extract(name) {
    const start = source.indexOf(`    function ${name}(`);
    const end = source.indexOf('\n    function ', start + 1);
    return source.slice(start, end);
}
const box = (min, max) => ({ min: {x:min,y:0,z:-1}, max: {x:max,y:3,z:1} });
const pos = (x,y,z) => ({x,y,z,set(x,y,z){ Object.assign(this,{x,y,z}); return this; },clone(){return pos(this.x,this.y,this.z);} });
function setup(extra={}) {
    const ctx = vm.createContext({wallBoxes:[], Number, Math, ...extra});
    vm.runInContext(['segmentSphereTime','segmentBoxTime','worldHitTime','moveToContact','updateBullets','updateEnemyShots','updateRfp','throwRfp'].map(extract).join('\n'),ctx);
    return ctx;
}
test('sphere entry, miss, tangent, stationary and inside cases',()=>{
    const c=setup();
    assert.equal(c.segmentSphereTime(0,0,0,10,0,0,5,0,0,1),0.4);
    assert.equal(c.segmentSphereTime(0,0,0,1,0,0,5,0,0,1),Infinity);
    assert.equal(c.segmentSphereTime(0,1,0,10,1,0,5,0,0,1),0.5);
    assert.equal(c.segmentSphereTime(0,0,0,0,0,0,5,0,0,1),Infinity);
    assert.equal(c.segmentSphereTime(5,0,0,5,0,0,5,0,0,1),0);
});
test('thin walls, parallel miss, starting inside and floor sweep',()=>{
    const c=setup({wallBoxes:[box(2,2.01)]});
    assert.equal(c.worldHitTime(0,1,0,pos(10,1,0),0.04),0.2);
    assert.equal(c.segmentBoxTime(0,4,0,10,4,0,box(2,3)),Infinity);
    assert.equal(c.segmentBoxTime(2.5,1,0,2.5,1,0,box(2,3)),0);
    assert.equal(c.worldHitTime(0,1,5,pos(0,-1,5),0),0.5);
});
function combat(walls=[]) {
    return setup({wallBoxes:walls,enemies:[],bullets:[],enemyShots:[],scene:{remove(){}},
        performance:{now:()=>0},createParticles(){},flashCrosshair(){},playSound(){},killEnemy(){},
        camera:{position:pos(5,1.3,0)},damagePlayer(){throw Error('damage through cover');}});
}
const enemy=x=>({position:pos(x,0,0),userData:{size:[1,2,1],health:100,type:'shooter'}});
const bullet=()=>({position:pos(0,1.1,0),userData:{direction:pos(1,0,0),speed:100,life:1,damage:15}});
test('staples stop at cover; nearest target wins in either array order',()=>{
    const c=combat([box(2,2.1)]);c.enemies=[enemy(5)];c.bullets=[bullet()];c.updateBullets(.1);
    assert.equal(c.enemies[0].userData.health,100);assert.equal(c.bullets.length,0);
    for(const order of [[8,4],[4,8]]) {
        const d=combat();d.enemies=order.map(enemy);d.bullets=[bullet()];d.updateBullets(.1);
        assert.equal(d.enemies.find(e=>e.position.x===4).userData.health,85);
        assert.equal(d.enemies.find(e=>e.position.x===8).userData.health,100);
    }
});
test('enemy shots cannot damage player behind a wall',()=>{
    const c=combat([box(2,2.1)]);
    c.enemyShots=[{position:pos(0,1.3,0),rotation:pos(0,0,0),userData:{velocity:pos(100,0,0),spin:pos(0,0,0),life:1,damage:10}}];
    c.updateEnemyShots(.1);assert.equal(c.enemyShots.length,0);
});
test('unarmed RFP hits a nearby wall and detonates at contact',()=>{
    let impact;
    const c=combat([box(.2,.21)]);
    Object.assign(c,{rfpPickups:[],rfpThrows:[{position:pos(0,1,0),rotation:pos(0,0,0),userData:{velocity:pos(16,0,0),spin:pos(0,0,0),life:1,armed:.16}}],explodeRfp:p=>impact=p});
    c.updateRfp(.05);assert.equal(c.rfpThrows.length,0);assert.equal(impact.x,.2);
});
test('RFP launch offset cannot place grenade on far side of cover',()=>{
    let impact;
    class Vector {
        constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
        copy(p){Object.assign(this,p);return this;}
        addScaledVector(p,s){this.x+=p.x*s;this.y+=p.y*s;this.z+=p.z*s;return this;}
        set(x,y,z){Object.assign(this,{x,y,z});return this;}
        clone(){return new Vector(this.x,this.y,this.z);}
    }
    const c=combat([box(.2,.21)]);
    Object.assign(c,{STATE:{PLAYING:1},gameState:1,rfpHeld:1,rfpNext:0,yellDemand(){},
        THREE:{Vector3:Vector},makeDiscovery:()=>({position:new Vector(),scale:{setScalar(){}}}),
        camera:{position:new Vector(0,1,0),getWorldDirection:d=>d.set(1,0,0)},explodeRfp:p=>impact=p});
    c.throwRfp();assert.equal(impact.x,.2);assert.equal(c.rfpHeld,0);
});
