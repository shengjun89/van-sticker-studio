import * as THREE from 'three';
import { createDraftingEdges } from '../../lib/drafting-edges.ts';
import { DrawingSilhouette } from '../../lib/drawing-silhouette.ts';
import {
  VehicleWrapEditor,
  type WrapEditState,
} from '../../lib/vehicle-wrap-editor.ts';
import {
  applyCalibratedWiper,
  validateWiperRig,
} from '../../lib/wiper-calibration.ts';
import {
  VEHICLE_ASSET_REVISION,
  VEHICLE_MODEL_URL,
  VEHICLE_MOTION_URL,
} from '../../lib/vehicle-assets.ts';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { waitingPose } from '../../lib/stage-motion.ts';
import type { Sticker } from '@/lib/stickers';
export type MotionNode = {
  name: string;
  kind: 'rotation' | 'translation' | 'scale' | 'morph';
  axis?: number[];
  maxRadians?: number;
  morphSteps?: number;
  maxDistance?: number;
  closed?: number[];
  open?: number[];
};
export type Motion = {
  id: string;
  label: string;
  nodes: MotionNode[];
  hitNodeNames: string[];
  rangeDegrees?: number[];
};
export type Metadata = {
  hitRegions?: { id: string; bounds: { min: number[]; max: number[] } }[];
  motions: Motion[];
  wrap: {
    xMin: number;
    xSpan: number;
    zMin: number;
    zSpan: number;
    textureFlipY: boolean;
    entryU: string;
    driverU: string;
  };
  dimensionsMeters: { length: number; width: number; height: number };
};
export type Presentation = 'drawing' | 'render';
/** The engine reports failures as codes; the React layer localizes them via lib/i18n. */
export type SceneErrorCode = 'model-load-failed' | 'webgl-paused';
export const STICKER_IMAGE_FAILED = 'sticker-image-failed';
type Hooks = {
  onCommit: (sticker: Sticker | null) => void;
  onReady: (metadata: Metadata) => void;
  onError: (code: SceneErrorCode) => void;
  onProgress: (value: number) => void;
  onPick: (id: string) => void;
  onHover: (id: string | null, x: number, y: number) => void;
  onWrapEdit?: (state: WrapEditState) => void;
};
type BoundNode = {
  node: THREE.Object3D;
  spec: MotionNode;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  axis: THREE.Vector3;
};
type Tween = { from: number; to: number; start: number; duration: number };
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// Settle below the physical limit: anticipation and a soft catch, without an impossible over-open hinge.
export function playfulEase(t: number) {
  t = clamp(t);
  if (t < 0.1) return -0.018 * Math.sin((t / 0.1) * Math.PI);
  const x = (t - 0.1) / 0.9;
  return clamp(
    1 - Math.pow(1 - x, 3) + 0.032 * Math.sin(x * Math.PI * 3) * (1 - x),
  );
}
export function wiperPhase(seconds: number) {
  if (seconds < 5) return 0;
  const phase = (seconds - 5) % 5;
  return phase < 1.35 ? Math.pow(Math.sin((phase / 1.35) * Math.PI), 1.2) : 0;
}

