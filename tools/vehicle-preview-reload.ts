import type { Plugin } from 'vite';

/** A live Three.js instance owns GPU buffers: ordinary React HMR cannot replace them. */
export function vehiclePreviewReload(): Plugin {
  return {
    name: 'vehicle-preview-reload',
    apply: 'serve',
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onChange = (file: string) => {
        const path = file.replaceAll('\\', '/');
        if (
          !/\/(public\/model\/[^/]+\.(?:glb|json)|components\/studio\/scene-engine\.ts|lib\/(?:wiper-calibration|drafting-edges|drawing-silhouette|vehicle-assets|vehicle-wrap-editor|wrap-layout|wrap-eligibility)\.ts)$/.test(
            path,
          )
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => server.ws.send({ type: 'full-reload' }), 180);
      };
      server.watcher.on('change', onChange);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        server.watcher.off('change', onChange);
      });
    },
  };
}
