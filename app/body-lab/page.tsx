'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import BodyConfigPanel from '@/components/studio/BodyConfigPanel';
import { t, type Lang } from '@/lib/i18n';
import {
  DEFAULT_BODY_CONFIG,
  checkBodyConstraints,
  type BodyConfig,
} from '@/lib/parametric-body';
import {
  buildParametricBody,
  disposeParametricBody,
} from '@/lib/parametric-body-scene';

/**
 * Body lab (slice 1): parametric V80 body-type-B configurator.
 * Deliberately separate from the main wrap studio page: the shipped GLB
 * model and the decal flow are untouched. The preview here is a schematic
 * procedural body, not the real V80 model.
 */
export default function BodyLabPage() {
  const [lang, setLang] = useState<Lang>('zh');
  const [config, setConfig] = useState<BodyConfig>(DEFAULT_BODY_CONFIG);
  const host = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const bodyRef = useRef<THREE.Group | null>(null);
  const view = useRef({ azimuth: 0.7, polar: 1.15, radius: 10 });

  const results = useMemo(() => checkBodyConstraints(config), [config]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf4e9e3);
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4b0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(6, 10, 4);
    scene.add(sun);
    const grid = new THREE.GridHelper(20, 20, 0x9e4b4b, 0xd8cbb8);
    scene.add(grid);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const target = new THREE.Vector3(0, 1.2, 0);

    const resize = () => {
      const width = element.clientWidth || 640;
      const height = element.clientHeight || 520;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    const frame = () => {
      const { azimuth, polar, radius } = view.current;
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth),
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    const loop = () => {
      frame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      view.current.azimuth -= (event.clientX - lastX) * 0.005;
      view.current.polar = Math.min(
        1.5,
        Math.max(0.15, view.current.polar + (event.clientY - lastY) * 0.005),
      );
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      view.current.radius = Math.min(
        18,
        Math.max(4, view.current.radius * (1 + event.deltaY * 0.001)),
      );
    };
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      if (bodyRef.current) {
        scene.remove(bodyRef.current);
        disposeParametricBody(bodyRef.current);
        bodyRef.current = null;
      }
      sceneRef.current = null;
      renderer.dispose();
      element.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (bodyRef.current) {
      scene.remove(bodyRef.current);
      disposeParametricBody(bodyRef.current);
    }
    const next = buildParametricBody(config);
    scene.add(next);
    bodyRef.current = next;
  }, [config]);

  return (
    <main style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 4px' }}>{t(lang, 'bodylab.title')}</h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
            {t(lang, 'bodylab.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setLang('zh')}>
            {t(lang, 'bodylab.langZh')}
          </button>
          <button type="button" onClick={() => setLang('en')}>
            {t(lang, 'bodylab.langEn')}
          </button>
        </div>
      </header>
      <div
        style={{
          display: 'flex',
          gap: 20,
          marginTop: 20,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ width: 340, flexShrink: 0 }}>
          <BodyConfigPanel
            lang={lang}
            config={config}
            results={results}
            onChange={setConfig}
          />
        </div>
        <div
          ref={host}
          aria-label={t(lang, 'bodylab.canvasAria')}
          style={{
            flex: 1,
            minWidth: 320,
            minHeight: 520,
            background: '#f4e9e3',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        />
      </div>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        {t(lang, 'bodylab.orbitHint')}
      </p>
    </main>
  );
}
