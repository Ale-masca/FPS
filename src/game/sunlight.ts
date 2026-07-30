import * as THREE from 'three';
import { GradientSky } from './sky';

/**
 * Lightweight Directional Sunlight utilizing Lambert diffuse lighting (N · L)
 * balanced with soft sky-tinted ambient skylight driven by gradient sky dome colors.
 */
export class Sunlight {
  public light: THREE.DirectionalLight;
  public ambientLight: THREE.HemisphereLight;
  public rimLight: THREE.DirectionalLight;
  public direction: THREE.Vector3;
  public color: THREE.Color;
  public intensity: number;

  constructor(
    direction: THREE.Vector3 = new THREE.Vector3(0.5, 0.8, 0.4),
    color: THREE.ColorRepresentation = 0xfffae6,
    intensity: number = 1.15,
    skyColor: THREE.ColorRepresentation = 0x60a5fa, // Soft atmospheric blue
    groundColor: THREE.ColorRepresentation = 0x1e293b, // Dark slate bounce
    ambientIntensity: number = 0.55,
    rimColor: THREE.ColorRepresentation = 0xbfdbfe, // Soft icy cyan-blue rim tint
    rimIntensity: number = 0.45
  ) {
    this.direction = direction.clone().normalize();
    this.color = new THREE.Color(color);
    this.intensity = intensity;

    // 1. Create single-pass Directional Sunlight (Lambertian N · L diffuse)
    this.light = new THREE.DirectionalLight(this.color, this.intensity);
    this.light.castShadow = false;

    // 2. Hemisphere lighting: upward-facing (+Y) normals receive soft sky blue, downward-facing (-Y) normals receive subtle ground bounce tint
    this.ambientLight = new THREE.HemisphereLight(skyColor, groundColor, ambientIntensity);
    this.ambientLight.position.set(0, 50, 0); // Define explicit vertical sky axis (0, 1, 0) for hemisphere gradient calculation

    // 3. View-direction based subtle rim light for enhanced silhouette edge readability
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
   */
  public syncWithSky(sky: GradientSky): void {
    const skyAmbient = sky.getSkyAmbientColor();
    const groundAmbient = sky.getGroundAmbientColor();
    this.ambientLight.color.copy(skyAmbient);
    this.ambientLight.groundColor.copy(groundAmbient);
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
