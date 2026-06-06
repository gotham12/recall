import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Pre-renders 65 Möbius strip frames (evenly spaced rotation angles)
 * using an offscreen Three.js renderer.
 *
 * Returns the array of data URLs once all frames are baked.
 * This runs once after mount in a non-blocking way using requestIdleCallback.
 */
export function useMobiusFrames(
  frameCount = 65,
  frameSize = 400
): { frames: string[]; ready: boolean } {
  const [frames, setFrames] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const bake = () => {
      // Offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = frameSize;
      canvas.height = frameSize;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(1); // always 1 for offscreen baking
      renderer.setSize(frameSize, frameSize);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 4.5);

      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);
      const point = new THREE.PointLight(0x60b3ff, 4, 20);
      point.position.set(3, 3, 3);
      scene.add(point);
      const rim = new THREE.DirectionalLight(0x0057cc, 1.5);
      rim.position.set(-2, -1, 2);
      scene.add(rim);

      // Build Möbius geometry (same as MobiusStrip.tsx)
      const R = 1.4, r = 0.18;
      const TS = 200, RS = 12;

      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indexArr: number[] = [];

      for (let i = 0; i <= TS; i++) {
        const t = i / TS;
        const theta = t * 2 * Math.PI;
        const cx = R * Math.cos(theta);
        const cy = R * Math.sin(theta);
        const phi = theta / 2;

        for (let j = 0; j <= RS; j++) {
          const Tx = -Math.sin(theta), Ty = Math.cos(theta), Tz = 0;
          const Nx = Math.cos(phi) * 0 - Math.sin(phi) * Math.sin(theta);
          const Ny = Math.cos(phi) * 0 + Math.sin(phi) * Math.cos(theta);
          const Nz = Math.cos(phi);
          const Bx = Ty * Nz - Tz * Ny;
          const By = Tz * Nx - Tx * Nz;
          const Bz = Tx * Ny - Ty * Nx;

          const s = (j / RS) * 2 * Math.PI;
          const cosS = Math.cos(s), sinS = Math.sin(s);

          positions.push(
            cx + r * (cosS * Nx + sinS * Bx),
            cy + r * (cosS * Ny + sinS * By),
                 r * (cosS * Nz + sinS * Bz)
          );
          normals.push(cosS * Nx + sinS * Bx, cosS * Ny + sinS * By, cosS * Nz + sinS * Bz);
          uvs.push(t, j / RS);
        }
      }

      for (let i = 0; i < TS; i++) {
        for (let j = 0; j < RS; j++) {
          const a = i * (RS + 1) + j;
          const b = a + RS + 1;
          indexArr.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indexArr);
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: 0x2196F3,
        metalness: 0.85,
        roughness: 0.08,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x0041A8),
        emissiveIntensity: 0.15,
      });

      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      // Render each frame
      const result: string[] = [];
      for (let f = 0; f < frameCount; f++) {
        const angle = (f / (frameCount - 1)) * Math.PI * 2;
        mesh.rotation.y = angle;
        mesh.rotation.x = Math.sin(angle * 0.4) * 0.3;
        mesh.rotation.z = Math.sin(angle * 0.2) * 0.1;

        renderer.render(scene, camera);
        result.push(canvas.toDataURL('image/png'));
      }

      // Cleanup
      geo.dispose();
      mat.dispose();
      renderer.dispose();

      setFrames(result);
      setReady(true);
    };

    // Run after first paint to avoid blocking the UI
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void })
        .requestIdleCallback(bake);
    } else {
      setTimeout(bake, 100);
    }
  }, [frameCount, frameSize]);

  return { frames, ready };
}
