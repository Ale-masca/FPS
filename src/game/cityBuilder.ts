import * as THREE from 'three';
import { Sunlight } from './sunlight';
import { GradientSky } from './sky';
import { applyVertexAOToMesh, createContactAOPlane } from './ambientOcclusion';

export class CityBuilder {
  public static setupLighting(scene: THREE.Scene, camera: THREE.Camera): { sunlight: Sunlight; sky: GradientSky } {
    // 1. Create Gradient Sky Dome with smooth horizon transition
    const sky = new GradientSky({
      topColor: 0x0284c7,       // Atmospheric Deep Sky Blue
      horizonColor: 0x7dd3fc,   // Light Cyan/Blue Horizon
      bottomColor: 0x0f172a,    // Ground Slate Horizon
      exponent: 0.65,
    });
    scene.add(sky.mesh);

    // 2. Set atmospheric fog matching the sky horizon color for seamless distant blending
    scene.fog = new THREE.FogExp2(sky.horizonColor, 0.0055);

    // 3. Hemisphere lighting: Upward/downward ambient colors driven directly by gradient sky colors
    const sunlight = new Sunlight(
      new THREE.Vector3(0.5, 0.8, 0.4), // Sunlight direction vector
      0xfffae6,                         // Direct sunlight color
      1.15,                             // Direct sunlight intensity
      sky.getSkyAmbientColor(),         // Upward sky ambient color
      sky.getGroundAmbientColor(),      // Downward ground ambient color
      0.65,                             // Hemisphere light intensity
      0xbfdbfe,                         // View rim light color
      0.40                              // Rim light intensity
    );

    // Keep sunlight synced with sky colors
    sunlight.syncWithSky(sky);

    // Add directional sunlight, sky/ground hemisphere light, and view rim light to the scene
    scene.add(sunlight.light);
    scene.add(sunlight.ambientLight);
    scene.add(sunlight.rimLight);
    scene.add(sunlight.rimLight.target);

    // Dedicated Camera Fill Light for First-Person ViewModel (Weapon & Arms illumination)
    const cameraLight = new THREE.PointLight(0xfffbeb, 1.2, 6);
    cameraLight.position.set(0.1, 0.1, -0.1);
    camera.add(cameraLight);

    return { sunlight, sky };
  }

  public static buildCityEnvironment(scene: THREE.Scene) {
    // 1. Ground Asphalt Plane
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Road Grid (Avenues & Cross Streets)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

    // Main Avenue
    const aveGeo = new THREE.PlaneGeometry(32, 480);
    const ave = new THREE.Mesh(aveGeo, roadMat);
    ave.rotation.x = -Math.PI / 2;
    ave.position.set(0, 0.02, 0);
    scene.add(ave);

    // Center yellow line markings
    for (let z = -230; z <= 230; z += 12) {
      const lineGeo = new THREE.PlaneGeometry(0.4, 6);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.03, z);
      scene.add(line);
    }

    // Cross Street 1
    const cross1Geo = new THREE.PlaneGeometry(480, 24);
    const cross1 = new THREE.Mesh(cross1Geo, roadMat);
    cross1.rotation.x = -Math.PI / 2;
    cross1.position.set(0, 0.02, -80);
    scene.add(cross1);

    // Cross Street 2
    const cross2Geo = new THREE.PlaneGeometry(480, 24);
    const cross2 = new THREE.Mesh(cross2Geo, roadMat);
    cross2.rotation.x = -Math.PI / 2;
    cross2.position.set(0, 0.02, 80);
    scene.add(cross2);

