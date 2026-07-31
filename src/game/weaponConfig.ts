export interface WeaponRecoilConfig {
  vertical: number;             // Upward pitch kick per shot (radians)
  horizontalVariance: number;   // Horizontal yaw randomness per shot (radians)
  horizontalBias: number;       // Direct sway bias (-1 left, +1 right)
  rollVariance: number;         // Weapon roll twist (radians)
  kickZ: number;                // Backward translation kick (meters)
  kickY: number;                // Upward translation kick (meters)
  accumulationRate: number;     // Recoil scaling per consecutive shot in burst
  maxAccumulation: number;      // Maximum recoil multiplier cap during long sprays
  recoverSpeed: number;         // Speed of recoil spring return to rest
  damping: number;              // Spring damping factor to eliminate robotic linear lerp
}

export interface CameraRecoilConfig {
  pitch: number;                // Camera pitch kick per shot (radians)
  yawVariance: number;          // Camera yaw randomness per shot (radians)
  rollVariance: number;         // Camera roll twist (radians)
  recoverSpeed: number;         // Camera recoil spring recovery speed
  damping: number;              // Camera spring damping
}

export interface DynamicSpreadConfig {
  baseStillSpread: number;      // Base spread standing still (radians)
  adsSpreadMultiplier: number;  // Spread multiplier when Aiming Down Sights
  firstShotMultiplier: number;  // Spread multiplier for 1st shot in burst (pinpoint precision)
  walkSpreadAdd: number;        // Additional spread when walking
  sprintSpreadAdd: number;      // Additional spread when sprinting
  crouchSpreadMultiplier: number;// Spread multiplier when crouched
  heatPerShot: number;          // Spread bloom added per shot in spray
  maxHeatSpread: number;        // Maximum spray bloom cap
  heatDecaySpeed: number;       // Speed of spread recovery when stopping fire
}

export interface WeaponProfile {
  id: string;
  name: string;
  caliber: string;
  fireRateRPM: number;          // Rate of fire in rounds per minute
  automatic: boolean;          // True for full-auto, false for semi-auto
  ammoInMag: number;
  maxMagSize: number;
  reserveAmmo: number;
  recoil: WeaponRecoilConfig;
  cameraRecoil: CameraRecoilConfig;
  spread: DynamicSpreadConfig;
}

