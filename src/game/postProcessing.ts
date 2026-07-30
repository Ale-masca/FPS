import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { PostProcessingSettings } from '../types';

/**
 * Custom Post-Processing Shader for Contrast, Saturation, Exposure, and Gamma controls.
 * Applies ACES Filmic tone mapping and sRGB gamma conversion to produce bright, rich visuals.
 */
const ColorCorrectionShader = {
  name: 'ColorCorrectionShader',
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.0 },
    saturation: { value: 1.0 },
    exposure: { value: 1.15 },
    gamma: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform float exposure;
    uniform float gamma;

    varying vec2 vUv;

    // ACES Filmic Tone Mapping curve
    vec3 ACESFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec4 texColor = texture2D(tDiffuse, vUv);
      vec3 color = texColor.rgb;

      // 1. Exposure multiplier (brightens linear render target to match direct rendering)
      color *= exposure * 1.35;

      // 2. ACES Filmic Tone Mapping
      color = ACESFilm(color);

      // 3. Contrast adjustment (centered around mid-gray 0.5)
      color = (color - vec3(0.5)) * contrast + vec3(0.5);

      // 4. Saturation adjustment via Rec.709 luminance weights
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luminance), color, saturation);

      // 5. Gamma Correction & sRGB Output Encoding (sRGB gamma ~2.2 curve modulated by user gamma setting)
      color = max(color, vec3(0.0));
      float effectiveGamma = max(gamma, 0.1);
      color = pow(color, vec3(1.0 / (2.2 * effectiveGamma)));

      gl_FragColor = vec4(color, texColor.a);
    }
  `,
};

export class PostProcessingManager {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private colorPass: ShaderPass;

  public settings: PostProcessingSettings = {
    contrast: 1.02,
    saturation: 1.08,
    exposure: 1.15,
    gamma: 1.0,
    bloomStrength: 0.22,  // Subtle realistic bloom intensity
    bloomThreshold: 0.85, // Only affects bright highlights
    bloomRadius: 0.35,    // Soft localized bloom radius
    fogDensity: 0.0055,   // Exponential distance fog density
    fogColor: '#7dd3fc',  // Horizon cyan sky fog color
  };

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.composer = new EffectComposer(renderer);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    const size = renderer.getSize(new THREE.Vector2());
    this.bloomPass = new UnrealBloomPass(
      size,
      this.settings.bloomStrength,
      this.settings.bloomRadius,
      this.settings.bloomThreshold
    );
    this.composer.addPass(this.bloomPass);

    this.colorPass = new ShaderPass(ColorCorrectionShader as any);
    this.composer.addPass(this.colorPass);

    this.updateUniforms();
  }

  public setSettings(newSettings: Partial<PostProcessingSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.updateUniforms();
  }

  public updateUniforms(): void {
    if (this.colorPass && this.colorPass.uniforms) {
      this.colorPass.uniforms.contrast.value = this.settings.contrast;
      this.colorPass.uniforms.saturation.value = this.settings.saturation;
      this.colorPass.uniforms.exposure.value = this.settings.exposure;
      this.colorPass.uniforms.gamma.value = this.settings.gamma;
    }
    if (this.bloomPass) {
      this.bloomPass.strength = this.settings.bloomStrength;
      this.bloomPass.threshold = this.settings.bloomThreshold;
      this.bloomPass.radius = this.settings.bloomRadius;
    }
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  public render(): void {
    this.composer.render();
  }
}


