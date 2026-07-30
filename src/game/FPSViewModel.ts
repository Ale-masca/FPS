import * as THREE from 'three';
import { AK47Model, createAK47 } from './weaponBuilder';
import { buildLowPolyRightArm, buildLowPolyLeftArm, ArmIKRig } from './lowPolyArmBuilder';
import { WeaponRecoilConfig } from './weaponConfig';

export interface WeaponSocket {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

export interface ViewModelOptions {
  hipPosition?: THREE.Vector3;
  adsPosition?: THREE.Vector3;
  fovMultiplier?: number;
}

export class FPSViewModel {
  public rootGroup: THREE.Group;
  public recoilGroup: THREE.Group;
  public weaponContainer: THREE.Group;

  // Active Weapon & Modular Rig
  public weaponModel: AK47Model | null = null;
  public armRigGroup: THREE.Group;
  public leftArmGroup: THREE.Group;
  public rightArmGroup: THREE.Group;
  public armIKRig: ArmIKRig;

  // Modular Attachment Sockets
  public gripSocket: THREE.Group;
  public handguardSocket: THREE.Group;
  public muzzleSocket: THREE.Group;

  // Camera Space Viewmodel Offsets
  private hipPos: THREE.Vector3;
  private adsPos: THREE.Vector3;
  public currentPos: THREE.Vector3;

  // Sway, Inertia, Bob & Procedural Recoil Impulse State
  private targetSway = new THREE.Vector2(0, 0);
  private currentSway = new THREE.Vector2(0, 0);
  private recoilPitch = 0;
  private recoilYaw = 0;
  private recoilRoll = 0;
  private recoilZ = 0;
  private recoilY = 0;
  private containerScaleZ = 0.85;
  private stepCycle = 0;

  // Continuous Animation Weights & Cycles
  private sprintWeight = 0;
  private moveWeight = 0;
  private adsWeight = 0;
  private idleCycle = 0;

  // Reload Animation State
  public isReloading = false;
  public reloadTimer = 0;

  // Inspect Animation State
  public isInspecting = false;
  public inspectTimer = 0;

  constructor(camera: THREE.Camera, options: ViewModelOptions = {}) {
    // 1. Root group attached directly to camera
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'FPS_ViewModel_Root';

    // 2. Recoil container for procedural shooting impulse
    this.recoilGroup = new THREE.Group();
    this.recoilGroup.name = 'FPS_Recoil_Group';
    this.rootGroup.add(this.recoilGroup);

    // 3. Weapon container (Scaled down ~15% for modern FPS viewmodel proportions)
    this.weaponContainer = new THREE.Group();
    this.weaponContainer.name = 'FPS_Weapon_Container';
    this.weaponContainer.scale.set(0.85, 0.85, 0.85);
    this.recoilGroup.add(this.weaponContainer);

    // Camera space offsets (Modern FPS placement: lower & further right)
    this.hipPos = options.hipPosition || new THREE.Vector3(0.22, -0.21, -0.36);
    this.adsPos = options.adsPosition || new THREE.Vector3(0.00, -0.106, -0.32);
    this.currentPos = new THREE.Vector3().copy(this.hipPos);
    this.rootGroup.position.copy(this.currentPos);

    // Create Modular Sockets
    this.gripSocket = new THREE.Group();
    this.gripSocket.name = 'Socket_Grip';
    this.gripSocket.position.set(0, -0.12, 0.09); // Pistol grip & trigger location

    this.handguardSocket = new THREE.Group();
    this.handguardSocket.name = 'Socket_Handguard';
    this.handguardSocket.position.set(0, -0.02, -0.28); // Handguard location

    this.muzzleSocket = new THREE.Group();
    this.muzzleSocket.name = 'Socket_Muzzle';
    this.muzzleSocket.position.set(0, 0.02, -0.78); // Barrel end

    this.weaponContainer.add(this.gripSocket);
    this.weaponContainer.add(this.handguardSocket);
    this.weaponContainer.add(this.muzzleSocket);

    // 4. Build Modular Low-Poly Tactical Arm Rigs
    this.armRigGroup = new THREE.Group();
    this.armRigGroup.name = 'FPS_Arm_Rig_Group';

    this.rightArmGroup = buildLowPolyRightArm();
    this.leftArmGroup = buildLowPolyLeftArm();

    this.gripSocket.add(this.rightArmGroup);
    this.handguardSocket.add(this.leftArmGroup);

    // Dynamic Anatomical Arm IK Rig (Anchored at torso shoulders)
    this.armIKRig = new ArmIKRig();
    this.weaponContainer.add(this.armIKRig.group);

    // Attach to camera
    camera.add(this.rootGroup);

    // Load Default Weapon
    this.loadDefaultWeapon();
  }

