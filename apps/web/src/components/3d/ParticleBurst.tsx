import { useEffect, useRef } from 'react';

interface ParticleBurstProps {
  active: boolean;
  onComplete?: () => void;
  color?: string;
  originX?: number;
  originY?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  spin: number;
  angle: number;
}

export default function ParticleBurst({
  active,
  onComplete,
  color = '#fbbf24',
  originX,
  originY,
}: ParticleBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth || 300);
    const height = (canvas.height = canvas.offsetHeight || 300);

    const spawnX = originX !== undefined ? Math.min(Math.max(20, originX), width - 20) : width / 2;
    const spawnY = originY !== undefined ? Math.min(Math.max(20, originY), height - 20) : height / 2;

    const particles: Particle[] = [];
    const colors = [color, '#f59e0b', '#38bdf8', '#ffffff', '#eab308', '#fb7185'];

    // Spawn burst particles
    const particleCount = 52;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2.5;

      particles.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8, // slight upward float
        size: Math.random() * 5.5 + 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.025 + 0.015,
        spin: (Math.random() - 0.5) * 0.2,
        angle: Math.random() * Math.PI * 2,
      });
    }

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0) continue;

        aliveCount++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity force
        p.vx *= 0.96; // air resistance friction
        p.alpha -= p.decay;
        p.angle += p.spin;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;

        // Render diamond/star shape particle
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.6, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.6, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      if (aliveCount > 0) {
        animId = requestAnimationFrame(render);
      } else {
        onComplete?.();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [active, color, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-hidden"
    />
  );
}
