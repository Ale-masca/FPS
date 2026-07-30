import * as THREE from 'three';

export interface GradientSkyOptions {
  topColor?: THREE.ColorRepresentation;
  horizonColor?: THREE.ColorRepresentation;
  bottomColor?: THREE.ColorRepresentation;
  exponent?: number;
  radius?: number;
}

/**
 * Gradient Sky Dome featuring smooth horizon transitions.
 * Derived sky colors dynamically drive scene hemisphere ambient lighting.
 */
export class GradientSky {
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;
  public topColor: THREE.Color;
  public horizonColor: THREE.Color;
  public bottomColor: THREE.Color;

  constructor(options: GradientSkyOptions = {}) {
    this.topColor = new THREE.Color(options.topColor ?? 0x0284c7);       // Atmospheric Deep Sky Blue
    this.horizonColor = new THREE.Color(options.horizonColor ?? 0x7dd3fc); // Bright Horizon Blue/Cyan
    this.bottomColor = new THREE.Color(options.bottomColor ?? 0x0f172a);  // Dark Slate Ground Horizon

    const exponent = options.exponent ?? 0.65;
    const radius = options.radius ?? 550;

    const geometry = new THREE.SphereGeometry(radius, 32, 24);

    this.material = new THREE.ShaderMaterial({
      name: 'GradientSkyShader',
      uniforms: {
        topColor: { value: this.topColor },
        horizonColor: { value: this.horizonColor },
        bottomColor: { value: this.bottomColor },
        exponent: { value: exponent },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz - cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float exponent;

        varying vec3 vWorldPosition;

        void main() {
          vec3 normPos = normalize(vWorldPosition);
          float h = normPos.y;

          vec3 finalColor;
          if (h >= 0.0) {
            float factor = pow(clamp(h, 0.0, 1.0), exponent);
            finalColor = mix(horizonColor, topColor, factor);
          } else {
            float factor = pow(clamp(-h, 0.0, 1.0), exponent);
            finalColor = mix(horizonColor, bottomColor, factor);
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  /**
   * Updates sky dome position to remain centered around the camera
   */
  public update(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }

  /**
   * Updates sky colors and recalculates uniforms
   */
  public setColors(
    topColor: THREE.ColorRepresentation,
    horizonColor: THREE.ColorRepresentation,
    bottomColor: THREE.ColorRepresentation
  ): void {
    this.topColor.set(topColor);
    this.horizonColor.set(horizonColor);
    this.bottomColor.set(bottomColor);

    this.material.uniforms.topColor.value = this.topColor;
    this.material.uniforms.horizonColor.value = this.horizonColor;
    this.material.uniforms.bottomColor.value = this.bottomColor;
  }

  /**
   * Derives upper (+Y) sky ambient color influenced by top and horizon sky blend
   */
  public getSkyAmbientColor(): THREE.Color {
    return new THREE.Color().copy(this.topColor).lerp(this.horizonColor, 0.45);
  }

  /**
   * Derives lower (-Y) ground ambient color influenced by bottom and horizon sky blend
   */
  public getGroundAmbientColor(): THREE.Color {
    return new THREE.Color().copy(this.bottomColor).lerp(this.horizonColor, 0.25);
  }
}
