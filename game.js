// game.js - Main entry: initializes renderer, scene, player, world, and game loop

// Wrap initialization so we can ensure Three.js is available and add debug logging
(async ()=>{
  if(!window.THREE){
    console.log('window.THREE missing — importing dynamically');
    try{
      const mod = await import('https://unpkg.com/three@0.159.0/build/three.module.js');
      window.THREE = mod;
    }catch(e){ console.error('Failed to load THREE:', e); return; }
  }
  if(!window.PointerLockControls){
    try{
      const ctl = await import('https://unpkg.com/three@0.159.0/examples/jsm/controls/PointerLockControls.js');
      window.PointerLockControls = ctl.PointerLockControls;
    }catch(e){ console.warn('PointerLockControls dynamic import failed', e); }
  }

  const THREE = window.THREE;
  // Main setup
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 5000);
  camera.position.set(0,1.8,0);

  console.log('Initializing scene, camera at', camera.position.toArray());

  // Add debug helpers to confirm rendering
  const grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
  scene.add(grid);
  const axes = new THREE.AxesHelper(5);
  scene.add(axes);

  function addDebugCube(){
    try{
      const geo = new THREE.BoxGeometry(1.5,1.5,1.5);
      const mat = new THREE.MeshStandardMaterial({color:0x00ff88});
      const cube = new THREE.Mesh(geo, mat);
      cube.position.set(0,1.2,-5);
      cube.castShadow = true;
      cube.receiveShadow = true;
      scene.add(cube);
      return cube;
    }catch(e){ console.warn('Failed to add debug cube', e); }
  }
  const debugCube = addDebugCube();

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
  };

  // On-screen debug panel
  const dbg = document.createElement('div');
  dbg.style.position = 'fixed';
  dbg.style.right = '12px';
  dbg.style.top = '12px';
  dbg.style.background = 'rgba(0,0,0,0.4)';
  dbg.style.color = '#8f8';
  dbg.style.padding = '8px';
  dbg.style.fontSize = '12px';
  dbg.style.borderRadius = '6px';
  dbg.style.zIndex = '40';
  dbg.id = 'debugPanel';
  dbg.innerText = 'debug: init...';
  document.body.appendChild(dbg);

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
    m.userData = {state:'patrol', seed: Math.random()};
    scene.add(m);
    enemies.push(m);
  }
  spawnEnemy(20, -40);

  // Lighting for player (headlamp)
  const headLamp = new THREE.SpotLight(0xffffff, 1, 40, Math.PI/6, 0.4);
  headLamp.position.set(0,2,0);
  headLamp.castShadow = false;
  scene.add(headLamp);
  scene.add(headLamp.target);

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
        // idle/patrol slight wobble using per-enemy seed
        const seed = ent.userData.seed || 0;
        ent.position.x += Math.sin(now*0.001 + seed*10.0) * 0.002;
        ent.position.z += Math.cos(now*0.001 + seed*8.0) * 0.002;
      }
    });

    // rotate debug cube so it's obvious something is rendering
    try{
      if(debugCube) debugCube.rotation.y += 0.8 * delta;
    }catch(e){ console.warn('debugCube rotate failed', e); }

    // Update HUD
    hud.health.textContent = Math.round(player.health);
    hud.hunger.textContent = Math.round(player.hunger);
    hud.stamina.textContent = Math.round(player.stamina);
    hud.invList.textContent = player.inventory.length ? player.inventory.join(', ') : '(empty)';

    // Update debug panel
    try{
      const pos = player.getPosition();
      dbg.innerText = `fps:${Math.round(1/delta)} size:${renderer.domElement.width}x${renderer.domElement.height} objs:${scene.children.length} items:${worldItems.length} enemies:${enemies.length} pos:${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;
    }catch(e){ dbg.innerText = 'debug update error'; }

    // autosave every 5s
    if(Math.floor(now/5000) !== Math.floor((now-delta*1000)/5000)){
      localStorage.setItem(saveKey, JSON.stringify({player:player.save(), time:getTimeOfDay()}));
    }

    try{
      renderer.render(scene, camera);
    }catch(e){ console.error('Render error', e); }
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

})();
