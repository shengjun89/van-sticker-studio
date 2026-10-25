import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SceneEngine } from '../components/studio/scene-engine.ts';
import type { Presentation } from '../components/studio/scene-engine.ts';
import { VEHICLE_ASSET_REVISION } from '../lib/vehicle-assets.ts';
import {
  DRAWING_EXPORT_PX,
  DRAWING_EXPORT_VIEWS,
  STUDIO_VIEW_DIRECTIONS,
  drawingExportFilename,
} from '../lib/drawing-views.ts';

const BRAND = [/MAXUS/i, /SAIC/i, /大通/, /上汽/, /\bV80\b/];

type Internals = {
  generating: boolean;
  presentation: Presentation;
  environment: 'camp' | 'studio';
  cameraTween: { id: string } | null;
  reduced: boolean;
};

const internals = (engine: SceneEngine) => engine as unknown as Internals;

function viewById(id: string) {
  const view = DRAWING_EXPORT_VIEWS.find((item) => item.id === id);
  assert.ok(view, `missing export view ${id}`);
  return view;
}

void test('drawing export canvas is the single 2048×1536 constant', () => {
  assert.deepEqual(DRAWING_EXPORT_PX, { width: 2048, height: 1536 });
  assert.equal(DRAWING_EXPORT_PX.width / DRAWING_EXPORT_PX.height, 4 / 3);
});

void test('five export views keep distinct directions and the side view is entry only', () => {
  assert.deepEqual(
    DRAWING_EXPORT_VIEWS.map((view) => view.id),
    ['entry', 'front-three-quarter', 'rear-three-quarter', 'front', 'rear'],
  );
  const directions = DRAWING_EXPORT_VIEWS.map((view) =>
    view.direction.join(','),
  );
  assert.equal(new Set(directions).size, DRAWING_EXPORT_VIEWS.length);
  const exportIds: readonly string[] = DRAWING_EXPORT_VIEWS.map(
    (view) => view.id,
  );
  assert.equal(exportIds.includes('driver'), false);
  assert.deepEqual(viewById('entry').direction, STUDIO_VIEW_DIRECTIONS.entry);
  assert.ok(viewById('entry').direction[2] < 0);
});

void test('rear three-quarter is the front three-quarter mirrored front to back on the entry side', () => {
  const front = viewById('front-three-quarter').direction;
  const rear = viewById('rear-three-quarter').direction;
  const entry = viewById('entry').direction;
  assert.deepEqual([...rear], [-front[0], front[1], front[2]]);
  assert.equal(front[2], entry[2]);
  assert.equal(rear[2], entry[2]);
  assert.ok(front[0] < 0);
  assert.ok(rear[0] > 0);
});

void test('existing studio view directions stay on their current vectors', () => {
  assert.deepEqual(STUDIO_VIEW_DIRECTIONS, {
    hero: [-0.83, 0.48, -1],
    entry: [0, 0.22, -1],
    driver: [0, 0.22, 1],
    front: [-1, 0.18, 0],
    rear: [1, 0.22, 0],
  });
});

void test('setView still aims the camera along those studio directions', () => {
  const camera = new THREE.PerspectiveCamera(37, 1200 / 800, 0.08, 160);
  camera.position.set(-7, 4, 6);
  const controls = {
    target: new THREE.Vector3(0.2, 1.4, 0.1),
    update() {},
  };
  const engine = Object.assign(Object.create(SceneEngine.prototype), {
    camera,
    controls,
    host: { clientWidth: 1200, clientHeight: 800 },
    reduced: true,
    cameraTween: null,
    cancelCameraTween() {
      this.cameraTween = null;
    },
  }) as SceneEngine;
  for (const id of ['hero', 'entry', 'driver', 'front', 'rear'] as const) {
    engine.setView(id);
    const offset = camera.position.clone().sub(controls.target).normalize();
    const expected = new THREE.Vector3(
      ...STUDIO_VIEW_DIRECTIONS[id],
    ).normalize();
    assert.ok(
      offset.dot(expected) > 0.999,
      `${id} moved off its preset (${offset.toArray().join(',')} vs ${expected.toArray().join(',')})`,
    );
  }
});

void test('export filenames carry the view id and asset revision without brand words', () => {
  for (const view of DRAWING_EXPORT_VIEWS) {
    const name = drawingExportFilename(view.id, VEHICLE_ASSET_REVISION);
    assert.equal(name, `drawing-${view.id}-${VEHICLE_ASSET_REVISION}.png`);
    for (const pattern of BRAND)
      assert.equal(pattern.test(name), false, `${name} matched ${pattern}`);
  }
  assert.equal(VEHICLE_ASSET_REVISION.includes(' '), false);
  assert.throws(
    () => drawingExportFilename('driver', VEHICLE_ASSET_REVISION),
    /unknown-drawing-view/,
  );
  assert.throws(
    () => drawingExportFilename('entry', '../not-a-revision'),
    /unsafe-drawing-filename/,
  );
});

