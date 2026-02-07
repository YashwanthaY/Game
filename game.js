// game.js - Main entry: initializes renderer, scene, player, world, and game loop

import * as THREE from 'three';
import { initWorld, initLights, updateWorld, items as worldItems, getTimeOfDay } from './world.js';
import { Player } from './player.js';

// Main setup
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 5000);
camera.position.set(0,1.8,0);

// Initialize world and lights
initWorld(scene);
initLights(renderer);

// Player
const player = new Player(camera, scene, document.body);
scene.add(player.controls.getObject());

// HUD elements
const hud = {
  health: document.getElementById('health'),
  hunger: document.getElementById('hunger'),
  stamina: document.getElementById('stamina'),
  invList: document.getElementById('invList'),
  message: document.getElementById('message'),
}

// Start button and pointer lock handling
const startBtn = document.getElementById('startBtn');
startBtn.addEventListener('click', ()=>{
  player.lock();
  startBtn.style.display='none';
});

// Restore save if present
const saveKey = 'survival_demo_save_v1';
function tryLoad(){
  const raw = localStorage.getItem(saveKey);
  if(raw){
    try{ const data = JSON.parse(raw); player.load(data.player); showMessage('Save loaded'); }catch(e){console.warn(e)}
  }
}
tryLoad();

// Simple enemy - patrol and chase
const enemies = [];
function spawnEnemy(x,z){
  const geo = new THREE.SphereGeometry(1.2,12,12);
  const mat = new THREE.MeshStandardMaterial({color:0xaa3333});
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x,1.2,z);
  m.userData = {state:'patrol', targetIndex:0, path:[new THREE.Vector3(x,z,0)]};
  scene.add(m);
  enemies.push(m);
}
spawnEnemy(20, -40);

// Lighting for player (headlamp)
const headLamp = new THREE.SpotLight(0xffffff, 1, 40, Math.PI/6, 0.4);
headLamp.position.set(0,2,0);
headLamp.castShadow = false;
scene.add(headLamp);

// Game loop
let last = performance.now();
function loop(){
  const now = performance.now();
  const delta = (now - last) / 1000; last = now;

  // Update world
  updateWorld(delta);

  // Update player
  player.update(delta, worldItems.filter(i=>!i.userData.picked));

  // Update headlamp to camera
  headLamp.position.copy(camera.position);
  headLamp.position.y += 0.2;
  headLamp.target.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));

  // Update enemies simple AI
  enemies.forEach(ent=>{
    const p = player.getPosition();
    const dist = ent.position.distanceTo(p);
    if(dist < 12){
      // chase
      const dir = new THREE.Vector3().subVectors(p, ent.position).normalize();
      ent.position.add(dir.multiplyScalar(6*delta));
      if(dist < 2.2){ player.health = Math.max(0, player.health - 15*delta); }
    } else {
      // idle/patrol slight wobble
      ent.position.x += Math.sin(now*0.001 + ent.id) * 0.001;
    }
  });

  // Update HUD
  hud.health.textContent = Math.round(player.health);
  hud.hunger.textContent = Math.round(player.hunger);
  hud.stamina.textContent = Math.round(player.stamina);
  hud.invList.textContent = player.inventory.length ? player.inventory.join(', ') : '(empty)';

  // autosave every 5s
  if(Math.floor(now/5000) !== Math.floor((now-delta*1000)/5000)){
    localStorage.setItem(saveKey, JSON.stringify({player:player.save(), time:getTimeOfDay()}));
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// small UI helper
function showMessage(text, ms=2000){
  hud.message.textContent = text;
  setTimeout(()=>{ if(hud.message.textContent===text) hud.message.textContent=''; }, ms);
}

// Basic controls for window
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Expose for debugging
window.__game = {scene, camera, player, worldItems, enemies};
