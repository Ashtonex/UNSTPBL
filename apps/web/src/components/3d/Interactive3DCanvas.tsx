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

    // Reduced motion check
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;

    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 40;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Particle Geometry & Material setup
      const particleCount = Math.min(180, Math.floor((window.innerWidth * window.innerHeight) / 9000));
      const positions = new Float32Array(particleCount * 3);
      const originalPositions = new Float32Array(particleCount * 3);
      const scales = new Float32Array(particleCount);
      const colors = new Float32Array(particleCount * 3);

      const colorAmber = new THREE.Color('#f59e0b');
      const colorGold = new THREE.Color('#fbbf24');
      const colorCyan = new THREE.Color('#38bdf8');
      const colorWhite = new THREE.Color('#ffffff');

      for (let i = 0; i < particleCount; i++) {
        const x = (Math.random() - 0.5) * 80;
        const y = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 60;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y;
        originalPositions[i * 3 + 2] = z;

        scales[i] = Math.random() * 1.8 + 0.6;

        // Color variance
        const rand = Math.random();
        const particleColor = rand > 0.6 ? colorAmber : rand > 0.3 ? colorGold : rand > 0.1 ? colorCyan : colorWhite;
        colors[i * 3] = particleColor.r;
        colors[i * 3 + 1] = particleColor.g;
        colors[i * 3 + 2] = particleColor.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Custom circular particle texture via canvas
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(251, 191, 36, 0.8)');
        gradient.addColorStop(0.7, 'rgba(245, 158, 11, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(16, 16, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.PointsMaterial({
        size: 2.4,
        map: texture,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.75,
      });

      const particleSystem = new THREE.Points(geometry, material);
      scene.add(particleSystem);

      // Connecting Constellation Lines
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
      });

      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array(particleCount * 6);
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
      scene.add(lineMesh);

      // Mouse Move Listener
      const handleMouseMove = (event: MouseEvent) => {
        const normX = (event.clientX / window.innerWidth) * 2 - 1;
        const normY = -(event.clientY / window.innerHeight) * 2 + 1;
        mouseRef.current.targetX = normX * 15;
        mouseRef.current.targetY = normY * 15;
      };

      const handleTouchMove = (event: TouchEvent) => {
        if (event.touches.length > 0) {
          const touch = event.touches[0];
          const normX = (touch.clientX / window.innerWidth) * 2 - 1;
          const normY = -(touch.clientY / window.innerHeight) * 2 + 1;
          mouseRef.current.targetX = normX * 15;
          mouseRef.current.targetY = normY * 15;
        }
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });

      const handleResize = () => {
        if (!containerRef.current) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', handleResize);

      // Clock for time animation
      const clock = new THREE.Clock();

      // Render Loop
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Smooth mouse lerping
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

        // Camera gentle drift + mouse target
        camera.position.x = mouseRef.current.x * 0.5 + Math.sin(elapsedTime * 0.3) * 2;
        camera.position.y = mouseRef.current.y * 0.5 + Math.cos(elapsedTime * 0.2) * 2;
        camera.lookAt(0, 0, 0);

        // Audio pulse factor
        const audioPulse = isSpeakingRef.current ? Math.sin(elapsedTime * 8) * 1.5 + 2.0 : 1.0;

        // Update positions dynamically
        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        const currentPositions = posAttr.array as Float32Array;

        let lineIdx = 0;
        const maxDistSq = 225; // 15^2 max distance for connection lines

        for (let i = 0; i < particleCount; i++) {
          const origX = originalPositions[i * 3];
          const origY = originalPositions[i * 3 + 1];
          const origZ = originalPositions[i * 3 + 2];

          // Floating wave physics
          const waveX = Math.sin(elapsedTime * 0.6 + i) * 1.2 * audioPulse;
          const waveY = Math.cos(elapsedTime * 0.5 + i * 1.5) * 1.2 * audioPulse;
          const waveZ = Math.sin(elapsedTime * 0.4 + i * 0.5) * 1.5 * audioPulse;

          // Interactive repulsion from cursor in 3D world space
          const dx = currentPositions[i * 3] - mouseRef.current.x * 2;
          const dy = currentPositions[i * 3 + 1] - mouseRef.current.y * 2;
          const distSq = dx * dx + dy * dy;

          let forceX = 0;
          let forceY = 0;
          if (distSq < 150 && distSq > 0.01) {
            const force = (150 - distSq) / 150;
            forceX = (dx / Math.sqrt(distSq)) * force * 4;
            forceY = (dy / Math.sqrt(distSq)) * force * 4;
          }

          currentPositions[i * 3] = origX + waveX + forceX;
          currentPositions[i * 3 + 1] = origY + waveY + forceY;
          currentPositions[i * 3 + 2] = origZ + waveZ;

          // Build dynamic lines between nearby nodes
          if (i % 2 === 0) {
            for (let j = i + 1; j < Math.min(i + 8, particleCount); j++) {
              const dxL = currentPositions[i * 3] - originalPositions[j * 3];
              const dyL = currentPositions[i * 3 + 1] - originalPositions[j * 3 + 1];
              const dzL = currentPositions[i * 3 + 2] - originalPositions[j * 3 + 2];
              const dSq = dxL * dxL + dyL * dyL + dzL * dzL;

              if (dSq < maxDistSq && lineIdx < particleCount * 6 - 6) {
                linePositions[lineIdx++] = currentPositions[i * 3];
                linePositions[lineIdx++] = currentPositions[i * 3 + 1];
                linePositions[lineIdx++] = currentPositions[i * 3 + 2];

                linePositions[lineIdx++] = originalPositions[j * 3];
                linePositions[lineIdx++] = originalPositions[j * 3 + 1];
                linePositions[lineIdx++] = originalPositions[j * 3 + 2];
              }
            }
          }
        }

        posAttr.needsUpdate = true;
        (lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

        particleSystem.rotation.y = elapsedTime * 0.03;
        renderer.render(scene, camera);
      };

      animate();

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    } catch (e) {
      console.warn('WebGL rendering disabled or unsupported:', e);
      return;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-80 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
}
