// player.js - Player class and movement, interactions, HUD updates, save/load

export class Player {
  constructor(camera, scene, domElement){
    this.camera = camera;
    this.scene = scene;
    this.controls = new window.PointerLockControls(camera, domElement);

    // Acquire THREE at runtime (avoid module load order problems)
    this.THREE = window.THREE;
    if(!this.THREE) throw new Error('THREE not available in Player constructor');

    this.velocity = new this.THREE.Vector3();
    this.direction = new this.THREE.Vector3();
    this.onGround = true;

    this.moveSpeed = 200; // units per second (scaled)
    this.runMultiplier = 1.6;

    // Stats
    this.health = 100;
    this.hunger = 100;
    this.stamina = 100;

    // Inventory
    this.inventory = [];

    // Interaction
    this.raycaster = new this.THREE.Raycaster();

    // Input state
    this.keys = {};
    this._bind();
  }

  // Input binding
  _bind(){
    document.addEventListener('keydown', e=>this.keys[e.code]=true);
    document.addEventListener('keyup', e=>this.keys[e.code]=false);
  }

  // Called when pointer lock is enabled to attach controls
  lock(){
    this.controls.lock();
  }

  // Update per frame (delta seconds)
  update(delta, worldItems){
    // Movement vector
    const forward = (this.keys['KeyW']?1:0) - (this.keys['KeyS']?1:0);
    const strafe = (this.keys['KeyD']?1:0) - (this.keys['KeyA']?1:0);
    const running = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

    this.direction.set(strafe,0,forward).normalize();
    const speed = this.moveSpeed * (running? this.runMultiplier : 1) * (delta);

    if(this.direction.lengthSq()>0){
      const move = new this.THREE.Vector3();
      this.controls.getDirection(move);
      // move is forward vector; build lateral movement
      const forwardVec = new this.THREE.Vector3(move.x,0,move.z).normalize();
      const rightVec = new this.THREE.Vector3().crossVectors(new this.THREE.Vector3(0,1,0), forwardVec).normalize();
      const posDelta = forwardVec.multiplyScalar(this.direction.z * speed).add(rightVec.multiplyScalar(this.direction.x * speed));
      this.controls.getObject().position.add(posDelta);
      this.stamina = Math.max(0, this.stamina - (running? 5*delta : 1*delta));
    } else {
      this.stamina = Math.min(100, this.stamina + 10*delta);
    }

    // Jump
    if(this.keys['Space'] && this.onGround){
      this.controls.getObject().position.y += 2.2; // simple hop
      this.onGround = false;
    }
    if(this.controls.getObject().position.y > 1.2) this.controls.getObject().position.y -= 9.8*delta; else { this.controls.getObject().position.y = 1.2; this.onGround = true }

    // Hunger drains over time
    this.hunger = Math.max(0, this.hunger - 0.5 * delta);
    if(this.hunger<=0) this.health = Math.max(0, this.health - 3*delta);

    // Interaction: try pickup with KeyE
    if(this.keys['KeyE']){
      this.tryPickup(worldItems);
      // avoid repeating pickup every frame
      this.keys['KeyE'] = false;
    }
  }

  tryPickup(worldItems){
    // Raycast from camera forward
    this.raycaster.set(this.camera.getWorldPosition(new this.THREE.Vector3()), this.camera.getWorldDirection(new this.THREE.Vector3()));
    const intersects = this.raycaster.intersectObjects(worldItems);
    if(intersects.length>0 && intersects[0].distance < 4){
      const obj = intersects[0].object;
      this.inventory.push(obj.userData.type||'item');
      // mark for removal
      obj.visible = false;
      obj.userData.picked = true;
      return true;
    }
    return false;
  }

  getPosition(){
    return this.controls.getObject().position.clone();
  }

  save(){
    const p = this.getPosition();
    return {
      pos: { x: p.x, y: p.y, z: p.z },
      health: this.health,
      hunger: this.hunger,
      stamina: this.stamina,
      inventory: this.inventory
    };
  }

  load(data){
    if(!data) return;
    const p = this.controls.getObject().position;
    if(data.pos){ p.set(data.pos.x || 0, data.pos.y || 1.2, data.pos.z || 0); }
    this.health = data.health ?? this.health;
    this.hunger = data.hunger ?? this.hunger;
    this.stamina = data.stamina ?? this.stamina;
    this.inventory = data.inventory || this.inventory;
  }
}
