import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface MobiusStripProps {
  size?: number;          // canvas size in px (square)
  speed?: number;         // rotation speed multiplier (default 1)
  autoplay?: boolean;     // whether to auto-rotate (default true)
  className?: string;
  rotationY?: number;     // override rotation (radians) — used for scroll control
}

export default function MobiusStrip({
  size = 300,
  speed = 1,
  autoplay = true,
  className = '',
  rotationY,
}: MobiusStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mesh: THREE.Mesh;
    rafId: number;
    angle: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Scene ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    // ── Lights ────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const pointLight = new THREE.PointLight(0x60b3ff, 4, 20);
    pointLight.position.set(3, 3, 3);
    scene.add(pointLight);

    const rimLight = new THREE.DirectionalLight(0x0057cc, 1.5);
    rimLight.position.set(-2, -1, 2);
    scene.add(rimLight);

    // ── Möbius parametric geometry ────────────────────────────────────────
    // The Möbius strip path: a circle with a half-twist applied to the cross-section
    const TUBE_SEGMENTS = 200;
    const RADIAL_SEGMENTS = 12;
    const R = 1.4;   // major radius
    const r = 0.18;  // tube radius

    // Möbius spine defined inline in the geometry loop below

    // Build a custom Möbius TubeGeometry with half-twist
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const TS = TUBE_SEGMENTS;
    const RS = RADIAL_SEGMENTS;

    for (let i = 0; i <= TS; i++) {
      const t = i / TS;
      const theta = t * 2 * Math.PI;

      // Spine point
      const cx = R * Math.cos(theta);
      const cy = R * Math.sin(theta);

      // Tangent along spine
      const tx = -Math.sin(theta);
      const ty =  Math.cos(theta);

      // Normal of the strip (rotates by half a turn = half-twist)
      const phi = theta / 2; // half-twist
      const nx = Math.cos(phi) * (-Math.sin(theta) * 0) + Math.cos(phi);
      // Corrected Möbius normals: use Frenet frame with half-twist
      const bx = Math.cos(phi);
      const by = Math.sin(phi);
      // bz oscillates for the 3D look
      const bz = Math.cos(phi);

      for (let j = 0; j <= RS; j++) {
        const s = (j / RS) * 2 * Math.PI;

        // Cross-section circle, twisted by phi
        const cosS = Math.cos(s);
        const sinS = Math.sin(s);

        // Frenet frame: tangent T, normal N, binormal B
        const Tx = -Math.sin(theta), Ty = Math.cos(theta), Tz = 0;

        // Normal N rotates by half-twist
        const Nx = Math.cos(phi) * 0 - Math.sin(phi) * Math.sin(theta);
        const Ny = Math.cos(phi) * 0 + Math.sin(phi) * Math.cos(theta);
        const Nz = Math.cos(phi);

        // Binormal B = T × N
        const Bx = Ty * Nz - Tz * Ny;
        const By = Tz * Nx - Tx * Nz;
        const Bz = Tx * Ny - Ty * Nx;

        const px = cx + r * (cosS * Nx + sinS * Bx);
        const py = cy + r * (cosS * Ny + sinS * By);
        const pz =      r * (cosS * Nz + sinS * Bz);

        positions.push(px, py, pz);
        normals.push(cosS * Nx + sinS * Bx, cosS * Ny + sinS * By, cosS * Nz + sinS * Bz);
        uvs.push(t, j / RS);
      }
    }

    for (let i = 0; i < TS; i++) {
      for (let j = 0; j < RS; j++) {
        const a = i * (RS + 1) + j;
        const b = a + RS + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals(); // recalculate for clean shading

    // ── Material ─────────────────────────────────────────────────────────
    const material = new THREE.MeshStandardMaterial({
      color: 0x2196F3,
      metalness: 0.85,
      roughness: 0.08,
      side: THREE.DoubleSide,
      envMapIntensity: 1.2,
    });

    // Subtle iridescent color variation via vertex colors approach
    // Apply via a slight emissive glow
    material.emissive = new THREE.Color(0x0041A8);
    material.emissiveIntensity = 0.15;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // ── Animation loop ────────────────────────────────────────────────────
    let angle = 0;
    let rafId = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      if (rotationY !== undefined) {
        mesh.rotation.y = rotationY;
        mesh.rotation.x = 0.3;
      } else if (autoplay) {
        angle += 0.008 * speed;
        mesh.rotation.y = angle;
        mesh.rotation.x = Math.sin(angle * 0.4) * 0.3;
        mesh.rotation.z = Math.sin(angle * 0.2) * 0.1;
      }

      renderer.render(scene, camera);
    };

    tick();

    stateRef.current = { renderer, scene, camera, mesh, rafId, angle };

    return () => {
      cancelAnimationFrame(rafId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      stateRef.current = null;
    };
  }, [size]); // Only re-init on size change

  // Update rotation externally without re-mounting
  useEffect(() => {
    if (stateRef.current && rotationY !== undefined) {
      stateRef.current.mesh.rotation.y = rotationY;
    }
  }, [rotationY]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', width: size, height: size }}
    />
  );
}
