import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props { size?: number; speed?: number; className?: string; }

export default function MobiusStrip({ size = 120, speed = 1, className = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ renderer: THREE.WebGLRenderer; raf: number; angle: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const p = new THREE.PointLight(0x60b3ff, 5, 20);
    p.position.set(3, 3, 3); scene.add(p);
    const d = new THREE.DirectionalLight(0x0057cc, 2);
    d.position.set(-2, -1, 2); scene.add(d);

    // Möbius parametric geometry
    const segments = 200, width = 20;
    const positions: number[] = [], indices: number[] = [], uvs: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      for (let j = 0; j <= width; j++) {
        const s = (j / width - 0.5) * 0.9;
        const x = (1 + s * Math.cos(t / 2)) * Math.cos(t);
        const y = (1 + s * Math.cos(t / 2)) * Math.sin(t);
        const z = s * Math.sin(t / 2);
        positions.push(x, y, z);
        uvs.push(i / segments, j / width);
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < width; j++) {
        const a = i * (width + 1) + j, b = a + width + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      color: 0x0E7AE6, specular: 0x60cfff, shininess: 180,
      side: THREE.DoubleSide, transparent: true, opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(0.7, 0.7, 0.7);
    scene.add(mesh);

    let angle = 0;
    const animate = () => {
      angle += 0.008 * speed;
      mesh.rotation.y = angle;
      mesh.rotation.x = Math.sin(angle * 0.4) * 0.3;
      renderer.render(scene, camera);
      state.current!.raf = requestAnimationFrame(animate);
    };
    state.current = { renderer, raf: 0, angle: 0 };
    animate();

    return () => {
      if (state.current) { cancelAnimationFrame(state.current.raf); renderer.dispose(); }
    };
  }, [size, speed]);

  return <canvas ref={ref} width={size} height={size} className={className} style={{ display: 'block' }} />;
}