export class SceneEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(37, 1, 0.08, 160);
  controls: OrbitControls;
  root: THREE.Group | null = null;
  metadata: Metadata | null = null;
  camp = new THREE.Group();
  ground: THREE.Mesh;
  motions = new Map<string, BoundNode[]>();
  values = new Map<string, number>();
  tweens = new Map<string, Tween>();
  hitMap = new Map<string, string>();
  trees: THREE.Group[] = [];
  private generating = false;
  private generationStart = 0;
  private waitWeight = 0;
  private displayPoses: Record<string, number> = {};
  private presentation: Presentation = 'drawing';
  private drafting: {
    mesh: THREE.Mesh;
    original: THREE.Material | THREE.Material[];
    paper: THREE.Material | THREE.Material[];
  }[] = [];
  private drawingLines: THREE.LineSegments[] = [];
  private silhouette = new DrawingSilhouette();
  private wrapEditor: VehicleWrapEditor | null = null;
  private ink = new THREE.LineBasicMaterial({
    color: '#354239',
    toneMapped: false,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  private detailInk = new THREE.LineBasicMaterial({
    color: '#657066',
    toneMapped: false,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  private drawingGrid = new THREE.GridHelper(28, 56, '#b9b5a4', '#d6d2c6');
  private raf = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private startTime = performance.now();
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private wipers = true;
  private currentWiperPhase = 0;
  private environment: 'camp' | 'studio' = 'studio';
  private clock = new THREE.Clock();
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private down = { x: 0, y: 0 };
  private lastHover = 0;
  private chosen: HTMLImageElement | null = null;
  private stickerId: string | null = null;
  private imageVersion = 0;
  private cameraTween: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    start: number;
  } | null = null;
  private pmrem: THREE.PMREMGenerator;
  private environmentMap: THREE.WebGLRenderTarget;
  private host: HTMLDivElement;
  private hooks: Hooks;
  constructor(host: HTMLDivElement, hooks: Hooks) {
    this.host = host;
    this.hooks = hooks;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor('#edf1ed');
    host.appendChild(this.renderer.domElement);
    // English default; VehicleScene re-sets this from the dictionary on language change.
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Rotatable campervan — drag to orbit, scroll to zoom, click doors and windows to open or close',
    );
    this.renderer.domElement.tabIndex = 0;
    this.scene.background = new THREE.Color('#edf1ed');
    this.scene.fog = new THREE.Fog('#edf1ed', 22, 65);
    this.camera.position.set(-7.2, 4.5, -8.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.2, 1.3, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 4.8;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minPolarAngle = 0.16;
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.5;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.7;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentMap = this.pmrem.fromScene(room, 0.025);
    room.dispose();
    this.scene.environment = this.environmentMap.texture;
    this.scene.environmentIntensity = 0.65;
    const ambient = new THREE.HemisphereLight('#eff6ff', '#9caa89', 1.1);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight('#fff5e2', 2.4);
    sun.position.set(-5, 10, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -10,
      right: 10,
      top: 10,
      bottom: -10,
      near: 1,
      far: 35,
    });
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0002;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#dbe5ff', 0.8);
    fill.position.set(6, 5, 7);
    this.scene.add(fill);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: '#e2e7dc', roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.016;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.scene.add(this.camp);
    this.makeCamp();
    this.drawingGrid.position.y = -0.009;
    this.scene.add(this.drawingGrid);
    for (const material of [this.drawingGrid.material].flat()) {
      material.transparent = true;
      material.opacity = 0.15;
    }
    this.setEnvironment('studio');
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    canvas.addEventListener('keydown', this.keyDown);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    this.controls.addEventListener('start', this.cancelCameraTween);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.animate();
    void this.load();
  }
  private async load() {
    try {
      const [meta, gltf] = await Promise.all([
        fetch(VEHICLE_MOTION_URL, { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw Error('metadata');
          return r.json() as Promise<Metadata>;
        }),
        new GLTFLoader().loadAsync(VEHICLE_MODEL_URL, (p) => {
          if (p.total)
            this.hooks.onProgress(Math.round((p.loaded / p.total) * 100));
        }),
      ]);
      if (this.disposed) {
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        return;
      }
      this.root = gltf.scene;
      this.metadata = meta;
      for (const motion of meta.motions.filter((m) =>
        m.id.startsWith('wiper'),
      )) {
        for (const spec of motion.nodes) {
          const node = this.root.getObjectByName(spec.name);
          if (!node || spec.kind !== 'morph')
            throw Error('Wiper asset mismatch');
          validateWiperRig(node, spec.morphSteps || 0);
        }
      }
      this.scene.add(this.root);
      const glazing = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
      this.root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.computeBoundingSphere();
          o.geometry.computeBoundingBox();
          const materials = [o.material].flat().map((material) => {
            if (material.name !== 'Glass') return material;
            if (!glazing.has(material)) {
              // Clear glazing transmits the cabin while retaining angle-dependent reflections.
              // Opacity tinting previously turned every pane into a dark teal panel.
              glazing.set(
                material,
                new THREE.MeshPhysicalMaterial({
                  name: 'Glass',
                  color: '#ffffff',
                  metalness: 0,
                  roughness: 0.02,
                  transmission: 0.8,
                  thickness: 0.006,
                  ior: 1.5,
                  envMapIntensity: 0.65,
                  side: THREE.DoubleSide,
                }),
              );
            }
            return glazing.get(material)!;
          });
          o.material = Array.isArray(o.material) ? materials : materials[0];
          const isGlazing = materials.every((m) => m.name === 'Glass');
          // Standard shadow maps treat transmitting panes as opaque blockers.
          o.castShadow = !isGlazing;
          o.receiveShadow = !isGlazing;
          materials.forEach((m) => {
            if (m instanceof THREE.MeshStandardMaterial) {
              if (m.name.startsWith('Wrap_')) {
                m.roughness = 0.38;
                m.metalness = 0.05;
              }
              if (m.name === 'Chrome') {
                m.metalness = 0.85;
                m.roughness = 0.22;
              }
            }
          });
        }
      });
      glazing.forEach((_, source) => source.dispose());
      this.wrapEditor = new VehicleWrapEditor({
        root: this.root,
        camera: this.camera,
        controls: this.controls,
        host: this.host,
        body: {
          xMin: meta.wrap.xMin,
          length: meta.wrap.xSpan,
          width: meta.dimensionsMeters.width,
          height: meta.wrap.zSpan,
        },
        reveal: { value: 1 },
        onChange: (state) => this.hooks.onWrapEdit?.(state),
        takeCamera: this.cancelCameraTween,
      });
      const meshes: THREE.Mesh[] = [];
      this.root.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes.push(o);
      });
      const papers = new Map<THREE.Material, THREE.Material>();
      for (const mesh of meshes) {
        const original = mesh.material;
        const mapMaterial = (m: THREE.Material) => {
          if (mesh.name.startsWith('RV_WebRig_Wiper_'))
            return new THREE.MeshBasicMaterial({
              color: '#3e5558',
              toneMapped: false,
              side: THREE.DoubleSide,
            });
          if (!papers.has(m))
            papers.set(
              m,
              new THREE.MeshBasicMaterial({
                color:
                  m.name === 'Glass'
                    ? '#ffffff'
                    : /Tire|Rubber|Black/.test(m.name)
                      ? '#b4b8af'
                      : '#f1eee3',
                toneMapped: false,
                transparent: m.name === 'Glass',
                opacity: m.name === 'Glass' ? 0.2 : 1,
                depthWrite: m.name !== 'Glass',
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
              }),
            );
          return papers.get(m)!;
        };
        const paper = Array.isArray(original)
          ? original.map(mapMaterial)
          : mapMaterial(original);
        this.drafting.push({ mesh, original, paper });
      }
      this.root.updateMatrixWorld(true);
      for (const { parent, geometry, structural } of createDraftingEdges(
        meshes,
      )) {
        const lines = new THREE.LineSegments(
          geometry,
          structural ? this.ink : this.detailInk,
        );
        lines.raycast = () => {};
        parent.add(lines);
        this.drawingLines.push(lines);
      }
      this.setPresentation(this.presentation);
      for (const motion of meta.motions) {
        const bound: BoundNode[] = [];
        for (const spec of motion.nodes) {
          const node = this.root.getObjectByName(spec.name);
          if (!node) throw new Error(`Missing motion node ${spec.name}`);
          bound.push({
            node,
            spec,
            position: node.position.clone(),
            quaternion: node.quaternion.clone(),
            scale: node.scale.clone(),
            axis: new THREE.Vector3()
              .fromArray(spec.axis || [0, 1, 0])
              .normalize(),
          });
        }
        this.motions.set(motion.id, bound);
        this.values.set(motion.id, 0);
        this.applyMotion(motion.id, 0);
        motion.hitNodeNames.forEach((n) => this.hitMap.set(n, motion.id));
      }
      this.fitCamera(false);
      this.hooks.onReady(meta);
    } catch (e) {
      console.error('Vehicle load failed', e);
      this.hooks.onError('model-load-failed');
    }
  }
  private makeCamp() {
    const mesh = (
      geo: THREE.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
      );
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.camp.add(m);
      return m;
    };
    // A low, quiet landscape keeps the complete orbit around the vehicle clear.
    const spots = [
      [6, 5, 2.8],
      [-6.5, 5.8, 3.4],
      [2.8, 8, 4.3],
      [-3, 8.5, 3.2],
      [8, 1, 3.1],
      [-8, -1, 2.5],
      [7, -6.8, 2.9],
      [-5.6, -8, 2.7],
    ];
    spots.forEach(([x, z, h], i) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.12, h * 0.52, 7),
        new THREE.MeshStandardMaterial({ color: '#8a7763', roughness: 1 }),
      );
      trunk.position.y = h * 0.23;
      tree.add(trunk);
      for (let j = 0; j < 3; j++) {
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(h * (0.29 - j * 0.045), h * 0.56, 7),
          new THREE.MeshStandardMaterial({
            color: ['#71887c', '#809787', '#91a492'][(i + j) % 3],
            roughness: 1,
          }),
        );
        crown.position.y = h * (0.43 + j * 0.22);
        crown.rotation.y = i * 0.8;
        crown.castShadow = true;
        tree.add(crown);
      }
      this.camp.add(tree);
      this.trees.push(tree);
    });
    for (let i = 0; i < 17; i++) {
      const a = i * 2.399;
      const r = 5.2 + (i % 4) * 0.7;
      const stone = mesh(
        new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.045, 0),
        ['#c2c6ba', '#b9c0b0', '#d1d2c9'][i % 3],
        Math.cos(a) * r,
        0.07,
        Math.sin(a) * r,
      );
      stone.scale.set(1.5, 0.6, 1);
      stone.rotation.y = a;
    }
    // Two quiet camping stools, outside the vehicle and awning sweep.
    const wood = new THREE.MeshStandardMaterial({
      color: '#a88d72',
      roughness: 0.8,
    });
    const textile = new THREE.MeshStandardMaterial({
      color: '#6c857c',
      roughness: 1,
      side: THREE.DoubleSide,
    });
    [0, 1].forEach((i) => {
      const stool = new THREE.Group();
      stool.position.set(2.6 + i * 0.8, 0.01, -4.15);
      stool.rotation.y = 0.35 + i * 0.25;
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.035, 0.4),
        textile,
      );
      seat.position.y = 0.42;
      seat.castShadow = true;
      stool.add(seat);
      [-1, 1].forEach((s) =>
        [-1, 1].forEach((t) => {
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, 0.49, 6),
            wood,
          );
          leg.position.set(s * 0.17, 0.215, t * 0.13);
          leg.rotation.z = s * 0.25;
          leg.castShadow = true;
          stool.add(leg);
        }),
      );
      this.camp.add(stool);
    });
  }
  private resize() {
    const w = Math.max(1, this.host.clientWidth),
      h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private fitCamera(smooth = true, view = 'hero') {
    const target = new THREE.Vector3(
      0.15,
      this.host.clientHeight > 500 ? 0.95 : 1.3,
      0,
    );
    const wide = this.host.clientWidth / Math.max(this.host.clientHeight, 1);
    const distance = wide < 1 ? 11.8 : 10.8;
    const vectors: Record<string, THREE.Vector3> = {
      hero: new THREE.Vector3(-0.83, 0.48, -1),
      entry: new THREE.Vector3(0, 0.22, -1),
      driver: new THREE.Vector3(0, 0.22, 1),
      front: new THREE.Vector3(-1, 0.18, 0),
      rear: new THREE.Vector3(1, 0.22, 0),
    };
    const direction = vectors[view] || vectors.hero;
    const to = target
      .clone()
      .add(direction.normalize().multiplyScalar(distance));
    if (smooth && !this.reduced)
      this.cameraTween = {
        from: this.camera.position.clone(),
        to,
        fromTarget: this.controls.target.clone(),
        toTarget: target,
        start: performance.now(),
      };
    else {
      this.camera.position.copy(to);
      this.controls.target.copy(target);
      this.controls.update();
    }
  }
  setView(view: string) {
    this.cancelCameraTween();
    this.fitCamera(true, view);
  }
  setPresentation(value: Presentation) {
    this.presentation = value;
    for (const d of this.drafting) {
      d.mesh.material = value === 'drawing' ? d.paper : d.original;
    }
    for (const lines of this.drawingLines) lines.visible = value === 'drawing';
    this.drawingGrid.visible = this.environment === 'studio';
  }
  setEnvironment(value: 'camp' | 'studio') {
    this.environment = value;
    this.camp.visible = value === 'camp';
    this.drawingGrid.visible = value === 'studio';
    const color = value === 'camp' ? '#edf1ed' : '#f1eee4';
    this.scene.background = new THREE.Color(color);
    (this.scene.fog as THREE.Fog).color.set(color);
    (this.ground.material as THREE.MeshStandardMaterial).color.set(
      value === 'camp' ? '#e2e7dc' : '#f1eee4',
    );
  }
  setWipers(value: boolean) {
    this.wipers = value;
  }
  setParts(parts: Record<string, boolean>) {
    for (const id of this.motions.keys()) {
      if (id.startsWith('wiper')) continue;
      const to = parts[id] ? 1 : 0;
      const current = this.values.get(id) || 0;
      const queued = this.tweens.get(id);
      if (
        (queued && queued.to === to) ||
        (!queued && Math.abs(current - to) < 0.0001)
      )
        continue;
      if (this.reduced) {
        this.applyMotion(id, to);
        this.values.set(id, to);
      } else
        this.tweens.set(id, {
          from: current,
          to,
          start: performance.now(),
          duration: id === 'awning' ? 1450 : id.startsWith('slide') ? 650 : 900,
        });
    }
  }
  private applyMotion(id: string, value: number) {
    for (const b of this.motions.get(id) || []) {
      const { node, spec, axis } = b;
      if (spec.kind === 'morph') applyCalibratedWiper(node, value);
      else if (spec.kind === 'rotation')
        node.quaternion
          .copy(b.quaternion)
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              axis,
              (spec.maxRadians || 0) * clamp(value),
            ),
          );
      else if (spec.kind === 'translation')
        node.position
          .copy(b.position)
          .addScaledVector(axis, (spec.maxDistance || 0) * clamp(value));
      else if (spec.kind === 'scale') {
        const closed = new THREE.Vector3().fromArray(spec.closed || [1, 1, 1]);
        const open = new THREE.Vector3().fromArray(spec.open || [1, 1, 1]);
        node.scale.copy(closed.lerp(open, clamp(value)));
      }
    }
  }
  setGenerating(value: boolean) {
    if (value && !this.generating) this.generationStart = performance.now();
    this.generating = value;
  }
  async applySticker(sticker: Sticker | null) {
    const version = ++this.imageVersion;
    if (!sticker) {
      this.chosen = null;
      this.paint();
      this.stickerId = null;
      this.setPresentation('drawing');
      this.hooks.onCommit(null);
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.src = sticker.image;
    try {
      await img.decode();
    } catch {
      if (version !== this.imageVersion || this.disposed)
        throw new DOMException(
          'Superseded by a newer sticker action',
          'AbortError',
        );
      throw Error(STICKER_IMAGE_FAILED);
    }
    if (version !== this.imageVersion || this.disposed)
      throw new DOMException(
        'Superseded by a newer sticker action',
        'AbortError',
      );
    this.chosen = img;
    this.paint();
    this.stickerId = sticker.id;
    this.setPresentation('render');
    this.setGenerating(false);
    // Apply the complete decoded image in place; the user's view and hinges stay put.
    this.hooks.onCommit(sticker);
  }
  private paint() {
    this.wrapEditor?.setImage(this.chosen);
  }
  beginWrapEdit(mode: 'move' | 'scale', event: PointerEvent) {
    this.wrapEditor?.begin(mode, event);
  }
  scaleWrap(factor: number) {
    this.wrapEditor?.scaleBy(factor);
  }
  nudgeWrap(dx: number, dy: number) {
    this.wrapEditor?.nudge(dx, dy);
  }
  resetWrap() {
    this.wrapEditor?.reset();
  }
  keepWrapVisible() {
    this.wrapEditor?.keepVisible();
  }
  setWrapLocked(value: boolean) {
    this.wrapEditor?.setLocked(value);
  }
  dismissWrapMenu() {
    this.wrapEditor?.dismissMenu();
  }
  private pick(event: PointerEvent) {
    if (!this.root) return null;
    const rect = this.host.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObject(this.root, true)[0];
    if (!hit) return null;
    const local = this.root.worldToLocal(hit.point.clone());
    for (const region of this.metadata?.hitRegions || []) {
      const box = new THREE.Box3(
        new THREE.Vector3().fromArray(region.bounds.min),
        new THREE.Vector3().fromArray(region.bounds.max),
      );
      if (box.containsPoint(local)) return region.id;
    }
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      const id = this.hitMap.get(o.name);
      if (id) return id;
      o = o.parent;
    }
    return null;
  }
  private pointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };
  private pointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (this.wrapEditor?.getState().dragging) return;
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6)
      return;
    const id = this.pick(e);
    if (id) this.hooks.onPick(id);
  };
  private pointerMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const now = performance.now();
    if (now - this.lastHover < 110) return;
    this.lastHover = now;
    const id = this.pick(e);
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    const rect = this.host.getBoundingClientRect();
    this.hooks.onHover(id, e.clientX - rect.left, e.clientY - rect.top);
  };
  private pointerLeave = () => this.hooks.onHover(null, 0, 0);
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.hooks.onError('webgl-paused');
  };
  private cancelCameraTween = () => {
    this.cameraTween = null;
  };
  private keyDown = (e: KeyboardEvent) => {
    if (['Home', 'ArrowLeft', 'ArrowRight', '+', '-', '='].includes(e.key))
      this.cancelCameraTween();
    if (e.key === 'Home') {
      this.setView('hero');
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const v = this.camera.position.clone().sub(this.controls.target);
      v.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        e.key === 'ArrowLeft' ? 0.16 : -0.16,
      );
      this.camera.position.copy(this.controls.target).add(v);
      this.controls.update();
      e.preventDefault();
    } else if (e.key === '+' || e.key === '-' || e.key === '=') {
      this.camera.position
        .sub(this.controls.target)
        .multiplyScalar(e.key === '-' ? 1.1 : 0.9)
        .add(this.controls.target);
      this.controls.update();
      e.preventDefault();
    }
  };
  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    if (document.hidden) return;
    const now = performance.now(),
      seconds = (now - this.startTime) / 1000;
    const dt = Math.min(0.1, this.clock.getDelta());
    const waitTarget = this.generating && !this.reduced ? 1 : 0;
    this.waitWeight = THREE.MathUtils.damp(this.waitWeight, waitTarget, 6, dt);
    if (this.waitWeight < 0.0001) this.waitWeight = 0;
    for (const [id, tween] of this.tweens) {
      const t = clamp((now - tween.start) / tween.duration);
      const value = tween.from + (tween.to - tween.from) * playfulEase(t);
      this.values.set(id, value);
      this.applyMotion(id, value);
      if (t >= 1) this.tweens.delete(id);
    }
    for (const [id, base] of this.values) {
      if (id.startsWith('wiper')) continue;
      const pose = waitingPose(
        id,
        (now - this.generationStart) / 1000,
        base,
        this.waitWeight,
      );
      this.displayPoses[id] = pose;
      this.applyMotion(id, pose);
    }
    this.ink.opacity = 0.8 + this.waitWeight * 0.04 * Math.sin(seconds * 2);
    const phase = this.wipers && !this.reduced ? wiperPhase(seconds) : 0;
    this.currentWiperPhase = phase;
    this.applyMotion('wiper-1', phase);
    this.applyMotion('wiper-2', phase);
    if (this.environment === 'camp' && !this.reduced)
      this.trees.forEach(
        (tree, i) => (tree.rotation.z = Math.sin(seconds * 0.6 + i) * 0.008),
      );
    if (this.cameraTween) {
      const p = this.cameraTween;
      const t = clamp((now - p.start) / 850);
      const ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(p.from, p.to, ease);
      this.controls.target.lerpVectors(p.fromTarget, p.toTarget, ease);
      if (t >= 1) this.cameraTween = null;
    }
    this.controls.update();
    this.wrapEditor?.setEnabled(
      this.presentation === 'render' && !this.generating,
    );
    this.wrapEditor?.update(now, this.reduced);
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    if (this.presentation === 'drawing' && this.root)
      this.silhouette.render(this.renderer, this.scene, this.camera, this.root);
  };
  getState() {
    return {
      ready: !!this.root,
      assetRevision: VEHICLE_ASSET_REVISION,
      motionValues: Object.fromEntries(this.values),
      displayPoses: this.displayPoses,
      generating: this.generating,
      waitWeight: this.waitWeight,
      revealActive: false,
      revealProgress: 1,
      camera: {
        position: this.camera.position.toArray(),
        target: this.controls.target.toArray(),
      },
      environment: this.environment,
      presentation: this.presentation,
      stickerId: this.stickerId,
      wrapEdit: this.wrapEditor?.getState(),
      wipers: this.wipers,
      wiperPhase: this.currentWiperPhase,
      wiperPeriodSeconds: 5,
      render: {
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      },
    };
  }
  dispose() {
    this.disposed = true;
    this.imageVersion++;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.wrapEditor?.dispose();
    this.controls.dispose();
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.pointerDown);
    c.removeEventListener('pointerup', this.pointerUp);
    c.removeEventListener('pointermove', this.pointerMove);
    c.removeEventListener('pointerleave', this.pointerLeave);
    c.removeEventListener('keydown', this.keyDown);
    c.removeEventListener('webglcontextlost', this.contextLost);
    const materials = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          materials.add(m),
        );
      }
    });
    for (const d of this.drafting) {
      for (const m of [d.paper, d.original].flat()) materials.add(m);
    }
    for (const lines of this.drawingLines) lines.geometry.dispose();
    this.ink.dispose();
    this.detailInk.dispose();
    this.silhouette.dispose();
    this.drawingGrid.geometry.dispose();
    for (const m of [this.drawingGrid.material].flat()) m.dispose();
    materials.forEach((m) => m.dispose());
    this.environmentMap.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    c.remove();
  }
}
