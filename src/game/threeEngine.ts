import * as THREE from 'three';
import { FPSViewModel } from './FPSViewModel';
import { CityBuilder } from './cityBuilder';
import { ParticleSystem } from './particleEffects';
import { ThirdPersonRig } from './thirdPersonRig';
import { Sunlight } from './sunlight';
import { GradientSky } from './sky';
import { PostProcessingManager } from './postProcessing';
import { soundEngine } from '../audio/soundSystem';
import { PlayerFPSState, WeaponState, PostProcessingSettings } from '../types';

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

  public weaponState: WeaponState = {
    name: 'AK-47 TÁTICA 7.62mm',
    ammoInMag: 30,
    maxMagSize: 30,
    reserveAmmo: 120,
    isReloading: false,
    isAiming: false,
    isFiring: false,
  };

  private camKickPitch = 0;
  private camKickRoll = 0;
  private lastFireTime = 0;
  private isTriggerHeld = false;
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
    if (this.fpsViewModel && this.fpsViewModel.weaponModel) {
      this.fpsViewModel.weaponModel.setOptics(type);
    }
  }

  public setBarrel(type: 'none' | 'suppressor') {
    if (this.fpsViewModel && this.fpsViewModel.weaponModel) {
      this.fpsViewModel.weaponModel.setBarrel(type);
    }
  }

  public setUnderbarrel(type: 'none' | 'vertical_grip' | 'angled_grip') {
    if (this.fpsViewModel && this.fpsViewModel.weaponModel) {
      this.fpsViewModel.weaponModel.setUnderbarrel(type);
    }
  }

  public fireAK47() {
    if (this.weaponState.isReloading) return;

    if (this.weaponState.ammoInMag <= 0) {
      soundEngine.playEmptyClick();
      this.reloadWeapon();
      return;
    }

    const now = performance.now();
    if (now - this.lastFireTime < 100) return; // 600 RPM (100ms interval)
    this.lastFireTime = now;

    this.weaponState.ammoInMag--;
    this.weaponState.isFiring = true;

    soundEngine.playGunshot(false);

    if (this.fpsViewModel) {
      this.fpsViewModel.applyRecoil();

      // World position for Shell Ejection (right receiver ejection port)
      const portLocalPos = new THREE.Vector3(0.08, 0.04, -0.08);
      const portWorldPos = new THREE.Vector3();
      const portWorldQuat = new THREE.Quaternion();
      this.fpsViewModel.weaponContainer.localToWorld(portWorldPos.copy(portLocalPos));
      this.fpsViewModel.weaponContainer.getWorldQuaternion(portWorldQuat);

      this.particleSystem.spawnShellEjection(portWorldPos, portWorldQuat);
    }
    this.camKickPitch += 0.015;

    // Raycast shot from center crosshair
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const intersects = raycaster.intersectObjects(this.scene.children, true);
    for (const hit of intersects) {
      if (hit.object.name.includes('ViewModel') || hit.object.name.includes('AK47')) continue;

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

    // 1. Continuous Automatic Firing
    if (this.isTriggerHeld && this.isPointerLocked) {
      this.fireAK47();
    }

    // 2. Camera Kick Recovery
    this.camKickPitch *= 0.84;
    this.camKickRoll *= 0.84;

    // 3. Lean Mechanics (Q and E keys)
    const isLeanLeft = this.keysPressed.has('KeyQ');
    const isLeanRight = this.keysPressed.has('KeyE');

    const targetLeanRoll = isLeanLeft && !isLeanRight ? 0.20 : isLeanRight && !isLeanLeft ? -0.20 : 0;
    const targetLeanOffset = isLeanLeft && !isLeanRight ? -0.38 : isLeanRight && !isLeanLeft ? 0.38 : 0;

    this.currentLeanRoll = THREE.MathUtils.lerp(this.currentLeanRoll, targetLeanRoll, delta * 12);
    this.currentLeanOffset = THREE.MathUtils.lerp(this.currentLeanOffset, targetLeanOffset, delta * 12);

    // 4. Player FPS Movement Physics
    this.updatePlayerMovement(delta);

    // 5. Update Camera Rotation (pitch, yaw, recoil roll & lean roll)
    const euler = new THREE.Euler(
      this.pitch + this.camKickPitch,
      this.yaw,
      this.camKickRoll + this.currentLeanRoll,
      'YXZ'
    );
    this.camera.quaternion.setFromEuler(euler);

    // 5. Reload Logic
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
        this.camKickPitch = 0.018;
      }
      if (t >= 0.90 && !this.reloadPhaseRackTriggered) {
        this.reloadPhaseRackTriggered = true;
        soundEngine.playBoltRack();
        this.camKickPitch = -0.016;
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

    // 6. Update FPS ViewModel & Particle System
    const currentHorizSpeed = Math.sqrt(this.playerVel.x * this.playerVel.x + this.playerVel.z * this.playerVel.z);
    const isInputMoving =
      this.keysPressed.has('KeyW') ||
      this.keysPressed.has('KeyS') ||
      this.keysPressed.has('KeyA') ||
      this.keysPressed.has('KeyD');
    const isMoving = isInputMoving || currentHorizSpeed > 0.4;
    const isSprintingShift = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight');
    const isSprinting = isInputMoving && isSprintingShift && this.isGrounded && !this.isCrouching && !this.weaponState.isAiming;

    if (this.fpsViewModel) {
      this.fpsViewModel.update(
        delta,
        this.weaponState.isAiming,
        isMoving,
        isSprinting,
        this.isGrounded,
        this.currentLeanRoll
      );
    }

    this.particleSystem.update(delta);

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

    // Vertical Gravity Integration & Floor Collision
    if (!this.isGrounded) {
      const gravity = 19.6;
      this.playerVel.y -= gravity * delta;
      this.playerPos.y += this.playerVel.y * delta;

      if (this.playerPos.y <= this.currentEyeHeight) {
        this.playerPos.y = this.currentEyeHeight;
        this.playerVel.y = 0;
        this.isGrounded = true;
      }
    } else {
      this.playerPos.y = THREE.MathUtils.lerp(this.playerPos.y, this.currentEyeHeight, delta * 12.0);
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
