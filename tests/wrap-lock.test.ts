import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
} from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VehicleWrapEditor } from '../lib/vehicle-wrap-editor.ts';

// Minimal DOM boundary; the real editor, raycaster, mesh and event handlers run.
class Canvas extends EventTarget {
  style = { cursor: '' };
  clientWidth = 800;
  clientHeight = 600;
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() {
    return false;
  }
  focus() {}
  closest() {
    return null;
  }
}
function pointer(type: string, x = 400, y = 300, button = 0) {
  return Object.assign(new Event(type, { cancelable: true }), {
    clientX: x,
    clientY: y,
    button,
    buttons: type === 'pointermove' ? 1 : 0,
    pointerId: 1,
    pointerType: 'mouse',
  }) as PointerEvent;
}
function setup() {
  const previousWindow = globalThis.window,
    previousElement = globalThis.Element;
  const events = new EventTarget();
  Object.assign(globalThis, { window: events, Element: Canvas });
  const canvas = new Canvas();
  const controls = { domElement: canvas, enabled: true };
  const root = new Group();
  const material = new MeshStandardMaterial();
  material.name = 'Wrap_Body';
  const body = new Mesh(new BoxGeometry(5.8, 3.05, 2.22), material);
  body.name = 'RV_Static_Wrap_Body';
  body.position.set(0.05, 1.525, 0);
  root.add(body);
  const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
  camera.position.set(1, 1.28, -8);
  camera.lookAt(1, 1.28, 0);
  camera.updateMatrixWorld(true);
  const editor = new VehicleWrapEditor({
    root,
    camera,
    controls: controls as unknown as OrbitControls,
    host: canvas as unknown as HTMLElement,
    body: { xMin: -2.85, length: 5.8, width: 2.22, height: 3.05 },
    reveal: { value: 1 },
    onChange() {},
    takeCamera() {},
  });
  editor.setImage({
    naturalWidth: 900,
    naturalHeight: 300,
  } as HTMLImageElement);
  return {
    editor,
    canvas,
    events,
    controls,
    cleanup: () => {
      editor.dispose();
      Object.assign(globalThis, {
        window: previousWindow,
        Element: previousElement,
      });
    },
  };
}

void test('locking leaves the camera free and blocks every decal edit entry point', () => {
  const { editor, canvas, events, controls, cleanup } = setup();
  try {
    editor.setLocked(true);
    const before = editor.getState().placements;
    const down = pointer('pointerdown');
    canvas.dispatchEvent(down);
    events.dispatchEvent(pointer('pointermove', 460, 270));
    events.dispatchEvent(pointer('pointerup', 460, 270));
    editor.begin('scale', pointer('pointerdown'));
    editor.scaleBy(1.2);
    editor.nudge(0.3, 0.2);
    editor.reset();
    editor.update(1000, false);
    assert.deepEqual(editor.getState().placements, before);
    assert.equal(editor.getState().visible, false);
    assert.equal(editor.getState().dragging, false);
    assert.equal(controls.enabled, true);
    assert.equal(
      down.defaultPrevented,
      false,
      'locked decal pointerdown must reach OrbitControls',
    );
    editor.setEnabled(false);
    editor.setEnabled(true);
    editor.setImage({
      naturalWidth: 900,
      naturalHeight: 300,
    } as HTMLImageElement);
    assert.equal(
      editor.getState().locked,
      true,
      'view or texture changes must not silently unlock',
    );
  } finally {
    cleanup();
  }
});

void test('right-clicking a locked decal opens its menu and unlocking restores actual dragging', () => {
  const { editor, canvas, events, controls, cleanup } = setup();
  try {
    editor.setLocked(true);
    const context = pointer('contextmenu', 400, 300, 2);
    canvas.dispatchEvent(context);
    assert.equal(context.defaultPrevented, true);
    assert.ok(editor.getState().contextMenu);
    assert.equal(
      editor.getState().visible,
      false,
      'locked decal must not show ants',
    );
    editor.setLocked(false);
    editor.update(1000, false);
    assert.equal(editor.getState().contextMenu, null);
    assert.equal(editor.getState().visible, true);
    const before = editor.getState().placements;
    canvas.dispatchEvent(pointer('pointerdown'));
    assert.equal(editor.getState().dragging, true);
    assert.equal(controls.enabled, false);
    events.dispatchEvent(pointer('pointermove', 460, 270));
    events.dispatchEvent(pointer('pointerup', 460, 270));
    assert.notDeepEqual(editor.getState().placements, before);
    assert.equal(controls.enabled, true);
    editor.setImage(null);
    assert.equal(editor.getState().locked, false);
  } finally {
    cleanup();
  }
});

void test('the decal menu dismisses outside or with Escape without unlocking', () => {
  const { editor, canvas, events, cleanup } = setup();
  try {
    editor.setLocked(true);
    canvas.dispatchEvent(pointer('contextmenu', 400, 300, 2));
    events.dispatchEvent(pointer('pointerdown', 20, 20));
    assert.equal(editor.getState().contextMenu, null);
    canvas.dispatchEvent(
      Object.assign(new Event('keydown', { cancelable: true }), {
        key: 'F10',
        shiftKey: true,
      }),
    );
    assert.ok(editor.getState().contextMenu);
    canvas.dispatchEvent(
      Object.assign(new Event('keydown', { cancelable: true }), {
        key: 'Escape',
      }),
    );
    assert.equal(editor.getState().contextMenu, null);
    assert.equal(editor.getState().locked, true);
    assert.equal(editor.getState().visible, false);
    canvas.dispatchEvent(pointer('contextmenu', 400, 300, 2));
    editor.setImage({
      naturalWidth: 900,
      naturalHeight: 300,
    } as HTMLImageElement);
    editor.update(1000, false);
    assert.equal(editor.getState().contextMenu, null);
  } finally {
    cleanup();
  }
});
