export interface WeaponState {
  name: string;
  ammoInMag: number;
  maxMagSize: number;
  reserveAmmo: number;
  isReloading: boolean;
  isAiming: boolean;
  isFiring: boolean;
}

export interface PlayerFPSState {
  posX: number;
  posY: number;
  posZ: number;
  speed: number;
  isGrounded: boolean;
  isSprinting: boolean;
  isPointerLocked: boolean;
  weapon: WeaponState;
}

export type GraphicsPreset = 'Baixo' | 'Médio' | 'Alto' | 'Ultra';

export interface PostProcessingSettings {
  contrast: number;
  saturation: number;
  exposure: number;
  gamma: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number;
  fogDensity: number;
  fogColor: string;
}