  // Load procedural AK47
  public loadDefaultWeapon() {
    this.weaponModel = createAK47();
    this.weaponContainer.add(this.weaponModel.group);
  }

  // Swap weapon model with custom GLTF model
  public setCustomWeaponModel(customGroup: THREE.Group) {
    if (this.weaponModel) {
      this.weaponContainer.remove(this.weaponModel.group);
      this.weaponModel = null;
    }
    this.weaponContainer.add(customGroup);
  }

  // Swap arm rig with custom GLTF rig
  public setCustomArmRig(customArms: THREE.Group) {
    this.armRigGroup.clear();
    this.armRigGroup.add(customArms);
  }

  // Sockets accessor for attachments
  public getSocket(socketName: string): THREE.Group | null {
    switch (socketName) {
      case 'grip': return this.gripSocket;
      case 'handguard': return this.handguardSocket;
      case 'muzzle': return this.muzzleSocket;
      default: return null;
    }
  }

  // Trigger Inspect Animation
  public triggerInspect() {
    if (this.isReloading || this.isInspecting) return;
    this.isInspecting = true;
    this.inspectTimer = 0;
  }

  // Trigger Reload Animation
  public triggerReload() {
    this.isReloading = true;
    this.reloadTimer = 0;
    this.isInspecting = false;
  }

  // Trigger Recoil Kick Impulse
  public applyRecoil(recoilConfig?: WeaponRecoilConfig, burstCount: number = 0) {
    if (recoilConfig) {
      const accum = Math.min(recoilConfig.maxAccumulation, 1.0 + burstCount * recoilConfig.accumulationRate);
      this.recoilPitch += recoilConfig.vertical * accum;
      this.recoilYaw += (recoilConfig.horizontalBias + (Math.random() - 0.5) * 2 * recoilConfig.horizontalVariance) * accum;
      this.recoilRoll += (Math.random() - 0.5) * 2 * recoilConfig.rollVariance * accum;
      this.recoilZ += recoilConfig.kickZ * accum;
      this.recoilY += recoilConfig.kickY * accum;
    } else {
      this.recoilPitch += 0.05;
      this.recoilYaw += (Math.random() - 0.5) * 0.02;
      this.recoilRoll += (Math.random() - 0.5) * 0.01;
      this.recoilZ += 0.04;
      this.recoilY += 0.01;
    }

    this.containerScaleZ = 0.85 * 0.95;

    if (this.weaponModel) {
      this.weaponModel.muzzleFlashLight.intensity = 7.5;
      this.weaponModel.muzzleFlashMesh.visible = true;
    }
  }

  // Add Sway Inertia from mouse movement
  public addMouseSway(deltaX: number, deltaY: number) {
    this.targetSway.x -= deltaX * 0.0008;
    this.targetSway.y += deltaY * 0.0008;

    this.targetSway.x = THREE.MathUtils.clamp(this.targetSway.x, -0.06, 0.06);
    this.targetSway.y = THREE.MathUtils.clamp(this.targetSway.y, -0.06, 0.06);
  }

