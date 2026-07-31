import * as THREE from 'three';

export interface ArmMaterials {
  sleeve: THREE.MeshStandardMaterial;
  sleeveAccent: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  gloveBase: THREE.MeshStandardMaterial;
  gloveArmor: THREE.MeshStandardMaterial;
  glovePad: THREE.MeshStandardMaterial;
  watchBody: THREE.MeshStandardMaterial;
  watchScreen: THREE.MeshBasicMaterial;
  watchText: THREE.MeshBasicMaterial;
}

export function createArmMaterials(): ArmMaterials {
  return {
    sleeve: new THREE.MeshStandardMaterial({
      color: 0x9e7f4c,
      roughness: 0.8,
      flatShading: true,
    }),
    sleeveAccent: new THREE.MeshStandardMaterial({
      color: 0x6e5734,
      roughness: 0.85,
      flatShading: true,
    }),
    skin: new THREE.MeshStandardMaterial({
      color: 0xcf9266,
      roughness: 0.6,
      flatShading: true,
    }),
    gloveBase: new THREE.MeshStandardMaterial({
      color: 0x1f232a,
      roughness: 0.6,
      flatShading: true,
    }),
    gloveArmor: new THREE.MeshStandardMaterial({
      color: 0x2d333d,
      roughness: 0.35,
      metalness: 0.2,
      flatShading: true,
    }),
    glovePad: new THREE.MeshStandardMaterial({
      color: 0x12151b,
      roughness: 0.7,
      flatShading: true,
    }),
    watchBody: new THREE.MeshStandardMaterial({
      color: 0x0f1218,
      roughness: 0.3,
      metalness: 0.5,
      flatShading: true,
    }),
    watchScreen: new THREE.MeshBasicMaterial({
      color: 0x0284c7,
    }),
    watchText: new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
    }),
  };
}

function createAnatomicalForearmGeo(length: number): THREE.BufferGeometry {
  const rings = [
    { y: -0.040, rx: 0.038, rz: 0.042 },
    { y: -0.055, rx: 0.046, rz: 0.050 },
    { y: -0.140, rx: 0.048, rz: 0.052 },
    { y: -0.220, rx: 0.058, rz: 0.064 },
    { y: -length, rx: 0.048, rz: 0.052 },
  ];

  const radialSegments = 10;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * Math.PI * 2;
      const x = Math.cos(angle) * ring.rx;
      const z = Math.sin(angle) * ring.rz;
      vertices.push(x, ring.y, z);
    }
  }

  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < radialSegments; s++) {
      const curr = r * radialSegments + s;
      const next = r * radialSegments + ((s + 1) % radialSegments);
      const aboveCurr = (r + 1) * radialSegments + s;
      const aboveNext = (r + 1) * radialSegments + ((s + 1) % radialSegments);

      indices.push(curr, next, aboveCurr);
      indices.push(next, aboveNext, aboveCurr);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createCleanFinger(
  mats: ArmMaterials,
  length: number,
  width: number,
  curlAngle: number
): THREE.Group {
  const finger = new THREE.Group();
  const seg1Len = length * 0.55;
  const seg2Len = length * 0.45;

  const p1Mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, width * 0.85, seg1Len),
    mats.gloveBase
  );
  p1Mesh.position.set(0, 0, seg1Len / 2);
  finger.add(p1Mesh);

  const p2Group = new THREE.Group();
  p2Group.position.set(0, 0, seg1Len);
  p2Group.rotation.x = curlAngle;

  const p2Mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.88, width * 0.75, seg2Len),
    mats.gloveBase
  );
  p2Mesh.position.set(0, 0, seg2Len / 2);
  p2Group.add(p2Mesh);

  finger.add(p2Group);
  return finger;
}

function createAnatomicalForearmGeoGroup(
  mats: ArmMaterials,
  hasWatch = false
): THREE.Group {
  const group = new THREE.Group();

  const sleeveGeo = createAnatomicalForearmGeo(0.28);
  const sleeveMesh = new THREE.Mesh(sleeveGeo, mats.sleeve);
  group.add(sleeveMesh);

  const cuffGeo = new THREE.CylinderGeometry(0.044, 0.040, 0.025, 10);
  const cuffMesh = new THREE.Mesh(cuffGeo, mats.sleeveAccent);
  cuffMesh.position.set(0, -0.028, 0);
  group.add(cuffMesh);

  const skinGeo = new THREE.CylinderGeometry(0.038, 0.035, 0.020, 10);
  const skinMesh = new THREE.Mesh(skinGeo, mats.skin);
  skinMesh.position.set(0, -0.048, 0);
  group.add(skinMesh);

  const gloveCuffGeo = new THREE.CylinderGeometry(0.040, 0.037, 0.025, 10);
  const gloveCuff = new THREE.Mesh(gloveCuffGeo, mats.gloveArmor);
  gloveCuff.position.set(0, -0.068, 0);
  group.add(gloveCuff);

  if (hasWatch) {
    const watch = new THREE.Group();
    watch.position.set(0, -0.11, 0.042);

    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.045, 0.016),
      mats.watchBody
    );
    watch.add(bezel);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.030, 0.032, 0.002),
      mats.watchScreen
    );
    screen.position.set(0, 0, 0.009);
    watch.add(screen);

    const textLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.003, 0.002),
      mats.watchText
    );
    textLine.position.set(0, 0.006, 0.010);
    watch.add(textLine);

    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.044, 0.030, 10),
      mats.watchBody
    );
    strap.position.set(0, -0.11, 0);
    group.add(strap);

    group.add(watch);
  }

  return group;
}

