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

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Particle_System_Group';
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

  public update(delta: number) {
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

