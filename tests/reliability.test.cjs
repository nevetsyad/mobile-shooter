const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8');
function setup(names,extra={}) {
 const c=vm.createContext({STATE:{PLAYING:1,PAUSED:2,GAME_OVER:3},gameState:1,Math,...extra});
 for(const name of names){const a=source.indexOf(`    function ${name}(`);const b=source.indexOf('\n    function ',a+1);vm.runInContext(source.slice(a,b),c);}
 return c;
}
const element=()=>({style:{},classList:{add(){},remove(){}}});
test('reload advances only during gameplay and completes once',()=>{
 let hud=0;const c=setup(['reload','updateReload'],{WEAPON:{ammo:2,maxAmmo:30,reloadTime:1000},reloadRemaining:0,dom:{reloadIndicator:element()},playSound(){},updateHUD(){hud++;}});
 c.reload();c.updateReload(.4);assert.equal(c.reloadRemaining,600);
 c.gameState=2;c.updateReload(10);assert.equal(c.reloadRemaining,600);assert.equal(c.WEAPON.ammo,2);
 c.gameState=1;c.updateReload(.6);assert.equal(c.WEAPON.ammo,30);assert.equal(c.WEAPON.reloading,false);
 const count=hud;c.updateReload(1);assert.equal(hud,count);
});
test('focus loss clears every input and explicit resume requests mouse lock',()=>{
 let touchReset=0,locked=0;const c=setup(['resetInput','pauseForFocusLoss','togglePause'],{keys:{KeyW:true},mouseDown:true,touchFirePressed:true,sprintHeld:true,joystickDeltaX:12,joystickDeltaY:24,resetTouchState(){touchReset++;},dom:{joystickThumb:element(),fireBtn:element(),pauseScreen:element()},controls:{isLocked:false,lock(){locked++;}},clock:{getDelta(){}},document:{documentElement:{classList:{contains:()=>false}}}});
 c.pauseForFocusLoss();assert.equal(c.gameState,2);assert.equal(Object.keys(c.keys).length,0);assert.equal(c.mouseDown,false);assert.equal(c.touchFirePressed,false);assert.equal(c.joystickDeltaX,0);assert.ok(touchReset);
 c.togglePause();assert.equal(c.gameState,1);assert.equal(locked,1);
});
test('lethal last bomber cannot award score, restore health or advance wave',()=>{
 const p={clone(){return {setY(){return this;}}}};
 const c=setup(['killEnemy','completeWave','updateWaveSystem'],{enemies:[{position:p,userData:{type:'bomber',damage:100,size:[1,2,1],scoreValue:20}}],PLAYER:{health:5,maxHealth:100,score:0,wave:1},waveConfig:{enemiesAlive:1,enemiesSpawned:1,enemiesPerWave:1,waveComplete:false},createParticles(){},rememberScore(){throw Error('posthumous score');},scene:{remove(){}},disposeObject(){},updateHUD(){}});
 c.bomberBlast=()=>{c.PLAYER.health=0;c.gameState=3;};c.killEnemy(0);c.updateWaveSystem(10);
 assert.equal(c.PLAYER.health,0);assert.equal(c.PLAYER.wave,1);assert.equal(c.PLAYER.score,0);assert.equal(c.waveConfig.waveComplete,false);assert.equal(c.enemies.length,0);
});
test('failed random placement still adds exactly one pickup beyond old cap',()=>{
 const pickups=Array(6).fill({});const c=setup(['spawnRfpPickup'],{rfpPickups:pickups,camera:{position:{x:3,z:4}},blocked:()=>true,wallBoxes:[],scene:{add(){}},makeRfpPickup:()=>({position:{set(x,y,z){Object.assign(this,{x,y,z});}}})});
 c.spawnRfpPickup();assert.equal(pickups.length,7);assert.equal(pickups[6].position.x,3);assert.equal(pickups[6].position.z,4);
});
test('analog magnitude is preserved and keyboard diagonal is capped',()=>{
 function distance(x,y,keys={}){
 const moveDir={x:0,y:0,z:-1,lengthSq:()=>1,normalize(){}};
 const c=setup(['updatePlayerMovement'],{keys,sprintHeld:false,joystickDeltaX:x,joystickDeltaY:y,STAMINA:{current:100,max:100,regenDelay:0},PLAYER:{speed:10},WEAPON:{ammo:10,reloading:false,currentRecoil:0},dom:{},camera:{position:{x:0,y:1.7,z:0},getWorldDirection(){}},moveDir,blocked:()=>false,mouseDown:false,touchFirePressed:false,weaponGroup:null,muzzleFlashes:[]});
 c.updatePlayerMovement(1);return Math.hypot(c.camera.position.x,c.camera.position.z);
 }
 assert.equal(distance(12,0),2.5);assert.equal(distance(48,0),10);assert.ok(Math.abs(distance(0,0,{KeyW:true,KeyD:true})-10)<1e-10);
});
