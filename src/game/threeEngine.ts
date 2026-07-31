import * as THREE from 'three';
import { FPSViewModel } from './FPSViewModel';
import { CityBuilder, getTerrainHeight } from './cityBuilder';
import { ParticleSystem } from './particleEffects';
import { ThirdPersonRig } from './thirdPersonRig';
import { Sunlight } from './sunlight';
import { GradientSky } from './sky';
import { PostProcessingManager } from './postProcessing';
import { soundEngine } from '../audio/soundSystem';
import { PlayerFPSState, WeaponState, PostProcessingSettings } from '../types';
import { WEAPON_PROFILES, WeaponProfile, getModifiedWeaponProfile } from './weaponConfig';

export class ThreeSniperEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Modular Engine Systems
  public fpsViewModel!: FPSViewModel;
  private particleSystem: ParticleSystem;
  private thirdPersonRig: ThirdPersonRig;
  public sunlight: Sunlight;
  public sky: GradientSky;
  public postProcessing: PostProcessingManager;

  // Active Weapon & Attachment Selection
  public activeWeaponId: string = 'ak47';
  public activeOptic: 'none' | 'red_dot' | 'holographic' = 'none';
  public activeBarrel: 'none' | 'suppressor' = 'none';
  public activeUnderbarrel: 'none' | 'vertical_grip' | 'angled_grip' = 'none';

  public getActiveProfile(): WeaponProfile {
    const base = WEAPON_PROFILES[this.activeWeaponId] || WEAPON_PROFILES.ak47;
    return getModifiedWeaponProfile(base, this.activeOptic, this.activeBarrel, this.activeUnderbarrel);
  }

  public weaponState: WeaponState = {
    id: 'ak47',
    name: WEAPON_PROFILES.ak47.name,
    caliber: WEAPON_PROFILES.ak47.caliber,
    ammoInMag: 30,
    maxMagSize: 30,
    reserveAmmo: 120,
    isReloading: false,
    isAiming: false,
    isFiring: false,
    currentSpreadRad: 0.006,
  };

  // Physical Camera Recoil Spring Offsets & Velocities
  private camKickPitch = 0;
  private camKickYaw = 0;
  private camKickRoll = 0;

  private camKickPitchVel = 0;
  private camKickYawVel = 0;
  private camKickRollVel = 0;

  // Continuous Spray & Rate of Fire State
  private burstCount = 0;
  private spreadHeat = 0;
  private lastFireTime = 0;
  private isTriggerHeld = false;
  private hasReleasedTriggerForSemi = true;

  private stepCycle = 0;
  private footstepTimer = 0;

  // Reload Animation States
  private reloadTimer = 0;
  private reloadPhaseFlickTriggered = false;
  private reloadPhaseInsertTriggered = false;
  private reloadPhaseRackTriggered = false;

  // Player FPS Position & Camera Controls
  public playerPos: THREE.Vector3 = new THREE.Vector3(0, 1.7, 0); // Eye level at 1.7m
  private playerVel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private isGrounded = true;
  private currentEyeHeight = 1.7;
  private jumpCooldownTimer = 0;
  private wasGrounded = true;
  public isCrouching = false;

  // Lean Mechanics (Q / E)
  private currentLeanRoll = 0;
  private currentLeanOffset = 0;

  public pitch = 0;
  public yaw = 0;
  public sensitivity = 0.0022;
  public baseFOV = 80;
  public isPointerLocked = false;

  private keysPressed: Set<string> = new Set();
  private clock: THREE.Clock = new THREE.Clock();
  private animFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);
    this.scene.fog = new THREE.FogExp2(0x05070a, 0.008);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(
      this.baseFOV,
      container.clientWidth / container.clientHeight,
      0.05,
      600
    );
    this.camera.layers.enable(1);
    this.camera.position.copy(this.playerPos);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. Initialize Particle System
    this.particleSystem = new ParticleSystem();
    this.scene.add(this.particleSystem.group);

    // 5. Build Environment, Isolated FPS ViewModel & Third Person Character
    const { sunlight, sky } = CityBuilder.setupLighting(this.scene, this.camera);
    this.sunlight = sunlight;
    this.sky = sky;
    CityBuilder.buildCityEnvironment(this.scene);

    // Initial spawn elevation aligned to terrain surface
    this.playerPos.y = getTerrainHeight(0, 0) + 1.7;
    this.camera.position.copy(this.playerPos);

    this.fpsViewModel = new FPSViewModel(this.camera);
    this.scene.add(this.camera);

    this.thirdPersonRig = new ThirdPersonRig();
    this.scene.add(this.thirdPersonRig.group);

    // 6. Initialize Post-Processing Manager (Contrast, Saturation, Exposure, Gamma)
    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);

    // 7. Setup Controls & Events
    this.setupEventListeners();

    // 8. Start Animation Loop
    this.animate();
  }

  private setupEventListeners() {
    const dom = this.container;

    dom.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        dom.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === dom;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPointerLocked) return;

      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;

      // Clamp vertical pitch (-85deg to +85deg)
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));

      if (this.fpsViewModel) {
        this.fpsViewModel.addMouseSway(e.movementX, e.movementY);
      }
    });

    // Mouse buttons
    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.isPointerLocked) return;

      if (e.button === 0) {
        this.isTriggerHeld = true;
      } else if (e.button === 2) {
        // Toggle Aim Down Sights (ADS)
        this.weaponState.isAiming = !this.weaponState.isAiming;
        soundEngine.playADS();
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this.isTriggerHeld = false;
        this.hasReleasedTriggerForSemi = true;
        this.weaponState.isFiring = false;
      }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard bindings
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keysPressed.add(e.code);

      if (e.code === 'KeyR' && !this.weaponState.isReloading) {
        this.reloadWeapon();
      }

      if ((e.code === 'KeyF' || e.code === 'KeyI') && !this.weaponState.isReloading) {
        this.inspectWeapon();
      }

      // Quick Weapon Hotkeys (1: AK-47, 2: M4A1, 3: M92FS, 4: MP5)
      if (e.code === 'Digit1') this.switchWeapon('ak47');
      if (e.code === 'Digit2') this.switchWeapon('m4a1');
      if (e.code === 'Digit3') this.switchWeapon('m92fs');
      if (e.code === 'Digit4') this.switchWeapon('mp5');
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysPressed.delete(e.code);
    });

    // Resize handler
    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.postProcessing) {
      this.postProcessing.setSize(width, height);
    }
  };

  public setPostProcessingSettings(settings: Partial<PostProcessingSettings>) {
    if (this.postProcessing) {
      this.postProcessing.setSettings(settings);
    }
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      if (settings.fogDensity !== undefined) {
        this.scene.fog.density = settings.fogDensity;
      }
      if (settings.fogColor !== undefined) {
        this.scene.fog.color.set(settings.fogColor);
      }
    }
    if (this.sky && settings.fogColor !== undefined) {
      this.sky.horizonColor.set(settings.fogColor);
      this.sky.material.uniforms.horizonColor.value = this.sky.horizonColor;
      if (this.sunlight) {
        this.sunlight.syncWithSky(this.sky);
      }
    }
  }

  public inspectWeapon() {
    if (this.fpsViewModel) {
      this.fpsViewModel.triggerInspect();
    }
  }

  public setOptics(type: 'none' | 'red_dot' | 'holographic') {
    this.activeOptic = type;
    if (this.fpsViewModel && this.fpsViewModel.weaponModel) {
      this.fpsViewModel.weaponModel.setOptics(type);
    }
  }

  public setBarrel(type: 'none' | 'suppressor') {
    this.activeBarrel = type;
    if (this.fpsViewModel && this.fpsViewModel.weaponModel) {
      this.fpsViewModel.weaponModel.setBarrel(type);
    }
  }

  public setUnderbarrel(type: 'none' | 'vertical_grip' | 'angled_grip') {
    this.activeUnderbarrel = type;
    if (this.fpsViewModel && this.fpsViewModel.weaponModel) {
      this.fpsViewModel.weaponModel.setUnderbarrel(type);
    }
  }

  public switchWeapon(weaponId: string) {
    if (!WEAPON_PROFILES[weaponId] || weaponId === this.activeWeaponId) return;
    this.activeWeaponId = weaponId;
    const profile = this.getActiveProfile();

    this.weaponState.id = profile.id;
    this.weaponState.name = profile.name;
    this.weaponState.caliber = profile.caliber;
    this.weaponState.ammoInMag = profile.ammoInMag;
    this.weaponState.maxMagSize = profile.maxMagSize;
    this.weaponState.reserveAmmo = profile.reserveAmmo;
    this.weaponState.isReloading = false;

    this.burstCount = 0;
    this.spreadHeat = 0;

    soundEngine.playBoltRack();
    if (this.fpsViewModel) {
      this.fpsViewModel.triggerInspect();
    }
  }

  public calculateCurrentSpread(): number {
    const profile = this.getActiveProfile();
    const sp = profile.spread;

    let spread = sp.baseStillSpread;

    // 1. Aiming Down Sights (ADS)
    if (this.weaponState.isAiming) {
      spread *= sp.adsSpreadMultiplier;
    }

    // 2. First Shot Precision
    if (this.burstCount === 0) {
      spread *= sp.firstShotMultiplier;
    }

    // 3. Crouching Stability
    if (this.isCrouching) {
      spread *= sp.crouchSpreadMultiplier;
    }

    // 4. Movement Penalties
    const isInputMoving =
      this.keysPressed.has('KeyW') ||
      this.keysPressed.has('KeyS') ||
      this.keysPressed.has('KeyA') ||
      this.keysPressed.has('KeyD');
    const isSprintingShift = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight');
    const isSprinting = isInputMoving && isSprintingShift && this.isGrounded && !this.isCrouching && !this.weaponState.isAiming;

    if (isSprinting) {
      spread += sp.sprintSpreadAdd;
    } else if (isInputMoving) {
      spread += sp.walkSpreadAdd;
    }

    // 5. Continuous Spray Heat
    spread += this.spreadHeat;

    return spread;
  }

  public fireActiveWeapon() {
    if (this.weaponState.isReloading) return;

    const profile = this.getActiveProfile();

    // Semi-automatic trigger check
    if (!profile.automatic && !this.hasReleasedTriggerForSemi) {
      return;
    }

    if (this.weaponState.ammoInMag <= 0) {
      soundEngine.playEmptyClick();
      this.reloadWeapon();
      this.hasReleasedTriggerForSemi = false;
      return;
    }

    // Enforce Rate of Fire RPM interval
    const now = performance.now();
    const minFireIntervalMs = 60000 / profile.fireRateRPM;
    if (now - this.lastFireTime < minFireIntervalMs) return;
    this.lastFireTime = now;

    this.weaponState.ammoInMag--;
    this.weaponState.isFiring = true;
    this.hasReleasedTriggerForSemi = false;

    // 1. Audio FX
    soundEngine.playGunshot(this.activeBarrel === 'suppressor');

    // 2. ViewModel Recoil & Shell Ejection
    if (this.fpsViewModel) {
      this.fpsViewModel.applyRecoil(profile.recoil, this.burstCount);

      const portLocalPos = new THREE.Vector3(0.08, 0.04, -0.08);
      const portWorldPos = new THREE.Vector3();
      const portWorldQuat = new THREE.Quaternion();
      this.fpsViewModel.weaponContainer.localToWorld(portWorldPos.copy(portLocalPos));
      this.fpsViewModel.weaponContainer.getWorldQuaternion(portWorldQuat);

      this.particleSystem.spawnShellEjection(portWorldPos, portWorldQuat);
    }

    // 3. Independent Camera Recoil (Instant Displacement + Spring Velocity)
    const camConfig = profile.cameraRecoil;
    const accum = Math.min(profile.recoil.maxAccumulation, 1.0 + this.burstCount * profile.recoil.accumulationRate);

    // Instant camera kick on frame
    this.camKickPitch += camConfig.pitch * accum;
    this.camKickYaw += (Math.random() - 0.5) * 2 * camConfig.yawVariance * accum;
    this.camKickRoll += (Math.random() - 0.5) * 2 * camConfig.rollVariance * accum;

    // Spring velocity impulse for rapid recovery
    const impulseScale = 12.0;
    this.camKickPitchVel += camConfig.pitch * accum * impulseScale;
    this.camKickYawVel += (Math.random() - 0.5) * 2 * camConfig.yawVariance * accum * impulseScale;
    this.camKickRollVel += (Math.random() - 0.5) * 2 * camConfig.rollVariance * accum * impulseScale;

    // Small persistent climb applied to player aim pitch (compensated by pulling mouse down)
    this.pitch += camConfig.pitch * 0.15 * accum;

    // 4. Update Burst & Spread Heat
    const currentSpreadRad = this.calculateCurrentSpread();
    this.burstCount++;
    this.spreadHeat = Math.min(profile.spread.maxHeatSpread, this.spreadHeat + profile.spread.heatPerShot);

    // 5. Precision Directional Raycast with 2D Box-Muller Normal Spread
    const u1 = Math.max(0.00001, Math.random());
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1)) * currentSpreadRad * 0.5;
    const theta = 2 * Math.PI * u2;
    const spreadOffsetX = r * Math.cos(theta);
    const spreadOffsetY = r * Math.sin(theta);

    const rayDir = new THREE.Vector3(spreadOffsetX, spreadOffsetY, -1).normalize();
    rayDir.applyQuaternion(this.camera.quaternion);

    const raycaster = new THREE.Raycaster(this.camera.position, rayDir);
    const intersects = raycaster.intersectObjects(this.scene.children, true);
    for (const hit of intersects) {
      if (
        hit.object.name.includes('ViewModel') ||
        hit.object.name.includes('AK47') ||
        hit.object.name.includes('Rig')
      ) {
        continue;
      }

      this.particleSystem.spawnImpactSparks(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0));
      soundEngine.playImpact();
      break;
    }
  }


  public reloadWeapon() {
    if (
      this.weaponState.isReloading ||
      this.weaponState.ammoInMag === this.weaponState.maxMagSize ||
      this.weaponState.reserveAmmo <= 0
    ) {
      return;
    }

    this.weaponState.isReloading = true;
    this.weaponState.isAiming = false;
    if (this.fpsViewModel) {
      this.fpsViewModel.triggerReload();
    }
    this.reloadTimer = 0;
    this.reloadPhaseFlickTriggered = false;
    this.reloadPhaseInsertTriggered = false;
    this.reloadPhaseRackTriggered = false;
  }

  public setFOV(fov: number) {
    this.baseFOV = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const profile = this.getActiveProfile();

    // 1. Firing vs Recovery (Burst Count & Spread Heat Decay)
    if (this.isTriggerHeld && this.isPointerLocked) {
      this.fireActiveWeapon();
    } else {
      this.hasReleasedTriggerForSemi = true;
      this.weaponState.isFiring = false;
      this.burstCount = Math.max(0, this.burstCount - delta * 14);
      this.spreadHeat = Math.max(0, this.spreadHeat - delta * profile.spread.heatDecaySpeed);
    }

    // 2. Physical Camera Recoil Spring Physics Integration
    const camConfig = profile.cameraRecoil;
    const stiffness = camConfig.recoverSpeed * camConfig.recoverSpeed;
    const damping = camConfig.damping;

    const pitchAccel = -stiffness * this.camKickPitch - damping * this.camKickPitchVel;
    this.camKickPitchVel += pitchAccel * delta;
    this.camKickPitch += this.camKickPitchVel * delta;

    const yawAccel = -stiffness * this.camKickYaw - damping * this.camKickYawVel;
    this.camKickYawVel += yawAccel * delta;
    this.camKickYaw += this.camKickYawVel * delta;

    const rollAccel = -stiffness * this.camKickRoll - damping * this.camKickRollVel;
    this.camKickRollVel += rollAccel * delta;
    this.camKickRoll += this.camKickRollVel * delta;

    // 3. Lean Mechanics (Q and E keys)
    const isLeanLeft = this.keysPressed.has('KeyQ');
    const isLeanRight = this.keysPressed.has('KeyE');

    const targetLeanRoll = isLeanLeft && !isLeanRight ? 0.20 : isLeanRight && !isLeanLeft ? -0.20 : 0;
    const targetLeanOffset = isLeanLeft && !isLeanRight ? -0.38 : isLeanRight && !isLeanLeft ? 0.38 : 0;

    this.currentLeanRoll = THREE.MathUtils.lerp(this.currentLeanRoll, targetLeanRoll, delta * 12);
    this.currentLeanOffset = THREE.MathUtils.lerp(this.currentLeanOffset, targetLeanOffset, delta * 12);

    // 4. Player FPS Movement Physics
    this.updatePlayerMovement(delta);

    // 5. Update Camera Rotation (pitch + spring pitch, yaw + spring yaw, spring roll + lean roll)
    const euler = new THREE.Euler(
      this.pitch + this.camKickPitch,
      this.yaw + this.camKickYaw,
      this.camKickRoll + this.currentLeanRoll,
      'YXZ'
    );
    this.camera.quaternion.setFromEuler(euler);

    // 6. Reload Logic
    if (this.weaponState.isReloading) {
      this.reloadTimer += delta;
      const TOTAL_RELOAD_TIME = 1.40;
      const t = Math.min(this.reloadTimer, TOTAL_RELOAD_TIME);

      if (t >= 0.18 && !this.reloadPhaseFlickTriggered) {
        this.reloadPhaseFlickTriggered = true;
        soundEngine.playMagFlick();
      }
      if (t >= 0.55 && !this.reloadPhaseInsertTriggered) {
        this.reloadPhaseInsertTriggered = true;
        soundEngine.playMagInsert();
        this.camKickPitchVel += 0.45;
      }
      if (t >= 0.90 && !this.reloadPhaseRackTriggered) {
        this.reloadPhaseRackTriggered = true;
        soundEngine.playBoltRack();
        this.camKickPitchVel -= 0.40;
      }

      if (t >= TOTAL_RELOAD_TIME) {
        const needed = this.weaponState.maxMagSize - this.weaponState.ammoInMag;
        const toLoad = Math.min(needed, this.weaponState.reserveAmmo);
        this.weaponState.ammoInMag += toLoad;
        this.weaponState.reserveAmmo -= toLoad;
        this.weaponState.isReloading = false;
        if (this.fpsViewModel) {
          this.fpsViewModel.isReloading = false;
        }
      }
    }

    // 7. Update FPS ViewModel & Particle System
    const currentHorizSpeed = Math.sqrt(this.playerVel.x * this.playerVel.x + this.playerVel.z * this.playerVel.z);
    const isInputMoving =
      this.keysPressed.has('KeyW') ||
      this.keysPressed.has('KeyS') ||
      this.keysPressed.has('KeyA') ||
      this.keysPressed.has('KeyD');
    const isMoving = isInputMoving || currentHorizSpeed > 0.4;
    const isSprintingShift = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight');
    const isSprinting = isInputMoving && isSprintingShift && this.isGrounded && !this.isCrouching && !this.weaponState.isAiming;

    // Sync current spread angle for HUD & Raycaster
    this.weaponState.currentSpreadRad = this.calculateCurrentSpread();

    const elapsedTime = this.clock.getElapsedTime();
    CityBuilder.update(elapsedTime);

    if (this.fpsViewModel) {
      this.fpsViewModel.update(
        delta,
        this.weaponState.isAiming,
        isMoving,
        isSprinting,
        this.isGrounded,
        this.currentLeanRoll,
        profile.recoil
      );
    }

    this.particleSystem.update(delta, this.playerPos, elapsedTime);

    // Camera FOV transition on ADS
    const targetFOV = this.weaponState.isAiming ? Math.max(30, this.baseFOV * 0.6) : this.baseFOV;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 12);
    this.camera.updateProjectionMatrix();

    // Dynamic view-based rim light update for silhouette readability
    if (this.sunlight) {
      this.sunlight.updateViewDirection(this.camera);
    }

    // Dynamic gradient sky update tracking camera position
    if (this.sky) {
      this.sky.update(this.camera);
    }

    // Render Frame via Post-Processing Composer
    if (this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updatePlayerMovement(delta: number) {
    if (!this.isPointerLocked) return;

    // Jump / Landing cooldown timer
    this.jumpCooldownTimer = Math.max(0, this.jumpCooldownTimer - delta);

    // Crouch State (C or Control)
    this.isCrouching = (this.keysPressed.has('KeyC') || this.keysPressed.has('ControlLeft') || this.keysPressed.has('ControlRight')) && this.isGrounded;

    // Smooth Eye Height Interpolation (Standing: 1.7m, Crouching: 1.15m)
    const targetEyeHeight = this.isCrouching ? 1.15 : 1.7;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetEyeHeight, delta * 10.0);

    // Direction calculation from yaw
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const moveDir = new THREE.Vector3(0, 0, 0);

    if (this.keysPressed.has('KeyW')) moveDir.add(forward);
    if (this.keysPressed.has('KeyS')) moveDir.sub(forward);
    if (this.keysPressed.has('KeyD')) moveDir.add(right);
    if (this.keysPressed.has('KeyA')) moveDir.sub(right);

    const isMovingInput = moveDir.lengthSq() > 0;
    if (isMovingInput) moveDir.normalize();

    const isAiming = this.weaponState.isAiming;
    const isSprintingShift = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight');
    const isSprinting = isMovingInput && isSprintingShift && this.isGrounded && !this.isCrouching && !isAiming;

    // Realistic Tactical Speeds (in m/s)
    let desiredMaxSpeed = 4.8; // Normal walk (17.2 km/h)
    if (this.isCrouching) desiredMaxSpeed = 2.6; // Crouch (9.3 km/h)
    else if (isAiming) desiredMaxSpeed = 3.4; // ADS walk (12.2 km/h)
    else if (isSprinting) desiredMaxSpeed = 7.8; // Tactical sprint (28 km/h)

    // Landing Impact & Anti-Bunny Hop Check
    if (!this.wasGrounded && this.isGrounded) {
      soundEngine.playFootstep();
      // Apply landing impact friction penalty: absorbs momentum & caps velocity
      this.playerVel.x *= 0.65;
      this.playerVel.z *= 0.65;
      const landingSpeed = Math.sqrt(this.playerVel.x * this.playerVel.x + this.playerVel.z * this.playerVel.z);
      const maxLandingSpeed = 4.8;
      if (landingSpeed > maxLandingSpeed) {
        const scale = maxLandingSpeed / landingSpeed;
        this.playerVel.x *= scale;
        this.playerVel.z *= scale;
      }
      this.jumpCooldownTimer = 0.35; // Landing recovery prevents instant hopping
    }
    this.wasGrounded = this.isGrounded;

    // Horizontal Movement Physics (Ground Acceleration vs Air Control)
    if (this.isGrounded) {
      if (isMovingInput) {
        const targetVelX = moveDir.x * desiredMaxSpeed;
        const targetVelZ = moveDir.z * desiredMaxSpeed;
        const accelRate = isSprinting ? 11.0 : 13.0;
        this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, targetVelX, delta * accelRate);
        this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, targetVelZ, delta * accelRate);
      } else {
        // Smooth Ground Friction Deceleration
        const frictionRate = 14.0;
        this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, 0, delta * frictionRate);
        this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, 0, delta * frictionRate);
      }
    } else {
      // In Air: Restricted air control prevents bunny-hopping speed manipulation
      if (isMovingInput) {
        const airAccel = 2.8;
        this.playerVel.x += moveDir.x * airAccel * delta;
        this.playerVel.z += moveDir.z * airAccel * delta;
        
        // Cap max horizontal air speed to sprint ceiling
        const airSpeed = Math.sqrt(this.playerVel.x * this.playerVel.x + this.playerVel.z * this.playerVel.z);
        const maxAirSpeed = 7.8;
        if (airSpeed > maxAirSpeed) {
          const scale = maxAirSpeed / airSpeed;
          this.playerVel.x *= scale;
          this.playerVel.z *= scale;
        }
      }
      // Natural air drag
      const airDrag = Math.pow(0.96, delta * 60);
      this.playerVel.x *= airDrag;
      this.playerVel.z *= airDrag;
    }

    // Ground Jump Execution with Anti-Bunnyhop Takeoff Penalty
    if (this.keysPressed.has('Space') && this.isGrounded && this.jumpCooldownTimer <= 0) {
      this.playerVel.y = 5.6; // Believable 0.8m vertical takeoff
      this.isGrounded = false;
      this.jumpCooldownTimer = 0.40; // Cooldown window
      // Takeoff penalty prevents jump-stacking speed exploits
      this.playerVel.x *= 0.88;
      this.playerVel.z *= 0.88;
    }

    // Vertical Gravity Integration & Terrain Surface Floor Collision
    const terrainHeight = getTerrainHeight(this.playerPos.x, this.playerPos.z);
    const targetGroundY = terrainHeight + this.currentEyeHeight;

    if (!this.isGrounded) {
      const gravity = 19.6;
      this.playerVel.y -= gravity * delta;
      this.playerPos.y += this.playerVel.y * delta;

      if (this.playerPos.y <= targetGroundY) {
        this.playerPos.y = targetGroundY;
        this.playerVel.y = 0;
        this.isGrounded = true;
      }
    } else {
      this.playerPos.y = THREE.MathUtils.lerp(this.playerPos.y, targetGroundY, delta * 14.0);
      this.playerVel.y = 0;
    }

    // Apply Horizontal Displacement
    this.playerPos.x += this.playerVel.x * delta;
    this.playerPos.z += this.playerVel.z * delta;

    // Footstep Sound Cycle based on true current velocity
    const currentSpeed = Math.sqrt(this.playerVel.x * this.playerVel.x + this.playerVel.z * this.playerVel.z);
    if (currentSpeed > 0.4 && this.isGrounded) {
      const stepRate = isSprinting ? 15 : this.isCrouching ? 7 : 10;
      this.stepCycle += delta * stepRate;
      this.footstepTimer += delta;
      const stepInterval = isSprinting ? 0.28 : this.isCrouching ? 0.52 : 0.40;
      if (this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        soundEngine.playFootstep();
      }
    }

    // Keep within city bounds (-230m to +230m)
    this.playerPos.x = Math.max(-230, Math.min(230, this.playerPos.x));
    this.playerPos.z = Math.max(-230, Math.min(230, this.playerPos.z));

    // Apply lateral camera lean offset relative to player yaw orientation
    const rightVector = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const cameraLeanPos = this.playerPos.clone().addScaledVector(rightVector, this.currentLeanOffset);
    this.camera.position.copy(cameraLeanPos);

    // Sync 3D body rig
    if (this.thirdPersonRig) {
      this.thirdPersonRig.updateAnimation(
        delta,
        this.playerPos,
        this.yaw,
        isMovingInput || currentSpeed > 0.4,
        isSprinting,
        this.stepCycle
      );
    }
  }

  public getPlayerFPSState(): PlayerFPSState {
    const speedKmH = Math.round(
      Math.sqrt(this.playerVel.x * this.playerVel.x + this.playerVel.z * this.playerVel.z) * 3.6
    );

    return {
      posX: Math.round(this.playerPos.x),
      posY: Math.round(this.playerPos.y * 10) / 10,
      posZ: Math.round(this.playerPos.z),
      speed: speedKmH,
      isGrounded: this.isGrounded,
      isSprinting: this.keysPressed.has('ShiftLeft'),
      isPointerLocked: this.isPointerLocked,
      weapon: { ...this.weaponState },
    };
  }

  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.particleSystem.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
