const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8');
function setup(names,extra={}){const c=vm.createContext({Math,...extra});for(const name of names){const a=source.indexOf(`    function ${name}(`),b=source.indexOf('\n    function ',a+1);vm.runInContext(source.slice(a,b),c);}return c;}
test('damage bearing tracks front, right, rear and camera rotation',()=>{
 const c=setup(['damageBearing']);const p={x:0,z:0};
 assert.equal(c.damageBearing({x:0,z:-5},p,0),0);
 assert.equal(c.damageBearing({x:5,z:0},p,0),Math.PI/2);
 assert.equal(Math.abs(c.damageBearing({x:0,z:5},p,0)),Math.PI);
 assert.ok(Math.abs(c.damageBearing({x:-5,z:0},p,Math.PI/2))<1e-10);
});
test('bomber fuse stays inactive at distance, warns, then detonates after gameplay time',()=>{
 const c=setup(['updateBomberWarning']);const e={userData:{fuse:null,warning:{visible:false,material:{}},briefcase:{scale:{setScalar(){}}},caseScale:1}};
 assert.equal(c.updateBomberWarning(e,10,1),false);assert.equal(e.userData.fuse,null);
 assert.equal(c.updateBomberWarning(e,3,.1),false);assert.equal(e.userData.warning.visible,true);
 assert.equal(c.updateBomberWarning(e,10,.4),false);assert.equal(c.updateBomberWarning(e,10,.5),true);
});
test('blast rings and direction marker expire and release resources',()=>{
 let removed=0,disposed=0;const indicator={style:{}};
 const c=setup(['updateCombatFeedback','damageBearing'],{blastRings:[{userData:{life:.65},material:{}}],damageCue:{x:0,z:-3,life:1.2},scene:{remove(){removed++;}},disposeObject(){disposed++;},document:{getElementById:()=>indicator},camera:{position:{x:0,z:0},rotation:{y:0}}});
 c.updateCombatFeedback(.3);assert.equal(c.blastRings.length,1);assert.equal(indicator.style.display,'block');
 c.updateCombatFeedback(1);assert.equal(c.blastRings.length,0);assert.equal(disposed,1);assert.equal(removed,1);assert.equal(indicator.style.display,'none');
});