export const WEAPON_PROFILES: Record<string, WeaponProfile> = {
  ak47: {
    id: 'ak47',
    name: 'AK-47 TÁTICA',
    caliber: '7.62x39mm',
    fireRateRPM: 600, // 100ms per shot
    automatic: true,
    ammoInMag: 30,
    maxMagSize: 30,
    reserveAmmo: 120,
    recoil: {
      vertical: 0.05,
      horizontalVariance: 0.024,
      horizontalBias: 0.08, // Slight right pull characteristic of 7.62mm AK
      rollVariance: 0.012,
      kickZ: 0.042,
      kickY: 0.012,
      accumulationRate: 0.08,
      maxAccumulation: 1.55,
      recoverSpeed: 28.0,
      damping: 18.0,
    },
    cameraRecoil: {
      pitch: 0.016,
      yawVariance: 0.006,
      rollVariance: 0.004,
      recoverSpeed: 30.0,
      damping: 20.0,
    },
    spread: {
      baseStillSpread: 0.006, // ~0.34 degrees
      adsSpreadMultiplier: 0.04, // Pinpoint precision in ADS
      firstShotMultiplier: 0.10, // Pristine first shot accuracy
      walkSpreadAdd: 0.014,
      sprintSpreadAdd: 0.040,
      crouchSpreadMultiplier: 0.60,
      heatPerShot: 0.0048,
      maxHeatSpread: 0.048,
      heatDecaySpeed: 10.0,
    },
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1 CARABINA',
    caliber: '5.56x45mm NATO',
    fireRateRPM: 750, // 80ms per shot
    automatic: true,
    ammoInMag: 30,
    maxMagSize: 30,
    reserveAmmo: 120,
    recoil: {
      vertical: 0.026,
      horizontalVariance: 0.009,
      horizontalBias: -0.05,
      rollVariance: 0.008,
      kickZ: 0.032,
      kickY: 0.008,
      accumulationRate: 0.04,
      maxAccumulation: 1.35,
      recoverSpeed: 30.0,
      damping: 20.0,
    },
    cameraRecoil: {
      pitch: 0.012,
      yawVariance: 0.004,
      rollVariance: 0.003,
      recoverSpeed: 32.0,
      damping: 21.0,
    },
    spread: {
      baseStillSpread: 0.0045,
      adsSpreadMultiplier: 0.03,
      firstShotMultiplier: 0.08,
      walkSpreadAdd: 0.010,
      sprintSpreadAdd: 0.032,
      crouchSpreadMultiplier: 0.55,
      heatPerShot: 0.0034,
      maxHeatSpread: 0.036,
      heatDecaySpeed: 12.0,
    },
  },
  m92fs: {
    id: 'm92fs',
    name: 'M92FS PISTOLA',
    caliber: '9x19mm Parabellum',
    fireRateRPM: 480, // 125ms semi-auto
    automatic: false,
    ammoInMag: 15,
    maxMagSize: 15,
    reserveAmmo: 90,
    recoil: {
      vertical: 0.048,
      horizontalVariance: 0.014,
      horizontalBias: 0.0,
      rollVariance: 0.012,
      kickZ: 0.032,
      kickY: 0.018,
      accumulationRate: 0.09,
      maxAccumulation: 1.50,
      recoverSpeed: 28.0,
      damping: 18.0,
    },
    cameraRecoil: {
      pitch: 0.016,
      yawVariance: 0.006,
      rollVariance: 0.006,
      recoverSpeed: 28.0,
      damping: 18.0,
    },
    spread: {
      baseStillSpread: 0.0055,
      adsSpreadMultiplier: 0.08,
      firstShotMultiplier: 0.15,
      walkSpreadAdd: 0.012,
      sprintSpreadAdd: 0.038,
      crouchSpreadMultiplier: 0.65,
      heatPerShot: 0.0055,
      maxHeatSpread: 0.045,
      heatDecaySpeed: 14.0,
    },
  },
  mp5: {
    id: 'mp5',
    name: 'MP5 SUBMETRALHADORA',
    caliber: '9x19mm Parabellum',
    fireRateRPM: 800, // 75ms per shot
    automatic: true,
    ammoInMag: 30,
    maxMagSize: 30,
    reserveAmmo: 120,
    recoil: {
      vertical: 0.022,
      horizontalVariance: 0.009,
      horizontalBias: 0.02,
      rollVariance: 0.007,
      kickZ: 0.028,
      kickY: 0.007,
      accumulationRate: 0.035,
      maxAccumulation: 1.30,
      recoverSpeed: 26.0,
      damping: 17.0,
    },
    cameraRecoil: {
      pitch: 0.010,
      yawVariance: 0.004,
      rollVariance: 0.003,
      recoverSpeed: 27.0,
      damping: 17.0,
    },
    spread: {
      baseStillSpread: 0.004,
      adsSpreadMultiplier: 0.05,
      firstShotMultiplier: 0.10,
      walkSpreadAdd: 0.008,
      sprintSpreadAdd: 0.028,
      crouchSpreadMultiplier: 0.58,
      heatPerShot: 0.0028,
      maxHeatSpread: 0.030,
      heatDecaySpeed: 13.0,
    },
  },
};

/**
 * Calculates active weapon parameters modified by attached tactical accessories.
 */
export function getModifiedWeaponProfile(
  baseProfile: WeaponProfile,
  optic: 'none' | 'red_dot' | 'holographic',
  barrel: 'none' | 'suppressor',
  underbarrel: 'none' | 'vertical_grip' | 'angled_grip'
): WeaponProfile {
  const profile: WeaponProfile = JSON.parse(JSON.stringify(baseProfile));

  // 1. Underbarrel Grip Modifiers
  if (underbarrel === 'vertical_grip') {
    // Vertical grip reduces vertical recoil & camera pitch by 25%
    profile.recoil.vertical *= 0.75;
    profile.recoil.kickY *= 0.75;
    profile.cameraRecoil.pitch *= 0.75;
  } else if (underbarrel === 'angled_grip') {
    // Angled grip reduces horizontal recoil variance by 30% and increases recovery speed
    profile.recoil.horizontalVariance *= 0.70;
    profile.recoil.recoverSpeed *= 1.25;
    profile.cameraRecoil.recoverSpeed *= 1.20;
  }

  // 2. Barrel Muzzle Modifiers
  if (barrel === 'suppressor') {
    // Suppressor slightly reduces recoil pitch & spread, dampens sound report
    profile.recoil.vertical *= 0.90;
    profile.spread.baseStillSpread *= 0.85;
  }

  // 3. Optic Sight Modifiers
  if (optic !== 'none') {
    // Precision optics improve ADS accuracy multiplier by 30%
    profile.spread.adsSpreadMultiplier *= 0.70;
  }

  return profile;
}