    // Sidewalks along avenue (Raised 0.15m concrete)
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });

    const swLeftGeo = new THREE.BoxGeometry(10, 0.3, 480);
    const swLeft = new THREE.Mesh(swLeftGeo, sidewalkMat);
    swLeft.position.set(-21, 0.15, 0);
    applyVertexAOToMesh(swLeft, { minAO: 0.5, groundAO: true });
    scene.add(swLeft);

    const swRight = new THREE.Mesh(swLeftGeo.clone(), sidewalkMat);
    swRight.position.set(21, 0.15, 0);
    applyVertexAOToMesh(swRight, { minAO: 0.5, groundAO: true });
    scene.add(swRight);

    // Sidewalk contact shadows along roadside edge
    const swLeftContact = createContactAOPlane(12, 480, 0.55);
    swLeftContact.position.set(-21, 0.02, 0);
    scene.add(swLeftContact);

    const swRightContact = createContactAOPlane(12, 480, 0.55);
    swRightContact.position.set(21, 0.02, 0);
    scene.add(swRightContact);

    // Skyscrapers and City Blocks
    const buildingColors = [0x1e293b, 0x334155, 0x0f172a, 0x1e1b4b, 0x312e81, 0x0284c7];

    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        if (col === 0) continue; // Avenue gap
        if (row === -1 && Math.abs(col) <= 1) continue; // Intersection gap

        const height = Math.random() * 55 + 25;
        const width = Math.random() * 10 + 22;
        const depth = Math.random() * 10 + 22;

        const bGeo = new THREE.BoxGeometry(width, height, depth);
        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
        const building = new THREE.Mesh(bGeo, bMat);

        // Apply vertex AO to emphasize base contact and corner edge creases
        applyVertexAOToMesh(building, { minAO: 0.32, groundAO: true, heightExponent: 1.4, cornerAO: true, creaseIntensity: 0.30 });

        const bx = col * 42 + (col > 0 ? 10 : -10);
        const bz = row * 48;
        building.position.set(bx, height / 2, bz);
        scene.add(building);

        // Baked contact AO shadow plane at building base footprint
        const bContact = createContactAOPlane(width + 8, depth + 8, 0.78);
        bContact.position.set(bx, 0.025, bz);
        scene.add(bContact);

        this.addBuildingWindows(building, width, height, depth);
      }
    }

    // Street Lights along Sidewalks
    for (let z = -200; z <= 200; z += 30) {
      this.createStreetLight(scene, -16.5, z);
      this.createStreetLight(scene, 16.5, z);
    }

    // Parked Cars along curb
    for (let z = -180; z <= 180; z += 50) {
      if (Math.abs(z - 80) < 15 || Math.abs(z + 80) < 15) continue; // Don't block intersections
      this.createParkedCar(scene, -14.2, z, Math.random() > 0.5 ? 0xef4444 : 0x3b82f6);
      this.createParkedCar(scene, 14.2, z + 20, Math.random() > 0.5 ? 0x10b981 : 0x64748b);
    }

    // Urban Props (Benches, Trash Cans, Fire Hydrants)
    for (let z = -190; z <= 190; z += 40) {
      this.createUrbanProp(scene, -17.5, z);
      this.createUrbanProp(scene, 17.5, z + 15);
    }

    // Outer Perimeter Barrier
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 });
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(500, 12, 4), fenceMat);
    applyVertexAOToMesh(northWall, { minAO: 0.35, groundAO: true });
    northWall.position.set(0, 6, -240);
    scene.add(northWall);

    const northContact = createContactAOPlane(500, 10, 0.70);
    northContact.position.set(0, 0.025, -240);
    scene.add(northContact);

    const southWall = new THREE.Mesh(new THREE.BoxGeometry(500, 12, 4), fenceMat);
    applyVertexAOToMesh(southWall, { minAO: 0.35, groundAO: true });
    southWall.position.set(0, 6, 240);
    scene.add(southWall);

    const southContact = createContactAOPlane(500, 10, 0.70);
    southContact.position.set(0, 0.025, 240);
    scene.add(southContact);
  }

  private static addBuildingWindows(building: THREE.Mesh, w: number, h: number, d: number) {
    const winMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const winGeo = new THREE.PlaneGeometry(1.2, 1.8);

    for (let y = 4; y < h - 3; y += 4) {
      for (let x = -w / 2 + 2.5; x < w / 2 - 2; x += 3.2) {
        if (Math.random() > 0.35) {
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(x, y - h / 2, d / 2 + 0.05);
          building.add(win);
        }
      }
    }
  }

  private static createStreetLight(scene: THREE.Scene, x: number, z: number) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6), poleMat);
    pole.position.set(x, 3, z);
    applyVertexAOToMesh(pole, { minAO: 0.45 });
    scene.add(pole);

    const poleContact = createContactAOPlane(2.2, 2.2, 0.55);
    poleContact.position.set(x, 0.025, z);
    scene.add(poleContact);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x + (x > 0 ? -0.6 : 0.6), 5.8, z);
    scene.add(arm);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    globe.position.set(x + (x > 0 ? -1.2 : 1.2), 5.6, z);
    scene.add(globe);

    const light = new THREE.PointLight(0xfef08a, 0.8, 18);
    light.position.set(globe.position.x, globe.position.y, globe.position.z);
    scene.add(light);
  }

  private static createParkedCar(scene: THREE.Scene, x: number, z: number, colorHex: number) {
    const carGroup = new THREE.Group();
    carGroup.position.set(x, 0.8, z);

    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.5, roughness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 4.2), bodyMat);
    applyVertexAOToMesh(chassis, { minAO: 0.45, cornerAO: true, creaseIntensity: 0.25 });
    carGroup.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), glassMat);
    cabin.position.set(0, 0.7, -0.2);
    applyVertexAOToMesh(cabin, { minAO: 0.50 });
    carGroup.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    [[-1.0, -0.4, 1.2], [1.0, -0.4, 1.2], [-1.0, -0.4, -1.2], [1.0, -0.4, -1.2]].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      carGroup.add(wheel);
    });

    scene.add(carGroup);

    // Contact shadow plane on asphalt under vehicle chassis
    const carContact = createContactAOPlane(3.4, 5.6, 0.82);
    carContact.position.set(x, 0.025, z);
    scene.add(carContact);
  }

  private static createUrbanProp(scene: THREE.Scene, x: number, z: number) {
    const isDumpster = Math.random() > 0.5;
    if (isDumpster) {
      const dumpster = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 })
      );
      applyVertexAOToMesh(dumpster, { minAO: 0.38, cornerAO: true, creaseIntensity: 0.35 });
      dumpster.position.set(x, 0.6, z);
      scene.add(dumpster);

      const dContact = createContactAOPlane(2.8, 2.2, 0.72);
      dContact.position.set(x, 0.025, z);
      scene.add(dContact);
    } else {
      const hydrant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4 })
      );
      applyVertexAOToMesh(hydrant, { minAO: 0.45 });
      hydrant.position.set(x, 0.35, z);
      scene.add(hydrant);

      const hContact = createContactAOPlane(1.4, 1.4, 0.65);
      hContact.position.set(x, 0.025, z);
      scene.add(hContact);
    }
  }
}
