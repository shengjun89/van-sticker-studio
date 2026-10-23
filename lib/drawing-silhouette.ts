import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Screen-space ink around the vehicle's visible silhouette, including smooth roof panels. */
export class DrawingSilhouette {
  private target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  private mask = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  private black = new THREE.Color(0);
  private size = new THREE.Vector2();
  private ink = new THREE.ShaderMaterial({
    uniforms: {
      tMask: { value: this.target.texture },
      stepSize: { value: new THREE.Vector2() },
      inkColor: { value: new THREE.Color('#354239') },
      opacity: { value: 0.8 },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tMask;
      uniform vec2 stepSize;
      uniform vec3 inkColor;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float lo = 1.0; float hi = 0.0;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
          float v = texture2D(tMask, vUv + vec2(float(x), float(y)) * stepSize).r;
          lo = min(lo, v); hi = max(hi, v);
        }
        gl_FragColor = vec4(inkColor, (hi - lo) * opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private quad = new FullScreenQuad(this.ink);

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    vehicle: THREE.Object3D,
  ) {
    renderer.getDrawingBufferSize(this.size);
    if (
      this.target.width !== this.size.x ||
      this.target.height !== this.size.y
    ) {
      this.target.setSize(this.size.x, this.size.y);
      this.ink.uniforms.stepSize.value
        .set(1.05 / this.size.x, 1.05 / this.size.y)
        .multiplyScalar(renderer.getPixelRatio());
    }
    const background = scene.background,
      fog = scene.fog,
      override = scene.overrideMaterial;
    const target = renderer.getRenderTarget(),
      autoClear = renderer.autoClear;
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const hidden: THREE.Object3D[] = [];
    for (const child of scene.children)
      if (child !== vehicle && child.visible) {
        child.visible = false;
        hidden.push(child);
      }
    vehicle.traverse((object) => {
      if (
        (object instanceof THREE.Line || object instanceof THREE.Points) &&
        object.visible
      ) {
        object.visible = false;
        hidden.push(object);
      }
    });
    try {
      scene.background = this.black;
      scene.fog = null;
      scene.overrideMaterial = this.mask;
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      renderer.setRenderTarget(this.target);
      renderer.render(scene, camera);
    } finally {
      hidden.forEach((object) => {
        object.visible = true;
      });
      scene.background = background;
      scene.fog = fog;
      scene.overrideMaterial = override;
      renderer.shadowMap.autoUpdate = shadowAutoUpdate;
      renderer.setRenderTarget(target);
      renderer.autoClear = autoClear;
    }
    try {
      renderer.autoClear = false;
      this.quad.render(renderer);
    } finally {
      renderer.autoClear = autoClear;
    }
  }

  dispose() {
    this.target.dispose();
    this.mask.dispose();
    this.ink.dispose();
    this.quad.dispose();
  }
}
