import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import { IdleAnimator } from "./IdleAnimator.js";

export class AvatarScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private vrm: VRM | null = null;
  private idleAnimator: IdleAnimator;
  private clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    // Try with default settings, fall back to software rendering
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      // Retry without antialias and with failIfMajorPerformanceCaveat disabled
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
          failIfMajorPerformanceCaveat: false,
          powerPreference: "default",
        });
      } catch (e) {
        throw new Error(
          "WebGL not available. Launch your browser with: --enable-webgl --ignore-gpu-blocklist --use-gl=angle",
        );
      }
    }
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    this.camera.position.set(0, 1.4, 1.2);
    this.camera.lookAt(0, 1.3, 0);

    this.setupLighting();
    this.idleAnimator = new IdleAnimator();
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 3, 2);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-2, 2, 1);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 2, -2);
    this.scene.add(rim);
  }

  async loadAvatar(url: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM;

    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
    }

    vrm.scene.rotation.y = Math.PI; // Face camera
    this.scene.add(vrm.scene);
    this.vrm = vrm;
  }

  setBlendshapes(shapes: Record<string, number>) {
    if (!this.vrm?.expressionManager) return;

    // Reset all
    this.vrm.expressionManager.resetValues();

    // Apply viseme shapes
    for (const [name, value] of Object.entries(shapes)) {
      this.vrm.expressionManager.setValue(name, value);
    }
  }

  update() {
    const delta = this.clock.getDelta();

    if (this.vrm) {
      // Apply idle animations (blink, breathing)
      const idleShapes = this.idleAnimator.update(delta);
      for (const [name, value] of Object.entries(idleShapes)) {
        // Only apply idle if not overridden by visemes
        const current = this.vrm.expressionManager?.getValue(name) ?? 0;
        if (current === 0) {
          this.vrm.expressionManager?.setValue(name, value);
        }
      }

      this.vrm.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.renderer.dispose();
  }
}
