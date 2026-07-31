import * as THREE from 'three';

export type OpticType = 'none' | 'red_dot' | 'holographic';
export type BarrelType = 'none' | 'suppressor';
export type UnderbarrelType = 'none' | 'vertical_grip' | 'angled_grip';

export interface AK47Model {
  group: THREE.Group;
  muzzleFlashLight: THREE.PointLight;
  muzzleFlashMesh: THREE.Group;
  recoilGroup: THREE.Group;
  magGroup: THREE.Group;
  chargingHandle: THREE.Mesh;
  leftArmGroup: THREE.Group;
  opticSocket: THREE.Group;
  barrelSocket: THREE.Group;
  underbarrelSocket: THREE.Group;
  opticType: OpticType;
  barrelType: BarrelType;
  underbarrelType: UnderbarrelType;
  setOptics: (type: OpticType) => void;
  setBarrel: (type: BarrelType) => void;
  setUnderbarrel: (type: UnderbarrelType) => void;
}

export function createAK47(): AK47Model {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'AK47_Root';

  // Recoil inner group for recoil animation
  const recoilGroup = new THREE.Group();
  recoilGroup.name = 'AK47_RecoilGroup';
  rootGroup.add(recoilGroup);

  // Materials for Tarkov/Sandstorm tier low-poly AK-47
  const receiverMat = new THREE.MeshStandardMaterial({
    color: 0x1d2128, // Blued stamped dark gunmetal steel
    metalness: 0.55,
    roughness: 0.45,
    flatShading: true,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x12151c, // Dark steel for barrel, sights & gas block
    metalness: 0.5,
    roughness: 0.5,
    flatShading: true,
  });

  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x8e97a4, // Polished stainless bolt carrier inside ejection port
    metalness: 0.85,
    roughness: 0.25,
    flatShading: true,
  });

  const woodLaminateMat = new THREE.MeshStandardMaterial({
    color: 0x8b3213, // Authentic Russian dark mahogany wood laminate
    roughness: 0.38,
    metalness: 0.05,
    flatShading: true,
  });

  const woodHighlightMat = new THREE.MeshStandardMaterial({
    color: 0xa84218, // Honey amber accent wood for palm swells
    roughness: 0.35,
    metalness: 0.05,
    flatShading: true,
  });

  const bakeliteMagMat = new THREE.MeshStandardMaterial({
    color: 0xb5400d, // Authentic 7.62x39 Bakelite orange-brown
    roughness: 0.38,
    metalness: 0.05,
    flatShading: true,
  });

  const magSteelMat = new THREE.MeshStandardMaterial({
    color: 0x181a21, // Steel baseplate & spine reinforcement
    metalness: 0.6,
    roughness: 0.4,
    flatShading: true,
  });

  const opticBodyMat = new THREE.MeshStandardMaterial({
    color: 0x12141a,
    metalness: 0.5,
    roughness: 0.4,
    flatShading: true,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
  });

  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0xff0033, // Glowing bright red reticle
  });

  // 1. Receiver Box (Main Stamped Body with Tapered Sides & Edge Bevels)
  const receiverShape = new THREE.Shape();
  receiverShape.moveTo(-0.030, -0.055);
  receiverShape.lineTo(0.030, -0.055);
  receiverShape.lineTo(0.037, -0.045);
  receiverShape.lineTo(0.036, 0.036);
  receiverShape.lineTo(0.028, 0.056);
  receiverShape.lineTo(-0.028, 0.056);
  receiverShape.lineTo(-0.036, 0.036);
  receiverShape.lineTo(-0.037, -0.045);
  receiverShape.closePath();

  const receiverGeo = new THREE.ExtrudeGeometry(receiverShape, {
    depth: 0.34,
    bevelEnabled: false,
  });
  receiverGeo.center();
  const receiver = new THREE.Mesh(receiverGeo, receiverMat);
  receiver.position.set(0, 0, 0);
  recoilGroup.add(receiver);

  // Stamped Dimples over magwell (lateral indentations)
  const dimpleGeo = new THREE.BoxGeometry(0.080, 0.022, 0.04);
  const dimple = new THREE.Mesh(dimpleGeo, darkSteelMat);
  dimple.position.set(0, -0.02, -0.07);
  recoilGroup.add(dimple);

  // Ejection Port Cutout (Right side)
  const portCutout = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.12), darkSteelMat);
  portCutout.position.set(0.032, 0.03, 0.01);
  recoilGroup.add(portCutout);

  // Chrome Bolt Carrier visible inside ejection port
  const boltCarrier = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 12), boltMat);
  boltCarrier.rotation.x = Math.PI / 2;
  boltCarrier.position.set(0.025, 0.03, 0.01);
  recoilGroup.add(boltCarrier);

  // Charging Handle (Rigidly attached to chrome bolt carrier)
  const handleGeo = new THREE.CylinderGeometry(0.009, 0.012, 0.055, 10);
  const handle = new THREE.Mesh(handleGeo, receiverMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.052, 0.03, 0.03);
  recoilGroup.add(handle);

  // Fire Selector / Safety Lever (Right side)
  const selectorLever = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.13), receiverMat);
  selectorLever.position.set(0.04, 0.005, 0.03);
  selectorLever.rotation.y = -0.06;
  recoilGroup.add(selectorLever);

  const selectorTab = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.02), receiverMat);
  selectorTab.position.set(0.044, -0.002, 0.08);
  recoilGroup.add(selectorTab);

  // Top Receiver Dust Cover (Smooth Arched Dome with Soft Shoulders)
  const dustCoverShape = new THREE.Shape();
  dustCoverShape.moveTo(-0.036, 0.0);
  dustCoverShape.quadraticCurveTo(-0.036, 0.038, -0.018, 0.046);
  dustCoverShape.quadraticCurveTo(0, 0.050, 0.018, 0.046);
  dustCoverShape.quadraticCurveTo(0.036, 0.038, 0.036, 0.0);
  dustCoverShape.closePath();

  const dustCoverGeo = new THREE.ExtrudeGeometry(dustCoverShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.002,
    bevelThickness: 0.003,
  });
  dustCoverGeo.center();
  const dustCover = new THREE.Mesh(dustCoverGeo, darkSteelMat);
  dustCover.position.set(0, 0.056, 0);
  recoilGroup.add(dustCover);

  // Dust Cover Strengthening Ribs
  for (let r = 0; r < 3; r++) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 14, 1, false, Math.PI, Math.PI), darkSteelMat);
    rib.rotation.z = Math.PI / 2;
    rib.rotation.y = Math.PI / 2;
    rib.position.set(0, 0.058, -0.08 + r * 0.08);
    recoilGroup.add(rib);
  }

  // Rear Recoil Spring Button (Exits back of dust cover)
  const recoilButton = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.02), receiverMat);
  recoilButton.position.set(0, 0.055, 0.172);
  recoilGroup.add(recoilButton);

  // Low-profile Picatinny Rail for Optics
  const railGeo = new THREE.BoxGeometry(0.022, 0.01, 0.28);
  const rail = new THREE.Mesh(railGeo, darkSteelMat);
  rail.position.set(0, 0.102, -0.04);
  recoilGroup.add(rail);

  // 2. Wooden Stock (Authentic Russian Mahogany Laminate with Beveled Comb & Buttplate)
  const stockTang = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.06), receiverMat);
  stockTang.position.set(0, 0.01, 0.19);
  recoilGroup.add(stockTang);

  const stockShape = new THREE.Shape();
  stockShape.moveTo(-0.026, 0.05);
  stockShape.lineTo(0.026, 0.05);
  stockShape.lineTo(0.027, -0.04);
  stockShape.lineTo(0.020, -0.052);
  stockShape.lineTo(-0.020, -0.052);
  stockShape.lineTo(-0.027, -0.04);
  stockShape.closePath();

  const stockGeo = new THREE.ExtrudeGeometry(stockShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.002,
    bevelThickness: 0.003,
  });
  stockGeo.center();
  const stock = new THREE.Mesh(stockGeo, woodLaminateMat);
  stock.position.set(0, -0.035, 0.33);
  stock.rotation.x = -0.12; // Slanted downwards
  recoilGroup.add(stock);

  // Stock Comb Top Highlight
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.022, 0.22), woodHighlightMat);
  comb.position.set(0, 0.01, 0.28);
  comb.rotation.x = -0.12;
  recoilGroup.add(comb);

  // Steel Buttplate with Trapdoor & Sling Swivel Ring
  const buttpadGeo = new THREE.BoxGeometry(0.056, 0.108, 0.015);
  const buttpad = new THREE.Mesh(buttpadGeo, darkSteelMat);
  buttpad.position.set(0, -0.058, 0.51);
  buttpad.rotation.x = -0.12;
  recoilGroup.add(buttpad);

  const trapdoor = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.005, 10), receiverMat);
  trapdoor.rotation.x = Math.PI / 2 - 0.12;
  trapdoor.position.set(0, -0.058, 0.518);
  recoilGroup.add(trapdoor);

  const slingLoop = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 8), receiverMat);
  slingLoop.position.set(-0.032, -0.03, 0.42);
  slingLoop.rotation.y = Math.PI / 2;
  recoilGroup.add(slingLoop);

  // 3. Pistol Grip (Contoured Ergonomic Bakelite Grip with Soft Bevels)
  const gripCap = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.015, 0.055), darkSteelMat);
  gripCap.position.set(0, -0.062, 0.11);
  recoilGroup.add(gripCap);

  const gripShape = new THREE.Shape();
  gripShape.moveTo(-0.018, 0.032);
  gripShape.quadraticCurveTo(-0.020, 0.0, -0.018, -0.038);
  gripShape.quadraticCurveTo(-0.012, -0.065, 0, -0.065);
  gripShape.quadraticCurveTo(0.012, -0.065, 0.018, -0.038);
  gripShape.quadraticCurveTo(0.020, 0.0, 0.018, 0.032);
  gripShape.closePath();

  const gripGeo = new THREE.ExtrudeGeometry(gripShape, {
    depth: 0.13,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.003,
    bevelThickness: 0.004,
  });
  gripGeo.center();
  const grip = new THREE.Mesh(gripGeo, woodLaminateMat);
  grip.position.set(0, -0.13, 0.11);
  grip.rotation.x = 0.38; // Ergonomic backward angle
  recoilGroup.add(grip);

  // Trigger Guard & Trigger Blade & Mag Release Paddle
  const guardGeo = new THREE.TorusGeometry(0.032, 0.004, 6, 12, Math.PI);
  const guard = new THREE.Mesh(guardGeo, darkSteelMat);
  guard.position.set(0, -0.065, 0.03);
  guard.rotation.y = Math.PI / 2;
  recoilGroup.add(guard);

  const triggerBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.028), receiverMat);
  triggerBlade.position.set(0, -0.058, 0.03);
  triggerBlade.rotation.x = -0.25;
  recoilGroup.add(triggerBlade);

  const magRelease = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.008), darkSteelMat);
  magRelease.position.set(0, -0.062, -0.025);
  magRelease.rotation.x = -0.3;
  recoilGroup.add(magRelease);

  // 4. Curved 30-round 7.62x39mm Bakelite Magazine
  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.12, -0.08);

  // 5-Segment Banana Curve with Ribs and Steel Base
  for (let i = 0; i < 5; i++) {
    const segMat = i === 4 ? magSteelMat : bakeliteMagMat;
    const segGeo = new THREE.BoxGeometry(0.044, 0.048, 0.082);
    const seg = new THREE.Mesh(segGeo, segMat);
    seg.position.set(0, -i * 0.038, -i * 0.012);
    seg.rotation.x = 0.18 + i * 0.065;
    magGroup.add(seg);

    // Lateral strengthening ribs on magazine body
    if (i < 4) {
      const magRib = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.006, 0.084), bakeliteMagMat);
      magRib.position.set(0, -i * 0.038, -i * 0.012);
      magRib.rotation.x = 0.18 + i * 0.065;
      magGroup.add(magRib);
    }
  }
  recoilGroup.add(magGroup);

  // 5. Wooden Handguard (Lower Palm-Swell & Upper Gas Tube Cover)
  // Rear Metal Ferrule / Retainer
  const handguardRearCap = new THREE.Mesh(new THREE.BoxGeometry(0.070, 0.074, 0.02), darkSteelMat);
  handguardRearCap.position.set(0, 0.01, -0.18);
  recoilGroup.add(handguardRearCap);

  // Lower Handguard with Beveled Bottom Edges & Smooth Palm Swells
  const lowerWoodShape = new THREE.Shape();
  lowerWoodShape.moveTo(-0.033, 0.022);
  lowerWoodShape.lineTo(-0.033, -0.012);
  lowerWoodShape.quadraticCurveTo(-0.028, -0.032, -0.016, -0.036);
  lowerWoodShape.lineTo(0.016, -0.036);
  lowerWoodShape.quadraticCurveTo(0.028, -0.032, 0.033, -0.012);
  lowerWoodShape.lineTo(0.033, 0.022);
  lowerWoodShape.closePath();

  const lowerHandguardGeo = new THREE.ExtrudeGeometry(lowerWoodShape, {
    depth: 0.20,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.002,
    bevelThickness: 0.003,
  });
  lowerHandguardGeo.center();
  const lowerHandguard = new THREE.Mesh(lowerHandguardGeo, woodLaminateMat);
  lowerHandguard.position.set(0, -0.015, -0.28);
  recoilGroup.add(lowerHandguard);

  const palmSwellL = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.038, 0.14), woodHighlightMat);
  palmSwellL.position.set(-0.035, -0.015, -0.28);
  recoilGroup.add(palmSwellL);

  const palmSwellR = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.038, 0.14), woodHighlightMat);
  palmSwellR.position.set(0.035, -0.015, -0.28);
  recoilGroup.add(palmSwellR);

  // Upper Gas Tube Wood Cover (Smooth Curved Arch)
  const upperWoodShape = new THREE.Shape();
  upperWoodShape.moveTo(-0.026, 0.0);
  upperWoodShape.quadraticCurveTo(-0.026, 0.030, 0, 0.032);
  upperWoodShape.quadraticCurveTo(0.026, 0.030, 0.026, 0.0);
  upperWoodShape.closePath();

  const upperHandguardGeo = new THREE.ExtrudeGeometry(upperWoodShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.002,
    bevelThickness: 0.003,
  });
  upperHandguardGeo.center();
  const upperHandguard = new THREE.Mesh(upperHandguardGeo, woodLaminateMat);
  upperHandguard.position.set(0, 0.040, -0.28);
  recoilGroup.add(upperHandguard);

  // Front Handguard Retainer Ring & Sling Ring
  const handguardFrontCap = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.066, 0.02), darkSteelMat);
  handguardFrontCap.position.set(0, 0.01, -0.38);
  recoilGroup.add(handguardFrontCap);

  // 6. Steel Barrel, Round Gas Tube & Cleaning Rod
  const barrelGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.58, 16);
  const barrel = new THREE.Mesh(barrelGeo, darkSteelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, -0.47);
  recoilGroup.add(barrel);

  // Rounded Gas Tube (16 smooth radial segments)
  const gasTubeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 16);
  const gasTube = new THREE.Mesh(gasTubeGeo, darkSteelMat);
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, 0.046, -0.28);
  recoilGroup.add(gasTube);

  // Authentic Under-barrel Steel Cleaning Rod
  const cleaningRod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.42, 8), darkSteelMat);
  cleaningRod.rotation.x = Math.PI / 2;
  cleaningRod.position.set(0, -0.022, -0.42);
  recoilGroup.add(cleaningRod);

  // 45-Degree Angled Gas Block (With chamfered top angle)
  const gasBlockShape = new THREE.Shape();
  gasBlockShape.moveTo(-0.013, -0.024);
  gasBlockShape.lineTo(0.013, -0.024);
  gasBlockShape.lineTo(0.013, 0.010);
  gasBlockShape.lineTo(0.008, 0.026);
  gasBlockShape.lineTo(-0.008, 0.026);
  gasBlockShape.lineTo(-0.013, 0.010);
  gasBlockShape.closePath();

  const gasBlockGeo = new THREE.ExtrudeGeometry(gasBlockShape, {
    depth: 0.045,
    bevelEnabled: false,
  });
  gasBlockGeo.center();
  const gasBlock = new THREE.Mesh(gasBlockGeo, darkSteelMat);
  gasBlock.position.set(0, 0.032, -0.45);
  recoilGroup.add(gasBlock);

  // 7. Tactical Iron Sights (Tangent Rear Notch & Front Sight Post)
  // Rear Sight Block & Tangent Scale Blade
  const rearSightBlock = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.036, 0.06), darkSteelMat);
  rearSightBlock.position.set(0, 0.068, -0.16);
  recoilGroup.add(rearSightBlock);

  const sightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.075), darkSteelMat);
  sightLeaf.position.set(0, 0.088, -0.16);
  sightLeaf.rotation.x = -0.06;
  recoilGroup.add(sightLeaf);

  // Rear Sight U-Notch Ears
  const notchL = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.008, 0.008), darkSteelMat);
  notchL.position.set(-0.008, 0.093, -0.125);
  recoilGroup.add(notchL);

  const notchR = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.008, 0.008), darkSteelMat);
  notchR.position.set(0.008, 0.093, -0.125);
  recoilGroup.add(notchR);

  // Front Sight Tower (A-frame) with Protective Wings & Sight Pin
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.068, 0.032), darkSteelMat);
  frontSightBase.position.set(0, 0.052, -0.68);
  recoilGroup.add(frontSightBase);

  // Protective Wings
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.024, 0.024), darkSteelMat);
  wingL.position.set(-0.011, 0.092, -0.68);
  recoilGroup.add(wingL);

  const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.024, 0.024), darkSteelMat);
  wingR.position.set(0.011, 0.092, -0.68);
  recoilGroup.add(wingR);

  // Front Sight Post Pin (Aligned for precise ADS aiming)
  const frontSightPin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.018, 8), receiverMat);
  frontSightPin.position.set(0, 0.088, -0.68);
  recoilGroup.add(frontSightPin);

  // Default AKM Slant Muzzle Brake
  const defaultBrakeGroup = new THREE.Group();
  const brakeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 12), darkSteelMat);
  brakeBase.rotation.x = Math.PI / 2;
  brakeBase.position.set(0, 0.018, -0.74);
  defaultBrakeGroup.add(brakeBase);

  // Slant cut on brake tip
  const slantTip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.02, 0.025), darkSteelMat);
  slantTip.position.set(0, 0.022, -0.765);
  slantTip.rotation.x = -0.45;
  defaultBrakeGroup.add(slantTip);
  recoilGroup.add(defaultBrakeGroup);

  const defaultBrake = brakeBase; // Reference handle for visibility toggle

  // ATTACHMENT SOCKETS
  const opticSocket = new THREE.Group();
  opticSocket.name = 'Socket_Optic';
  opticSocket.position.set(0, 0.108, -0.04);
  recoilGroup.add(opticSocket);

  const barrelSocket = new THREE.Group();
  barrelSocket.name = 'Socket_Barrel';
  barrelSocket.position.set(0, 0.018, -0.78);
  recoilGroup.add(barrelSocket);

  const underbarrelSocket = new THREE.Group();
  underbarrelSocket.name = 'Socket_Underbarrel';
  underbarrelSocket.position.set(0, -0.048, -0.28);
  recoilGroup.add(underbarrelSocket);

  // 8. Dynamic 3D Starburst Muzzle Flash
  const muzzleFlashLight = new THREE.PointLight(0xffaa00, 0, 18);
  muzzleFlashLight.position.set(0, 0.018, -0.82);
  recoilGroup.add(muzzleFlashLight);

  const muzzleFlashMesh = new THREE.Group();
  muzzleFlashMesh.position.set(0, 0.018, -0.82);
  muzzleFlashMesh.visible = false;

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffdd22,
    transparent: true,
    opacity: 0.9,
  });

  for (let i = 0; i < 4; i++) {
    const bladeGeo = new THREE.ConeGeometry(0.07, 0.25, 4);
    const blade = new THREE.Mesh(bladeGeo, flashMat);
    blade.rotation.x = Math.PI / 2;
    blade.rotation.z = (i * Math.PI) / 2;
    blade.position.z = -0.11;
    muzzleFlashMesh.add(blade);
  }
  const centerSphere = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), flashMat);
  muzzleFlashMesh.add(centerSphere);
  recoilGroup.add(muzzleFlashMesh);

  // Left arm placeholder group for reload bone constraints
  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = 'AK47_LeftArm_ConstraintGroup';

  // ATTACHMENT BUILDERS
  let currentOpticType: OpticType = 'none';
  let currentBarrelType: BarrelType = 'none';
  let currentUnderbarrelType: UnderbarrelType = 'none';

  const setOptics = (type: OpticType) => {
    opticSocket.clear();
    currentOpticType = type;

    if (type === 'red_dot') {
      // Micro Red Dot Sight (Aimpoint / C-More style)
      const group = new THREE.Group();

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.018, 0.08), opticBodyMat);
      base.position.set(0, 0.009, 0);
      group.add(base);

      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 12), opticBodyMat);
      housing.rotation.x = Math.PI / 2;
      housing.position.set(0, 0.035, 0);
      group.add(housing);

      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.002, 12), glassMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.035, -0.028);
      group.add(lens);

      const redDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), reticleMat);
      redDot.position.set(0, 0.035, 0);
      group.add(redDot);

      opticSocket.add(group);
    } else if (type === 'holographic') {
      // EOTech Holographic Sight
      const group = new THREE.Group();

      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.048, 0.09), opticBodyMat);
      hood.position.set(0, 0.024, 0);
      group.add(hood);

      const windowCutout = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.092), glassMat);
      windowCutout.position.set(0, 0.028, 0);
      group.add(windowCutout);

      // Holo reticle ring + dot
      const reticleRing = new THREE.Mesh(new THREE.TorusGeometry(0.010, 0.0015, 8, 16), reticleMat);
      reticleRing.position.set(0, 0.028, 0);
      group.add(reticleRing);

      const reticleCenter = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), reticleMat);
      reticleCenter.position.set(0, 0.028, 0);
      group.add(reticleCenter);

      opticSocket.add(group);
    }
  };

  const setBarrel = (type: BarrelType) => {
    barrelSocket.clear();
    currentBarrelType = type;

    if (type === 'suppressor') {
      defaultBrake.visible = false;
      const suppGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.22, 12);
      const supp = new THREE.Mesh(suppGeo, darkSteelMat);
      supp.rotation.x = Math.PI / 2;
      supp.position.set(0, 0, -0.08);
      barrelSocket.add(supp);
      muzzleFlashLight.position.set(0, 0.02, -0.92);
      muzzleFlashMesh.position.set(0, 0.02, -0.92);
    } else {
      defaultBrake.visible = true;
      muzzleFlashLight.position.set(0, 0.02, -0.82);
      muzzleFlashMesh.position.set(0, 0.02, -0.82);
    }
  };

  const setUnderbarrel = (type: UnderbarrelType) => {
    underbarrelSocket.clear();
    currentUnderbarrelType = type;

    if (type === 'vertical_grip') {
      const gripMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.11, 8), darkSteelMat);
      gripMesh.position.set(0, -0.055, 0);
      underbarrelSocket.add(gripMesh);
    } else if (type === 'angled_grip') {
      const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.045, 0.12), darkSteelMat);
      gripMesh.rotation.x = -0.45;
      gripMesh.position.set(0, -0.025, 0);
      underbarrelSocket.add(gripMesh);
    }
  };

  return {
    group: rootGroup,
    muzzleFlashLight,
    muzzleFlashMesh,
    recoilGroup,
    magGroup,
    chargingHandle: handle,
    leftArmGroup,
    opticSocket,
    barrelSocket,
    underbarrelSocket,
    get opticType() { return currentOpticType; },
    get barrelType() { return currentBarrelType; },
    get underbarrelType() { return currentUnderbarrelType; },
    setOptics,
    setBarrel,
    setUnderbarrel,
  };
}

