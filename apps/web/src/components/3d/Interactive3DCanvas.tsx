import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Interactive3DCanvasProps {
  isSpeaking?: boolean;
}

export default function Interactive3DCanvas({ isSpeaking = false }: Interactive3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isSpeakingRef = useRef(isSpeaking);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      // ── Scene & Camera ──────────────────────────────────────────────
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 40;

      // Avoid powerPreference:'high-performance' — it throws on some mobile GPUs
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false, // disabled for perf on mobile
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      container.appendChild(renderer.domElement);

      // ── Particle Setup ──────────────────────────────────────────────
      const isMobile = window.innerWidth < 768;
      const aspect = window.innerWidth / window.innerHeight;
      const visibleHeight = 56;
      const visibleWidth = Math.max(28, visibleHeight * aspect);

      const particleCount = isMobile
        ? 95
        : Math.min(180, Math.floor((window.innerWidth * window.innerHeight) / 7500));

      const positions = new Float32Array(particleCount * 3);
      const originalPositions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      const colorAmber = new THREE.Color('#f59e0b');
      const colorGold = new THREE.Color('#fbbf24');
      const colorCyan = new THREE.Color('#38bdf8');
      const colorWhite = new THREE.Color('#ffffff');

      for (let i = 0; i < particleCount; i++) {
        const x = (Math.random() - 0.5) * visibleWidth * 1.35;
        const y = (Math.random() - 0.5) * visibleHeight * 1.35;
        const z = (Math.random() - 0.5) * (isMobile ? 32 : 55);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y;
        originalPositions[i * 3 + 2] = z;

        const rand = Math.random();
        const c = rand > 0.55 ? colorAmber : rand > 0.3 ? colorGold : rand > 0.1 ? colorCyan : colorWhite;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Glowing radial texture
      const texCanvas = document.createElement('canvas');
      texCanvas.width = 64;
      texCanvas.height = 64;
      const ctx = texCanvas.getContext('2d');
      if (ctx) {
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(251,191,36,0.95)');
        g.addColorStop(0.55, 'rgba(245,158,11,0.45)');
        g.addColorStop(0.85, 'rgba(56,189,248,0.2)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(32, 32, 32, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(texCanvas);
      const material = new THREE.PointsMaterial({
        size: isMobile ? 3.0 : 2.4,
        map: texture,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: isMobile ? 0.95 : 0.8,
      });

      const particleSystem = new THREE.Points(geometry, material);
      scene.add(particleSystem);

      // ── Constellation Lines ─────────────────────────────────────────
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: isMobile ? 0.22 : 0.12,
        blending: THREE.AdditiveBlending,
      });
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array(particleCount * 6);
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
      scene.add(lineMesh);

      // ── Event Listeners ─────────────────────────────────────────────
      const onMouseMove = (e: MouseEvent) => {
        mouseRef.current.targetX = ((e.clientX / window.innerWidth) * 2 - 1) * 16;
        mouseRef.current.targetY = (-(e.clientY / window.innerHeight) * 2 + 1) * 16;
      };

      const onTouch = (e: TouchEvent) => {
        if (!e.touches.length) return;
        const t = e.touches[0];
        mouseRef.current.targetX = ((t.clientX / window.innerWidth) * 2 - 1) * 18;
        mouseRef.current.targetY = (-(t.clientY / window.innerHeight) * 2 + 1) * 18;
      };

      const onTouchEnd = () => {
        mouseRef.current.targetX = 0;
        mouseRef.current.targetY = 0;
      };

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('touchstart', onTouch, { passive: true });
      window.addEventListener('touchmove', onTouch, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
      window.addEventListener('resize', onResize);

      // ── Render Loop ─────────────────────────────────────────────────
      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

        camera.position.x = mouseRef.current.x * 0.5 + Math.sin(t * 0.3) * 2;
        camera.position.y = mouseRef.current.y * 0.5 + Math.cos(t * 0.2) * 2;
        camera.lookAt(0, 0, 0);

        const pulse = isSpeakingRef.current ? Math.sin(t * 8) * 1.5 + 2.0 : 1.0;

        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        const cur = posAttr.array as Float32Array;

        let lineIdx = 0;
        const maxDistSq = 225;

        for (let i = 0; i < particleCount; i++) {
          const ox = originalPositions[i * 3];
          const oy = originalPositions[i * 3 + 1];
          const oz = originalPositions[i * 3 + 2];

          const wX = Math.sin(t * 0.6 + i) * 1.2 * pulse;
          const wY = Math.cos(t * 0.5 + i * 1.5) * 1.2 * pulse;
          const wZ = Math.sin(t * 0.4 + i * 0.5) * 1.5 * pulse;

          const dx = cur[i * 3] - mouseRef.current.x * 2;
          const dy = cur[i * 3 + 1] - mouseRef.current.y * 2;
          const dSq = dx * dx + dy * dy;
          let fx = 0, fy = 0;
          if (dSq < 150 && dSq > 0.01) {
            const f = (150 - dSq) / 150;
            const inv = f * 4 / Math.sqrt(dSq);
            fx = dx * inv;
            fy = dy * inv;
          }

          cur[i * 3] = ox + wX + fx;
          cur[i * 3 + 1] = oy + wY + fy;
          cur[i * 3 + 2] = oz + wZ;

          if (i % 2 === 0) {
            for (let j = i + 1; j < Math.min(i + 8, particleCount); j++) {
              const dxL = cur[i * 3] - originalPositions[j * 3];
              const dyL = cur[i * 3 + 1] - originalPositions[j * 3 + 1];
              const dzL = cur[i * 3 + 2] - originalPositions[j * 3 + 2];
              if (dxL * dxL + dyL * dyL + dzL * dzL < maxDistSq && lineIdx < particleCount * 6 - 6) {
                linePositions[lineIdx++] = cur[i * 3];
                linePositions[lineIdx++] = cur[i * 3 + 1];
                linePositions[lineIdx++] = cur[i * 3 + 2];
                linePositions[lineIdx++] = originalPositions[j * 3];
                linePositions[lineIdx++] = originalPositions[j * 3 + 1];
                linePositions[lineIdx++] = originalPositions[j * 3 + 2];
              }
            }
          }
        }

        posAttr.needsUpdate = true;
        (lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        particleSystem.rotation.y = t * 0.03;

        if (renderer) renderer.render(scene, camera);
      };

      animate();

      // ── Cleanup ─────────────────────────────────────────────────────
      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchstart', onTouch);
        window.removeEventListener('touchmove', onTouch);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('resize', onResize);
        if (renderer && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        geometry.dispose();
        lineGeometry.dispose();
        material.dispose();
        texture.dispose();
        lineMaterial.dispose();
        renderer?.dispose();
      };
    } catch (err) {
      console.error('[Interactive3DCanvas] WebGL init failed:', err);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[1] overflow-hidden"
      aria-hidden="true"
    />
  );
}