type Limits = {
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
};

function exportHarness(options?: {
  captureError?: boolean;
  root?: THREE.Object3D | null;
  generating?: boolean;
}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#edf1ed');
  scene.fog = new THREE.Fog('#edf1ed', 22, 65);
  const original = new THREE.MeshBasicMaterial({ color: '#889988' });
  const paper = new THREE.MeshBasicMaterial({ color: '#f1eee3' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 3), original);
  body.position.set(0, 2, 0);
  const root = new THREE.Group();
  root.add(body);
  root.updateMatrixWorld(true);
  const lines = { visible: false };
  const grid = { visible: false };
  const camp = { visible: true };
  const ground = {
    visible: true,
    material: new THREE.MeshStandardMaterial({ color: '#e2e7dc' }),
  };
  const camera = new THREE.PerspectiveCamera(37, 800 / 600, 0.08, 160);
  camera.position.set(-8, 3, -6);
  const controls = {
    target: new THREE.Vector3(0, 1.5, 0),
    minDistance: 4.8,
    maxDistance: 16,
    minPolarAngle: 0.16,
    maxPolarAngle: Math.PI * 0.49,
    update() {},
  };
  const size = new THREE.Vector2(800, 600);
  let pixelRatio = 1.75;
  const order: string[] = [];
  let during: ReturnType<typeof snapshot> | null = null;
  const renderer = {
    getPixelRatio: () => pixelRatio,
    setPixelRatio: (value: number) => {
      pixelRatio = value;
    },
    getSize: (out: THREE.Vector2) => out.copy(size),
    setSize: (width: number, height: number) => {
      size.set(width, height);
    },
    getDrawingBufferSize: (out: THREE.Vector2) =>
      out.set(size.x * pixelRatio, size.y * pixelRatio),
    getContext: () => null,
    render: () => {
      order.push('scene');
      during = snapshot(engine);
    },
    domElement: {
      toDataURL: (type?: string) => {
        assert.equal(type, 'image/png');
        if (options?.captureError) throw new Error('capture-boom');
        return 'data:image/png;base64,iVBORw0KGgo=';
      },
    },
  };
  const silhouette = {
    render: () => {
      order.push('silhouette');
    },
  };
  const tween = { id: 'pending-view' };
  const engine = Object.assign(Object.create(SceneEngine.prototype), {
    scene,
    camera,
    controls,
    root: options && 'root' in options ? options.root : root,
    generating: options?.generating ?? false,
    presentation: 'render' as Presentation,
    environment: 'camp' as const,
    drafting: [{ mesh: body, original, paper }],
    drawingLines: [lines],
    drawingGrid: grid,
    camp,
    ground,
    cameraTween: tween,
    host: { clientWidth: 800, clientHeight: 600 },
    renderer,
    silhouette,
    reduced: false,
  }) as SceneEngine;

  function snapshot(current: SceneEngine) {
    const state = internals(current);
    const fog = current.scene.fog;
    const background = current.scene.background;
    return {
      generating: state.generating,
      presentation: state.presentation,
      environment: state.environment,
      cameraTween: state.cameraTween,
      camera: current.camera.position.toArray(),
      quaternion: current.camera.quaternion.toArray(),
      target: controls.target.toArray(),
      aspect: current.camera.aspect,
      near: current.camera.near,
      far: current.camera.far,
      pixelRatio,
      size: size.toArray(),
      grid: grid.visible,
      camp: camp.visible,
      ground: ground.visible,
      line: lines.visible,
      material: body.material,
      fog,
      background:
        background instanceof THREE.Color ? background.getHexString() : null,
      framed: current.root ? boxFits(current.camera, current.root) : false,
      limits: {
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        minPolarAngle: controls.minPolarAngle,
        maxPolarAngle: controls.maxPolarAngle,
      } satisfies Limits,
    };
  }

  return {
    engine,
    body,
    original,
    paper,
    order,
    snapshot: () => snapshot(engine),
    during: () => during,
    limits: () => ({
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
      minPolarAngle: controls.minPolarAngle,
      maxPolarAngle: controls.maxPolarAngle,
    }),
  };
}