// Compact World-Model AK-47 for the Third-Person Character Skeleton
export function createWorldAK47(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'World_AK47';

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x1d2128,
    metalness: 0.55,
    roughness: 0.45,
    flatShading: true,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8b3213,
    roughness: 0.38,
    metalness: 0.05,
    flatShading: true,
  });

  const bakeliteMat = new THREE.MeshStandardMaterial({
    color: 0xb5400d,
    roughness: 0.38,
    metalness: 0.05,
    flatShading: true,
  });

  // Receiver Box
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.35), steelMat);
  group.add(receiver);

  // Barrel & Muzzle
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8), steelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.40);
  group.add(barrel);

  // Wooden Handguard
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.22), woodMat);
  handguard.position.set(0, 0.01, -0.28);
  group.add(handguard);

  // Wooden Stock
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.25), woodMat);
  stock.position.set(0, -0.01, 0.30);
  stock.rotation.x = -0.1;
  group.add(stock);

  // Curved Bakelite Magazine
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.20, 0.09), bakeliteMat);
  mag.position.set(0, -0.15, -0.08);
  mag.rotation.x = 0.3;
  group.add(mag);

  // Pistol Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.05), woodMat);
  grip.position.set(0, -0.10, 0.12);
  grip.rotation.x = 0.4;
  group.add(grip);

  return group;
}

