// world.js - Create and update the 3D world (terrain, objects, day-night, weather)

import * as THREE from 'three';

let scene, clock;

export function initWorld(sceneRef){
  scene = sceneRef;
  clock = new THREE.Clock();

  // Fog for atmosphere
  scene.fog = new THREE.FogExp2(0xaabbe0, 0.0008);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(2000,2000,32,32);
  const groundMat = new THREE.MeshStandardMaterial({color:0x556644});
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Simple sky color handled in update loop

  // Scatter some simple buildings, trees, items
  addBuildings();
  addTrees();
  addItems();
}

function addBuildings(){
  const boxGeo = new THREE.BoxGeometry(10,10,10);
  for(let i=0;i<12;i++){
    const b = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({color:0x666677}));
    b.scale.set(1, Math.random()*3+0.5, 1);
    b.position.set((Math.random()-0.5)*800, b.scale.y*5, (Math.random()-0.5)*800);
    b.castShadow = true;
    scene.add(b);
  }
}

function addTrees(){
  for(let i=0;i<60;i++){
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.8,6), new THREE.MeshStandardMaterial({color:0x6b3b1a}));
    trunk.position.set((Math.random()-0.5)*1000, 3, (Math.random()-0.5)*1000);
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3,8,6), new THREE.MeshStandardMaterial({color:0x2a6b2a}));
    leaves.position.set(trunk.position.x, 7, trunk.position.z);
    leaves.castShadow = true;
    scene.add(trunk, leaves);
  }
}

// Basic collectible items - represented as small boxes with metadata
export const items = [];
function addItems(){
  for(let i=0;i<40;i++){
    const geo = new THREE.BoxGeometry(1.2,1.2,1.2);
    const mat = new THREE.MeshStandardMaterial({color: Math.random()>0.7?0xffaa00:0x44aaff});
    const m = new THREE.Mesh(geo, mat);
    m.position.set((Math.random()-0.5)*400, 0.6, (Math.random()-0.5)*400);
    m.userData = {type: Math.random()>0.7? 'food' : 'tool'};
    scene.add(m);
    items.push(m);
  }
}

// Simple day-night cycle controller
let sunLight;
export function initLights(renderer){
  // Ambient
  const amb = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(amb);

  // Sun (directional)
  sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
  sunLight.position.set(100,200,100);
  sunLight.castShadow = true;
  sunLight.shadow.camera.left = -200;
  sunLight.shadow.camera.right = 200;
  sunLight.shadow.camera.top = 200;
  sunLight.shadow.camera.bottom = -200;
  scene.add(sunLight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

let timeOfDay = 12; // hours (0-24)
export function updateWorld(delta){
  timeOfDay += delta * 0.02; // speed
  if(timeOfDay >= 24) timeOfDay -= 24;

  // Sun angle around the scene
  const t = (timeOfDay / 24) * Math.PI*2;
  sunLight.position.set(Math.cos(t)*200, Math.sin(t)*200, Math.sin(t*0.5)*200);

  // Color and intensity adjustment
  const intensity = Math.max(0.15, Math.sin(t)*0.9);
  sunLight.intensity = intensity;

  // Sky color (simple lerp)
  const dayColor = new THREE.Color(0x87ceeb);
  const nightColor = new THREE.Color(0x041028);
  const mix = Math.max(0, Math.sin(t)*0.5 + 0.5);
  scene.background = dayColor.clone().lerp(nightColor, 1-mix);
  scene.fog.color.copy(scene.background);
}

export function getTimeOfDay(){return timeOfDay}