function boxFits(camera: THREE.PerspectiveCamera, root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  let maxAbs = 0;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const projected = new THREE.Vector3(x, y, z).project(camera);
        if (!(projected.z > -1 && projected.z < 1)) return false;
        if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return false;
        maxAbs = Math.max(maxAbs, Math.abs(projected.x), Math.abs(projected.y));
      }
    }
  }
  return maxAbs >= 0.7;
}

void test('a successful export forces a clean drawing and then restores the studio', () => {
  const harness = exportHarness();
  const before = harness.snapshot();
  const file = harness.engine.exportDrawing('entry');
  const during = harness.during();
  assert.ok(during);
  assert.equal(during.presentation, 'drawing');
  assert.equal(during.environment, 'studio');
  assert.equal(during.grid, false);
  assert.equal(during.camp, false);
  assert.equal(during.ground, false);
  assert.equal(during.line, true);
  assert.equal(during.material, harness.paper);
  assert.equal(during.fog, null);
  assert.equal(during.background, 'f1eee4');
  assert.equal(during.pixelRatio, 1);
  assert.deepEqual(during.size, [DRAWING_EXPORT_PX.width, DRAWING_EXPORT_PX.height]);
  assert.equal(
    during.aspect,
    DRAWING_EXPORT_PX.width / DRAWING_EXPORT_PX.height,
  );
  const aim = new THREE.Vector3(...during.camera)
    .sub(new THREE.Vector3(...during.target))
    .normalize();
  const expected = new THREE.Vector3(...viewById('entry').direction).normalize();
  assert.ok(aim.dot(expected) > 0.999);
  assert.equal(during.framed, true);
  assert.deepEqual(harness.order, ['scene', 'silhouette']);
  assert.equal(
    file.filename,
    `drawing-entry-${VEHICLE_ASSET_REVISION}.png`,
  );
  assert.match(file.dataUrl, /^data:image\/png/);
  assert.deepEqual(harness.snapshot(), before);
  assert.equal(harness.body.material, harness.original);
});

void test('export is refused while generation is running and changes nothing', () => {
  const harness = exportHarness({ generating: true });
  const before = harness.snapshot();
  assert.throws(
    () => harness.engine.exportDrawing('front'),
    /export-while-generating/,
  );
  assert.deepEqual(harness.snapshot(), before);
  assert.deepEqual(harness.order, []);
});

void test('unknown export views are refused before the studio changes', () => {
  const harness = exportHarness();
  const before = harness.snapshot();
  for (const id of ['driver', 'hero', 'side', '']) {
    assert.throws(
      () => harness.engine.exportDrawing(id),
      /unknown-drawing-view/,
      id,
    );
  }
  assert.deepEqual(harness.snapshot(), before);
  assert.deepEqual(harness.order, []);
});

void test('a capture failure restores the camera, size, pixel ratio, mode and visibility', () => {
  const harness = exportHarness({ captureError: true });
  const before = harness.snapshot();
  assert.throws(() => harness.engine.exportDrawing('rear'), /capture-boom/);
  assert.deepEqual(harness.snapshot(), before);
  assert.deepEqual(harness.limits(), before.limits);
});

void test('the model must be loaded before an export mutates the studio', () => {
  const harness = exportHarness({ root: null });
  const before = harness.snapshot();
  assert.throws(
    () => harness.engine.exportDrawing('entry'),
    /model-not-ready/,
  );
  assert.deepEqual(harness.snapshot(), before);
});

void test('consecutive exports restore the studio after each view', () => {
  const harness = exportHarness();
  const before = harness.snapshot();
  const aims: THREE.Vector3[] = [];
  const renderer = (
    harness.engine as unknown as {
      renderer: { render: () => void };
    }
  ).renderer;
  const originalRender = renderer.render;
  renderer.render = () => {
    originalRender();
    const during = harness.during();
    assert.ok(during);
    aims.push(
      new THREE.Vector3(...during.camera)
        .sub(new THREE.Vector3(...during.target))
        .normalize(),
    );
  };
  const first = harness.engine.exportDrawing('front-three-quarter');
  assert.deepEqual(harness.snapshot(), before);
  const second = harness.engine.exportDrawing('rear-three-quarter');
  assert.deepEqual(harness.snapshot(), before);
  assert.notEqual(first.filename, second.filename);
  assert.ok(
    aims[0].dot(
      new THREE.Vector3(...viewById('front-three-quarter').direction).normalize(),
    ) > 0.999,
  );
  assert.ok(
    aims[1].dot(
      new THREE.Vector3(...viewById('rear-three-quarter').direction).normalize(),
    ) > 0.999,
  );
  assert.equal(harness.engine.camera.aspect, before.aspect);
  assert.deepEqual(harness.limits(), before.limits);
});
