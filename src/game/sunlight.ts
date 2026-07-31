import * as THREE from 'three';
import { GradientSky } from './sky';

/**
 * Lightweight Directional Sunlight utilizing Lambert diffuse lighting (N · L)
 * balanced with soft sky-tinted ambient skylight driven by gradient sky dome colors.
 */
export class Sunlight {
  public light: THREE.DirectionalLight;
  public ambientLight: THREE.HemisphereLight;
  public skyFillLight: THREE.DirectionalLight;
  public globalAmbient: THREE.AmbientLight;
  public rimLight: THREE.DirectionalLight;
  public direction: THREE.Vector3;
  public color: THREE.Color;
  public intensity: number;

  constructor(
    direction: THREE.Vector3 = new THREE.Vector3(0.65, 0.60, 0.40),
    color: THREE.ColorRepresentation = 0xffedd5,
    intensity: number = 1.30,
    skyColor: THREE.ColorRepresentation = 0x93c5fd, // Luminous sky blue
    groundColor: THREE.ColorRepresentation = 0x475569, // Forest earth bounce
    ambientIntensity: number = 1.25,
    rimColor: THREE.ColorRepresentation = 0xbae6fd, // Soft atmospheric rim light
    rimIntensity: number = 0.45
  ) {
    this.direction = direction.clone().normalize();
    this.color = new THREE.Color(color);
    this.intensity = intensity;

    // 1. Primary Directional Sunlight
    this.light = new THREE.DirectionalLight(this.color, this.intensity);
    this.light.castShadow = false;

    // 2. Hemisphere Sky/Ground Ambient Lighting (Indirect Skylight)
    this.ambientLight = new THREE.HemisphereLight(skyColor, groundColor, ambientIntensity);
    this.ambientLight.position.set(0, 50, 0);

    // 3. Secondary Sky Fill Light (Simulates Rayleigh sky dome scattering opposing sun)
    const fillDir = new THREE.Vector3(-this.direction.x, 0.75, -this.direction.z).normalize();
    this.skyFillLight = new THREE.DirectionalLight(0x94a3b8, 0.60);
    this.skyFillLight.position.copy(fillDir).multiplyScalar(150);
    this.skyFillLight.castShadow = false;

    // 4. Global Ambient Light Floor (Guarantees no surface drops to pitch black)
    this.globalAmbient = new THREE.AmbientLight(0x64748b, 0.40);

    // 5. View-direction based subtle rim light for silhouette readability
    this.rimLight = new THREE.DirectionalLight(rimColor, rimIntensity);
    this.rimLight.castShadow = false;

    this.updatePosition();
  }

  /**
   * Sets and normalizes the directional light vector (L)
   */
  public setDirection(x: number, y: number, z: number): void {
    this.direction.set(x, y, z).normalize();
    this.updatePosition();
  }

  /**
   * Sets the sunlight color
   */
  public setColor(color: THREE.ColorRepresentation): void {
    this.color.set(color);
    this.light.color.copy(this.color);
  }

  /**
   * Sets the sunlight intensity
   */
  public setIntensity(intensity: number): void {
    this.intensity = intensity;
    this.light.intensity = intensity;
  }

  /**
   * Syncs hemisphere ambient sky & ground colors directly from the GradientSky colors
   * with lifted minimum shadow radiance to prevent pitch-black areas.
   */
  public syncWithSky(sky: GradientSky): void {
    const skyAmbient = sky.getSkyAmbientColor();
    const groundAmbient = sky.getGroundAmbientColor();

    // Lift shadow baseline radiance so shadowed detail is rich and clear
    const liftedSky = skyAmbient.clone().lerp(new THREE.Color(0x93c5fd), 0.40);
    const liftedGround = groundAmbient.clone().lerp(new THREE.Color(0x52606d), 0.60);

    this.ambientLight.color.copy(liftedSky);
    this.ambientLight.groundColor.copy(liftedGround);
  }

  /**
   * Adjusts the ambient hemisphere sky and ground colors/intensity.
   * Upward normals reflect sky color, downward normals reflect ground color.
   */
  public setHemisphereColors(
    skyColor: THREE.ColorRepresentation,
    groundColor: THREE.ColorRepresentation,
    intensity?: number
  ): void {
    this.ambientLight.color.set(skyColor);
    this.ambientLight.groundColor.set(groundColor);
    if (intensity !== undefined) {
      this.ambientLight.intensity = intensity;
    }
  }

  /**
   * Adjusts the ambient blue skylight intensity to balance with sunlight
   */
  public setAmbientIntensity(intensity: number): void {
    this.ambientLight.intensity = intensity;
  }

  /**
   * Dynamically positions the subtle rim light opposing the camera's view direction
   * to accentuate silhouette edges and improve weapon/environment contrast.
   */
  public updateViewDirection(camera: THREE.Camera): void {
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);

    // Position rim light at a backlight offset relative to the view vector
    const rimDir = viewDir.clone().negate().add(new THREE.Vector3(0.3, 0.6, 0.1)).normalize();
    this.rimLight.position.copy(camera.position).addScaledVector(rimDir, 40);
    this.rimLight.target.position.copy(camera.position);
    this.rimLight.target.updateMatrixWorld();
  }

  /**
   * Positions light along the normalized direction vector from origin
   */
  private updatePosition(): void {
    this.light.position.copy(this.direction).multiplyScalar(200);
    this.light.target.position.set(0, 0, 0);
  }
}