  // Main ViewModel Animation Update per frame
  public update(
    delta: number,
    isAiming: boolean,
    isMoving: boolean,
    isSprinting: boolean,
    isGrounded: boolean,
    leanRoll: number = 0,
    recoilRecoverSpeed: number = 16.0
  ) {
    // 1. Recover Recoil Impulse smoothly based on weapon recovery speed
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, delta * recoilRecoverSpeed);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, delta * recoilRecoverSpeed);
    this.recoilRoll = THREE.MathUtils.lerp(this.recoilRoll, 0, delta * recoilRecoverSpeed);
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, delta * recoilRecoverSpeed);
    this.recoilY = THREE.MathUtils.lerp(this.recoilY, 0, delta * recoilRecoverSpeed);
    this.containerScaleZ = THREE.MathUtils.lerp(this.containerScaleZ, 0.85, delta * 20.0);
    this.weaponContainer.scale.z = this.containerScaleZ;

    if (this.weaponModel) {
      this.weaponModel.muzzleFlashLight.intensity = THREE.MathUtils.lerp(
        this.weaponModel.muzzleFlashLight.intensity,
        0,
        delta * 35
      );
      if (this.weaponModel.muzzleFlashLight.intensity < 0.2) {
        this.weaponModel.muzzleFlashMesh.visible = false;
      }
    }

    // 2. Smooth Sway & Inertia Recovery
    this.targetSway.x = THREE.MathUtils.lerp(this.targetSway.x, 0, delta * 8);
    this.targetSway.y = THREE.MathUtils.lerp(this.targetSway.y, 0, delta * 8);
    this.currentSway.lerp(this.targetSway, delta * 12);

    // Adjust ADS offset according to equipped optic sight (Scaled for 0.85 viewmodel)
    let activeAdsPosY = -0.106;
    if (this.weaponModel) {
      if (this.weaponModel.opticType === 'red_dot') activeAdsPosY = -0.140;
      else if (this.weaponModel.opticType === 'holographic') activeAdsPosY = -0.143;
    }
    const currentAdsPos = new THREE.Vector3(0.00, activeAdsPosY, -0.32);

    // 3. Continuous State Weights Interpolation (Sprint, ADS, Movement)
    const targetSprint = (isSprinting && !isAiming && !this.isReloading) ? 1.0 : 0.0;
    const targetAds = isAiming ? 1.0 : 0.0;
    const targetMove = (isMoving && isGrounded) ? 1.0 : 0.0;

    // Smooth weight interpolation rates (Responsive enter/exit)
    this.sprintWeight = THREE.MathUtils.lerp(this.sprintWeight, targetSprint, delta * 9.0);
    this.adsWeight = THREE.MathUtils.lerp(this.adsWeight, targetAds, delta * 14.0);
    this.moveWeight = THREE.MathUtils.lerp(this.moveWeight, targetMove, delta * 8.0);

    // Target position blend: Hip -> Sprint Pose -> ADS
    // Sprint pose: Weapon moved closer to body/chest, barrel pointed down and left
    const sprintPos = new THREE.Vector3(0.06, -0.25, -0.22); // Lowered, closer to body/chest
    let targetPos = new THREE.Vector3().copy(this.hipPos);
    targetPos.lerp(sprintPos, this.sprintWeight);
    targetPos.lerp(currentAdsPos, this.adsWeight);

    if (isAiming) {
      this.isInspecting = false;
    }

    this.currentPos.lerp(targetPos, delta * 12.0);

    // 4. Inspection Animation Handling
    let inspectRotationY = 0;
    let inspectRotationZ = 0;
    let inspectRotationX = 0;

    if (this.isInspecting) {
      this.inspectTimer += delta;
      const INSPECT_DURATION = 2.4;

      if (this.inspectTimer >= INSPECT_DURATION) {
        this.isInspecting = false;
        this.inspectTimer = 0;
      } else {
        const progress = this.inspectTimer / INSPECT_DURATION;

        if (progress < 0.4) {
          // Turn right side of receiver towards camera
          const t = progress / 0.4;
          inspectRotationY = THREE.MathUtils.lerp(0, -0.55, Math.sin(t * Math.PI / 2));
          inspectRotationX = THREE.MathUtils.lerp(0, 0.15, Math.sin(t * Math.PI / 2));
        } else if (progress < 0.8) {
          // Roll to examine left side and top optics
          const t = (progress - 0.4) / 0.4;
          inspectRotationY = THREE.MathUtils.lerp(-0.55, 0.65, Math.sin(t * Math.PI / 2));
          inspectRotationZ = THREE.MathUtils.lerp(0, 0.35, Math.sin(t * Math.PI / 2));
        } else {
          // Return to ready
          const t = (progress - 0.8) / 0.2;
          inspectRotationY = THREE.MathUtils.lerp(0.65, 0, Math.sin(t * Math.PI / 2));
          inspectRotationZ = THREE.MathUtils.lerp(0.35, 0, Math.sin(t * Math.PI / 2));
          inspectRotationX = THREE.MathUtils.lerp(0.15, 0, Math.sin(t * Math.PI / 2));
        }
      }
    }

    // 5. Reload Procedural Animation
    let reloadRotX = 0;
    let reloadRotZ = 0;

    if (this.isReloading && this.weaponModel) {
      this.isInspecting = false;
      this.reloadTimer += delta;
      const TOTAL_RELOAD = 1.40;
      const t = Math.min(this.reloadTimer, TOTAL_RELOAD);

      // Target reload tilt: 30 degrees roll around forward axis (-0.52 rad), 14 degrees pitch up (~0.24 rad)
      const TARGET_ROLL = -0.52; // -30 degrees roll, canting magwell towards player's left hand
      const TARGET_PITCH = 0.24; // ~14 degrees pitch up

      // Helper smoothstep cubic easing
      const smooth = (val: number) => {
        const clamped = THREE.MathUtils.clamp(val, 0, 1);
        return clamped * clamped * (3 - 2 * clamped);
      };

      // Phase 1 (0 to 0.25s): Tilt rifle 30° left & pitch up, left hand releases handguard and reaches towards vest/pouch
      if (t < 0.25) {
        const p = smooth(t / 0.25);
        reloadRotX = THREE.MathUtils.lerp(0, TARGET_PITCH, p);
        reloadRotZ = THREE.MathUtils.lerp(0, TARGET_ROLL, p);
        
        this.leftArmGroup.position.set(
          THREE.MathUtils.lerp(0, -0.04, p),
          THREE.MathUtils.lerp(0, -0.518, p),
          THREE.MathUtils.lerp(0, 0.19, p)
        );
      }
      // Phase 2 (0.25s to 0.60s): Empty magazine ejects/drops down; left hand grips fresh magazine in pouch
      else if (t < 0.60) {
        reloadRotX = TARGET_PITCH;
        reloadRotZ = TARGET_ROLL;
        const p = smooth((t - 0.25) / 0.35);

        this.weaponModel.magGroup.position.y = THREE.MathUtils.lerp(-0.12, -0.50, p);
        this.leftArmGroup.position.set(
          THREE.MathUtils.lerp(-0.04, 0.02, p),
          -0.518,
          0.19
        );
      }
      // Phase 3 (0.60s to 0.95s): Left hand brings fresh magazine directly up into exposed magwell while holding it
      else if (t < 0.95) {
        reloadRotX = TARGET_PITCH;
        reloadRotZ = TARGET_ROLL;
        const p = smooth((t - 0.60) / 0.35);

        const currentMagY = THREE.MathUtils.lerp(-0.50, -0.12, p);
        this.weaponModel.magGroup.position.y = currentMagY;
        // Hand is attached directly to the magazine (Z = -0.08)
        this.leftArmGroup.position.set(
          0.02,
          currentMagY - 0.038,
          0.19
        );
      }
      // Phase 4 (0.95s to 1.18s): Slap mag base to lock it securely into magwell
      else if (t < 1.18) {
        reloadRotX = TARGET_PITCH;
        reloadRotZ = TARGET_ROLL;
        const p = (t - 0.95) / 0.23;
        const slapBump = Math.sin(smooth(p) * Math.PI);

        this.weaponModel.magGroup.position.y = -0.12;
        this.leftArmGroup.position.set(
          0.02,
          -0.158 - slapBump * 0.06,
          0.19
        );
      }
      // Phase 5 (1.18s to 1.40s): Return rifle to ready posture & left hand to handguard
      else {
        const p = smooth((t - 1.18) / 0.22);
        reloadRotX = THREE.MathUtils.lerp(TARGET_PITCH, 0, p);
        reloadRotZ = THREE.MathUtils.lerp(TARGET_ROLL, 0, p);

        this.weaponModel.magGroup.position.y = -0.12;
        this.weaponModel.chargingHandle.position.z = 0.05;
        this.leftArmGroup.position.set(
          THREE.MathUtils.lerp(0.02, 0, p),
          THREE.MathUtils.lerp(-0.158, 0, p),
          THREE.MathUtils.lerp(0.19, 0, p)
        );
      }
    } else if (this.weaponModel) {
      this.reloadTimer = 0;
      this.weaponModel.magGroup.position.y = -0.12;
      this.weaponModel.chargingHandle.position.z = 0.05;
      this.leftArmGroup.position.set(0, 0, 0);
    }

    // Adjust left hand offset if underbarrel grip is attached
    if (this.weaponModel && !this.isReloading) {
      if (this.weaponModel.underbarrelType === 'vertical_grip') {
        this.leftArmGroup.position.set(0, -0.04, -0.02);
        this.leftArmGroup.rotation.set(-0.25, 0, 0);
      } else if (this.weaponModel.underbarrelType === 'angled_grip') {
        this.leftArmGroup.position.set(0, -0.02, -0.01);
        this.leftArmGroup.rotation.set(-0.15, 0, 0);
      } else {
        this.leftArmGroup.position.set(0, 0, 0);
        this.leftArmGroup.rotation.set(0, 0, 0);
      }
    }

    // 6. Procedural Bobbing, Sprint Pose & Idle Motion Cycles
    const stepFreq = THREE.MathUtils.lerp(9.5, 15.5, this.sprintWeight);
    this.stepCycle += delta * stepFreq * this.moveWeight;
    this.idleCycle += delta * 2.2;

    // Walk Positional Bobbing
    const walkBobX = Math.sin(this.stepCycle) * 0.012;
    const walkBobY = Math.abs(Math.cos(this.stepCycle)) * 0.010;
    const walkBobZ = Math.sin(this.stepCycle * 2) * 0.005;

    // Sprint Positional Bobbing (deeper organic rhythmic bounce)
    const sprintBobX = Math.sin(this.stepCycle) * 0.024;
    const sprintBobY = Math.abs(Math.cos(this.stepCycle)) * 0.020 + Math.sin(this.stepCycle * 2) * 0.008;
    const sprintBobZ = Math.sin(this.stepCycle) * 0.016;

    // Blend Positional Bobbing
    const bobX = THREE.MathUtils.lerp(walkBobX, sprintBobX, this.sprintWeight) * this.moveWeight;
    const bobY = THREE.MathUtils.lerp(walkBobY, sprintBobY, this.sprintWeight) * this.moveWeight;
    const bobZ = THREE.MathUtils.lerp(walkBobZ, sprintBobZ, this.sprintWeight) * this.moveWeight;

    // ADS Damping (subdue bobbing during precision aiming)
    const adsDamp = 1.0 - this.adsWeight * 0.88;

    // Idle Breathing Motion
    const breathY = Math.sin(this.idleCycle) * 0.003 * (1.0 - this.moveWeight) * (1.0 - this.adsWeight);

    this.rootGroup.position.set(
      this.currentPos.x + this.currentSway.x + bobX * adsDamp,
      this.currentPos.y + this.currentSway.y - bobY * adsDamp + breathY,
      this.currentPos.z - this.recoilZ - bobZ * adsDamp
    );

    // Rotational Bobbing (Pitch, Yaw, Roll)
    // Walk Rotations
    const walkPitch = Math.sin(this.stepCycle * 2) * 0.016;
    const walkYaw = Math.sin(this.stepCycle) * 0.020;
    const walkRoll = Math.cos(this.stepCycle) * 0.024;

    // Sprint Pose Angles (barrel pointed down and left, gun pulled close to chest)
    const sprintBasePitch = -0.38; // Pointed downwards
    const sprintBaseYaw = 0.35;    // Pointed to the left
    const sprintBaseRoll = -0.15;  // Tilted inward towards body

    // Sprint Dynamic Running Sway
    const sprintPitchMotion = Math.sin(this.stepCycle * 2) * 0.040;
    const sprintYawMotion = Math.sin(this.stepCycle) * 0.048;
    const sprintRollMotion = Math.cos(this.stepCycle) * 0.060;

    // Idle Breathing Rotations
    const idlePitch = Math.sin(this.idleCycle * 0.8) * 0.005 * (1.0 - this.moveWeight);
    const idleRoll = Math.cos(this.idleCycle * 0.6) * 0.004 * (1.0 - this.moveWeight);

    // Blended Movement Rotations
    const moveRotPitch = THREE.MathUtils.lerp(walkPitch, sprintBasePitch + sprintPitchMotion, this.sprintWeight) * this.moveWeight + idlePitch;
    const moveRotYaw = THREE.MathUtils.lerp(walkYaw, sprintBaseYaw + sprintYawMotion, this.sprintWeight) * this.moveWeight;
    const moveRotRoll = THREE.MathUtils.lerp(walkRoll, sprintBaseRoll + sprintRollMotion, this.sprintWeight) * this.moveWeight + idleRoll;

    // Static Sprint Pose when stationary or starting sprint before full moveWeight
    const staticSprintPitch = sprintBasePitch * this.sprintWeight * (1.0 - this.moveWeight);
    const staticSprintYaw = sprintBaseYaw * this.sprintWeight * (1.0 - this.moveWeight);
    const staticSprintRoll = sprintBaseRoll * this.sprintWeight * (1.0 - this.moveWeight);

    // Total Target Rotations
    const targetRotX = -this.recoilPitch + this.currentSway.y + inspectRotationX + reloadRotX + (moveRotPitch + staticSprintPitch) * adsDamp;
    const targetRotY = this.recoilYaw + this.currentSway.x + inspectRotationY + (moveRotYaw + staticSprintYaw) * adsDamp;
    const targetRotZ = inspectRotationZ + reloadRotZ - leanRoll * 0.35 + (moveRotRoll + staticSprintRoll) * adsDamp;

    // Smoothly Interpolate Recoil / Viewmodel Rotations
    this.recoilGroup.rotation.x = THREE.MathUtils.lerp(this.recoilGroup.rotation.x, targetRotX, delta * 16.0);
    this.recoilGroup.rotation.y = THREE.MathUtils.lerp(this.recoilGroup.rotation.y, targetRotY, delta * 16.0);
    this.recoilGroup.rotation.z = THREE.MathUtils.lerp(this.recoilGroup.rotation.z, targetRotZ, delta * 16.0);

    // 7. Update Anatomical Arm IK Rig (2-Bone IK with Torso-Width Shoulder Separation)
    // Left arm pulls the front of the weapon (handguard) close to the chest during sprint
    const leftArmSprintPull = new THREE.Vector3(0.022 * this.sprintWeight, -0.015 * this.sprintWeight, 0.045 * this.sprintWeight);
    const rightWristTarget = this.gripSocket.position.clone().add(new THREE.Vector3(0.012, -0.01, 0.01));
    const leftWristTarget = this.handguardSocket.position.clone()
      .add(this.leftArmGroup.position)
      .add(new THREE.Vector3(-0.040, -0.022, 0.01))
      .add(leftArmSprintPull);

    this.armIKRig.update(rightWristTarget, leftWristTarget, this.isReloading);
  }

  public dispose() {
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}

