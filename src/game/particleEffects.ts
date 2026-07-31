import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationSpeed?: THREE.Vector3;
  life: number;
  maxLife: number;
  type: 'spark' | 'shell' | 'smoke';
}

export class ParticleSystem {
  public group: THREE.Group;
  private particles: Particle[] = [];

  // Reusable materials
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  
  private shellMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, // Golden brass
    metalness: 0.9,
    roughness: 0.2,
  });

  private smokeMat = new THREE.MeshBasicMaterial({
    color: 0xcccccc,
    transparent: true,
    opacity: 0.4,
  });

  // Atmospheric sunlit forest pollen/spore particles
  private sporeMesh?: THREE.InstancedMesh;
  private sporePositions: { x: number; y: number; z: number; speed: number; phase: number }[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Particle_System_Group';

    // Initialize floating forest spores
    const sporeGeo = new THREE.DodecahedronGeometry(0.035, 0);
    const sporeMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a, // Golden sunlit pollen
      transparent: true,
      opacity: 0.55,
    });

    const sporeCount = 140;
    this.sporeMesh = new THREE.InstancedMesh(sporeGeo, sporeMat, sporeCount);

    for (let i = 0; i < sporeCount; i++) {
      this.sporePositions.push({
        x: (Math.random() - 0.5) * 65,
        y: 0.5 + Math.random() * 8.5,
        z: (Math.random() - 0.5) * 65,
        speed: 0.35 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.group.add(this.sporeMesh);
  }

  // Impact sparks on hit surface
  public spawnImpactSparks(point: THREE.Vector3, normal: THREE.Vector3) {
    for (let i = 0; i < 10; i++) {
      const sparkGeo = new THREE.SphereGeometry(0.02 + Math.random() * 0.02, 6, 6);
      const spark = new THREE.Mesh(sparkGeo, this.sparkMat);
      spark.position.copy(point);

      const speed = 2.0 + Math.random() * 4.0;
      const spread = 0.8;
      const velocity = new THREE.Vector3(
        normal.x + (Math.random() - 0.5) * spread,
        normal.y + (Math.random() - 0.5) * spread,
        normal.z + (Math.random() - 0.5) * spread
      ).normalize().multiplyScalar(speed);

      this.group.add(spark);
      this.particles.push({
        mesh: spark,
        velocity,
        life: 0,
        maxLife: 0.15 + Math.random() * 0.2,
        type: 'spark',
      });
    }
  }

  // Eject golden 7.62mm brass shell casing from weapon ejection port
  public spawnShellEjection(worldPos: THREE.Vector3, worldQuat: THREE.Quaternion) {
    const shellGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.028, 8);
    const shell = new THREE.Mesh(shellGeo, this.shellMat);
    shell.position.copy(worldPos);
    shell.quaternion.copy(worldQuat);

    // Local ejection vector: right (+X), up (+Y), back (+Z)
    const localVel = new THREE.Vector3(
      1.8 + Math.random() * 0.6, // Right
      1.2 + Math.random() * 0.5, // Up
      -0.4 + Math.random() * 0.4 // Slightly back
    );
    localVel.applyQuaternion(worldQuat);

    const rotationSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25
    );

    this.group.add(shell);
    this.particles.push({
      mesh: shell,
      velocity: localVel,
      rotationSpeed,
      life: 0,
      maxLife: 1.2 + Math.random() * 0.4,
      type: 'shell',
    });
  }

  // Muzzle smoke puff after firing (Disabled per request)
  public spawnBarrelSmoke(_worldPos: THREE.Vector3) {
    // No-op
  }

  public update(delta: number, playerPos?: THREE.Vector3, elapsedTime?: number) {
    // Update floating atmospheric spores around player position
    if (this.sporeMesh && playerPos) {
      const dummy = new THREE.Object3D();
      const time = elapsedTime || 0;

      for (let i = 0; i < this.sporePositions.length; i++) {
        const sp = this.sporePositions[i];

        // Smooth wind drift dynamics
        const windX = Math.sin(time * 0.85 * sp.speed + sp.phase) * 0.9;
        const windY = Math.cos(time * 0.55 * sp.speed + sp.phase) * 0.35;
        const windZ = Math.cos(time * 0.75 * sp.speed + sp.phase) * 0.9;

        let worldX = playerPos.x + sp.x + windX;
        let worldY = Math.max(0.25, playerPos.y - 1.2 + sp.y + windY);
        let worldZ = playerPos.z + sp.z + windZ;

        // Toroidal wrap-around centered on player camera
        const relX = worldX - playerPos.x;
        const relZ = worldZ - playerPos.z;

        if (relX > 32) sp.x -= 64;
        else if (relX < -32) sp.x += 64;

        if (relZ > 32) sp.z -= 64;
        else if (relZ < -32) sp.z += 64;

        const scale = 0.65 + Math.sin(time * 1.6 + sp.phase) * 0.35;
        dummy.position.set(worldX, worldY, worldZ);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();

        this.sporeMesh.setMatrixAt(i, dummy.matrix);
      }
      this.sporeMesh.instanceMatrix.needsUpdate = true;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        if (p.mesh.material instanceof THREE.Material) {
          p.mesh.material.dispose();
        }
        this.particles.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.velocity, delta);

        if (p.type === 'spark') {
          p.velocity.y -= 9.8 * delta; // Gravity on sparks
          const scale = 1 - p.life / p.maxLife;
          p.mesh.scale.setScalar(Math.max(0.01, scale));
        } else if (p.type === 'shell') {
          p.velocity.y -= 9.8 * delta; // Gravity on brass casing
          if (p.rotationSpeed) {
            p.mesh.rotation.x += p.rotationSpeed.x * delta;
            p.mesh.rotation.y += p.rotationSpeed.y * delta;
            p.mesh.rotation.z += p.rotationSpeed.z * delta;
          }
        } else if (p.type === 'smoke') {
          p.velocity.y += 0.2 * delta; // Buoyancy
          const progress = p.life / p.maxLife;
          p.mesh.scale.setScalar(1 + progress * 2.5);
          if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
            p.mesh.material.opacity = Math.max(0, 0.35 * (1 - progress));
          }
        }
      }
    }
  }

  public dispose() {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.particles = [];
  }
}