function createRightHandGroup(mats: ArmMaterials): THREE.Group {
  const hand = new THREE.Group();

  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.058, 0.065),
    mats.gloveBase
  );
  hand.add(palm);

  const knuckleGuard = new THREE.Mesh(
    new THREE.BoxGeometry(0.054, 0.022, 0.052),
    mats.gloveArmor
  );
  knuckleGuard.position.set(0, 0.022, 0.004);
  hand.add(knuckleGuard);

  const index = createCleanFinger(mats, 0.062, 0.012, 0.35);
  index.position.set(0.018, -0.008, -0.030);
  index.rotation.set(-0.30, -0.12, 0.10);
  hand.add(index);

  const middle = createCleanFinger(mats, 0.064, 0.012, 1.25);
  middle.position.set(0.006, -0.016, -0.032);
  middle.rotation.set(0.18, 0.08, 0.08);
  hand.add(middle);

  const ring = createCleanFinger(mats, 0.060, 0.011, 1.30);
  ring.position.set(-0.007, -0.018, -0.032);
  ring.rotation.set(0.22, 0.08, 0.08);
  hand.add(ring);

  const pinky = createCleanFinger(mats, 0.052, 0.010, 1.35);
  pinky.position.set(-0.020, -0.020, -0.032);
  pinky.rotation.set(0.26, 0.08, 0.08);
  hand.add(pinky);

  const thumb = createCleanFinger(mats, 0.055, 0.013, 0.65);
  thumb.position.set(0.024, 0.012, 0.010);
  thumb.rotation.set(-0.38, -0.80, 0.55);
  hand.add(thumb);

  return hand;
}

function createLeftHandGroup(mats: ArmMaterials): THREE.Group {
  const hand = new THREE.Group();

  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.058, 0.050, 0.068),
    mats.gloveBase
  );
  hand.add(palm);

  const knuckleGuard = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.020, 0.052),
    mats.gloveArmor
  );
  knuckleGuard.position.set(0, 0.022, -0.004);
  hand.add(knuckleGuard);

  const thumb = createCleanFinger(mats, 0.056, 0.013, 0.30);
  thumb.position.set(-0.028, 0.014, 0.014);
  thumb.rotation.set(0.10, 0.35, -0.55);
  hand.add(thumb);

  const index = createCleanFinger(mats, 0.062, 0.012, 0.85);
  index.position.set(0.018, -0.012, -0.035);
  index.rotation.set(-0.20, 0.12, 0.28);
  hand.add(index);

  const middle = createCleanFinger(mats, 0.064, 0.012, 0.90);
  middle.position.set(0.006, -0.014, -0.035);
  middle.rotation.set(-0.24, 0.12, 0.28);
  hand.add(middle);

  const ring = createCleanFinger(mats, 0.058, 0.011, 0.95);
  ring.position.set(-0.006, -0.016, -0.035);
  ring.rotation.set(-0.28, 0.12, 0.28);
  hand.add(ring);

  const pinky = createCleanFinger(mats, 0.050, 0.010, 1.00);
  pinky.position.set(-0.018, -0.018, -0.035);
  pinky.rotation.set(-0.32, 0.12, 0.28);
  hand.add(pinky);

  return hand;
}

/**
 * Anatomical 2-Bone Inverse Kinematics FPS Arm Rig
 * Shoulders are separated by 0.48m (full human torso width) and anchored to player body.
 */
export class ArmIKRig {
  public group: THREE.Group;

  // Shoulders fixed at torso left and right sides (+0.24m and -0.24m)
  public rightShoulder = new THREE.Vector3(0.24, -0.20, 0.32);
  public leftShoulder = new THREE.Vector3(-0.24, -0.20, 0.22);

  private mats: ArmMaterials;

  // Right Arm Components
  private rShoulderCap: THREE.Mesh;
  private rUpperArm: THREE.Mesh;
  private rElbowPad: THREE.Mesh;
  private rForearmGroup: THREE.Group;
  private rHandGroup: THREE.Group;

  // Left Arm Components
  private lShoulderCap: THREE.Mesh;
  private lUpperArm: THREE.Mesh;
  private lElbowPad: THREE.Mesh;
  private lForearmGroup: THREE.Group;
  private lHandGroup: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Anatomical_Torso_ArmIKRig';
    this.mats = createArmMaterials();

    const upperArmGeo = new THREE.CylinderGeometry(0.052, 0.060, 1.0, 10);

