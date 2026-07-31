import * as THREE from 'three';
import { createWorldAK47 } from './weaponBuilder';
import { applyVertexAOToMesh, createContactAOPlane } from './ambientOcclusion';

export class ThirdPersonRig {
  public group: THREE.Group;
  private headMesh: THREE.Group | null = null;
  private leftArmMesh: THREE.Mesh | null = null;
  private rightArmMesh: THREE.Mesh | null = null;
  private leftLegMesh: THREE.Mesh | null = null;
  private rightLegMesh: THREE.Mesh | null = null;
  private bodySwayTime = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ThirdPerson_Rig_Group';
    this.buildCharacter();
  }

  private buildCharacter() {
    const camoMat = new THREE.MeshStandardMaterial({
      color: 0x27303d, // Spec-ops tactical camo pants
      roughness: 0.8,
      flatShading: true,
    });

    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x181e28, // Heavy plate carrier vest
      roughness: 0.6,
      metalness: 0.1,
      flatShading: true,
    });

    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Tactical Kevlar helmet
      roughness: 0.5,
      metalness: 0.3,
      flatShading: true,
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Anti-glare tinted ballistic visor
      roughness: 0.1,
      metalness: 0.8,
      flatShading: true,
    });

    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x0f131a, // Tactical belt & holster
      roughness: 0.9,
      flatShading: true,
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x0d0f12, // Combat boots
      roughness: 0.85,
      flatShading: true,
    });

    // 1. Head & Tactical Helmet
    this.headMesh = new THREE.Group();
    this.headMesh.position.set(0, 0.68, -0.02);

    const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), camoMat);
    this.headMesh.add(headBase);

    const helmet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.14, 0.12, 12, 1, false, 0, Math.PI * 2),
      helmetMat
    );
    helmet.position.set(0, 0.04, 0);
    this.headMesh.add(helmet);

    // Ballistic Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.10), visorMat);
    visor.position.set(0, 0.02, -0.09);
    this.headMesh.add(visor);

    this.group.add(this.headMesh);
    // Hide head mesh for local First-Person view so helmet/visor never clip inside camera lens
    this.headMesh.visible = false;

    // 2. Torso / Tactical Plate Carrier
    const chestGeo = new THREE.BoxGeometry(0.46, 0.52, 0.26);
    const chest = new THREE.Mesh(chestGeo, vestMat);
    chest.position.set(0, 0.32, -0.05);
    this.group.add(chest);

    // Magazine pouches & Radio on front of vest
    for (let p = -1; p <= 1; p++) {
      const pouchGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
      const pouch = new THREE.Mesh(pouchGeo, beltMat);
      pouch.position.set(p * 0.12, 0.28, -0.18);
      this.group.add(pouch);
    }

    // 3. Tactical Belt
    const beltGeo = new THREE.BoxGeometry(0.48, 0.10, 0.28);
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.set(0, 0.01, -0.05);
    this.group.add(belt);

    // 4. World Arms Holding Third-Person World AK-47
    const armGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.38, 10);

    this.leftArmMesh = new THREE.Mesh(armGeo, camoMat);
    this.leftArmMesh.position.set(-0.28, 0.32, -0.08);
    this.leftArmMesh.rotation.set(0.6, -0.3, 0.2);
    this.leftArmMesh.visible = false;
    this.group.add(this.leftArmMesh);

    this.rightArmMesh = new THREE.Mesh(armGeo, camoMat);
    this.rightArmMesh.position.set(0.28, 0.32, -0.08);
    this.rightArmMesh.rotation.set(0.7, 0.2, -0.2);
    this.rightArmMesh.visible = false;
    this.group.add(this.rightArmMesh);

    // World AK47 attached to right arm hand position
    const worldAK = createWorldAK47();
    worldAK.position.set(0, -0.20, -0.15);
    worldAK.rotation.set(-0.3, 0.1, 0.2);
    this.rightArmMesh.add(worldAK);

    // 5. Legs / Combat Pants & Boots
    const legGeo = new THREE.CylinderGeometry(0.10, 0.08, 0.70, 12);

    this.leftLegMesh = new THREE.Mesh(legGeo, camoMat);
    this.leftLegMesh.position.set(-0.15, -0.38, -0.05);
    this.group.add(this.leftLegMesh);

    this.rightLegMesh = new THREE.Mesh(legGeo, camoMat);
    this.rightLegMesh.position.set(0.15, -0.38, -0.05);
    this.group.add(this.rightLegMesh);

    // Combat Boots
    const bootGeo = new THREE.BoxGeometry(0.12, 0.13, 0.26);

    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(0, -0.38, -0.05);
    applyVertexAOToMesh(leftBoot, { minAO: 0.4 });
    this.leftLegMesh.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0, -0.38, -0.05);
    applyVertexAOToMesh(rightBoot, { minAO: 0.4 });
    this.rightLegMesh.add(rightBoot);

    // Ground contact shadow under feet
    const feetContact = createContactAOPlane(1.2, 1.2, 0.75);
    feetContact.position.set(0, -0.72, -0.05);
    this.group.add(feetContact);

    // Hide entire 3D third-person character body for the local First-Person camera
    this.group.visible = false;
  }

  public updateAnimation(
    delta: number,
    playerPos: THREE.Vector3,
    yaw: number,
    isMoving: boolean,
    isSprinting: boolean,
    stepCycle: number
  ) {
    const backOffset = new THREE.Vector3(0, 0, 0.12).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.group.position.set(
      playerPos.x + backOffset.x,
      playerPos.y - 1.62,
      playerPos.z + backOffset.z
    );
    this.group.rotation.y = yaw;

    // Idle Torso Breathing Sway
    this.bodySwayTime += delta * 2.0;
    const breathOffset = Math.sin(this.bodySwayTime) * 0.008;
    this.group.position.y += breathOffset;

    if (this.headMesh) {
      this.headMesh.rotation.y = Math.sin(this.bodySwayTime * 0.5) * 0.05;
    }

    // Locomotion Leg Strides & World Arm Swing
    if (isMoving) {
      const strideAngle = Math.sin(stepCycle) * (isSprinting ? 0.45 : 0.25);
      if (this.leftLegMesh && this.rightLegMesh) {
        this.leftLegMesh.rotation.x = strideAngle;
        this.rightLegMesh.rotation.x = -strideAngle;
      }

      if (this.leftArmMesh && this.rightArmMesh) {
        this.leftArmMesh.rotation.x = 0.6 + Math.cos(stepCycle) * 0.10;
        this.rightArmMesh.rotation.x = 0.7 - Math.cos(stepCycle) * 0.08;
      }
    } else {
      if (this.leftLegMesh && this.rightLegMesh) {
        this.leftLegMesh.rotation.x = 0;
        this.rightLegMesh.rotation.x = 0;
      }
      if (this.leftArmMesh && this.rightArmMesh) {
        this.leftArmMesh.rotation.x = 0.6;
        this.rightArmMesh.rotation.x = 0.7;
      }
    }
  }
}