    // --- RIGHT ARM ---
    this.rShoulderCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 10, 10),
      this.mats.sleeve
    );
    this.group.add(this.rShoulderCap);

    this.rUpperArm = new THREE.Mesh(upperArmGeo, this.mats.sleeve);
    this.group.add(this.rUpperArm);

    this.rElbowPad = new THREE.Mesh(
      new THREE.SphereGeometry(0.050, 8, 8),
      this.mats.sleeveAccent
    );
    this.group.add(this.rElbowPad);

    this.rForearmGroup = createAnatomicalForearmGeoGroup(this.mats, false);
    this.group.add(this.rForearmGroup);

    this.rHandGroup = createRightHandGroup(this.mats);
    this.group.add(this.rHandGroup);

    // --- LEFT ARM ---
    this.lShoulderCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 10, 10),
      this.mats.sleeve
    );
    this.group.add(this.lShoulderCap);

    this.lUpperArm = new THREE.Mesh(upperArmGeo.clone(), this.mats.sleeve);
    this.group.add(this.lUpperArm);

    this.lElbowPad = new THREE.Mesh(
      new THREE.SphereGeometry(0.050, 8, 8),
      this.mats.sleeveAccent
    );
    this.group.add(this.lElbowPad);

    this.lForearmGroup = createAnatomicalForearmGeoGroup(this.mats, true);
    this.group.add(this.lForearmGroup);

    this.lHandGroup = createLeftHandGroup(this.mats);
    this.group.add(this.lHandGroup);
  }

  public update(
    rightWrist: THREE.Vector3,
    leftWrist: THREE.Vector3,
    isReloading = false
  ) {
    // Solve Right Arm (Pistol Grip)
    this.solveLimb(
      this.rightShoulder,
      rightWrist,
      0.30,
      0.28,
      new THREE.Vector3(0.5, -0.7, 0.2),
      this.rShoulderCap,
      this.rUpperArm,
      this.rElbowPad,
      this.rForearmGroup,
      this.rHandGroup,
      new THREE.Euler(0.35, -0.05, 0.10)
    );

    // Solve Left Arm (Handguard / Reload)
    const leftHandRot = isReloading
      ? new THREE.Euler(0.30, -0.25, -0.15)
      : new THREE.Euler(0.18, -0.15, -0.22);

    this.solveLimb(
      this.leftShoulder,
      leftWrist,
      0.30,
      0.28,
      new THREE.Vector3(-0.5, -0.2, 0.3),
      this.lShoulderCap,
      this.lUpperArm,
      this.lElbowPad,
      this.lForearmGroup,
      this.lHandGroup,
      leftHandRot
    );
  }

  private solveLimb(
    shoulder: THREE.Vector3,
    wrist: THREE.Vector3,
    lenUpper: number,
    lenForearm: number,
    flareDirHint: THREE.Vector3,
    shoulderMesh: THREE.Mesh,
    upperArmMesh: THREE.Mesh,
    elbowMesh: THREE.Mesh,
    forearmGroup: THREE.Group,
    handGroup: THREE.Group,
    handRotation: THREE.Euler
  ) {
    shoulderMesh.position.copy(shoulder);

    const dir = new THREE.Vector3().subVectors(wrist, shoulder);
    const dist = Math.max(0.05, dir.length());
    dir.normalize();

    // 2-Bone Inverse Kinematics
    let x = (lenUpper * lenUpper - lenForearm * lenForearm + dist * dist) / (2 * dist);
    x = THREE.MathUtils.clamp(x, 0.02, lenUpper - 0.001);
    let h = Math.sqrt(Math.max(0, lenUpper * lenUpper - x * x));

    const proj = dir.clone().multiplyScalar(flareDirHint.dot(dir));
    let ortho = new THREE.Vector3().subVectors(flareDirHint, proj);
    if (ortho.lengthSq() < 0.0001) {
      ortho.set(flareDirHint.x, 0, 0);
    }
    ortho.normalize();

    const elbow = new THREE.Vector3()
      .copy(shoulder)
      .addScaledVector(dir, x)
      .addScaledVector(ortho, h);

    // Upper Arm Segment
    const upperArmVec = new THREE.Vector3().subVectors(elbow, shoulder);
    const upperArmLen = upperArmVec.length();
    const upperArmMid = new THREE.Vector3().addVectors(shoulder, elbow).multiplyScalar(0.5);

    upperArmMesh.position.copy(upperArmMid);
    upperArmMesh.scale.set(1.0, upperArmLen, 1.0);
    upperArmMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      upperArmVec.clone().normalize()
    );

    elbowMesh.position.copy(elbow);

    // Forearm Group aligned towards elbow
    const dirToElbow = new THREE.Vector3().subVectors(elbow, wrist);
    forearmGroup.position.copy(wrist);
    forearmGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      dirToElbow.clone().normalize()
    );

    handGroup.position.copy(wrist);
    handGroup.rotation.copy(handRotation);
  }
}

export function buildLowPolyRightArm(): THREE.Group {
  return new THREE.Group();
}

export function buildLowPolyLeftArm(): THREE.Group {
  return new THREE.Group();
}

