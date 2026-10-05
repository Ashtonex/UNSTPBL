import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Tilt3DCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  glareOpacity?: number;
}

export default function Tilt3DCard({
  children,
  className = '',
  maxTilt = 12,
  perspective = 1000,
  scale = 1.02,
  glareOpacity = 0.25,
}: Tilt3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
    transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
  });

  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({
    opacity: 0,
    background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 80%)',
  });

  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Mouse X & Y inside card relative to center [-1 to 1]
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const normX = (mouseX / width - 0.5) * 2;
      const normY = (mouseY / height - 0.5) * 2;

      // Calculate tilt angles
      const rotateX = -normY * maxTilt;
      const rotateY = normX * maxTilt;

      // Light sheen position
      const sheenX = (mouseX / width) * 100;
      const sheenY = (mouseY / height) * 100;

      setStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`,
        transition: 'transform 0.1s ease-out',
      });

      setGlareStyle({
        opacity: glareOpacity,
        background: `radial-gradient(circle at ${sheenX.toFixed(1)}% ${sheenY.toFixed(1)}%, rgba(251, 191, 36, 0.35) 0%, rgba(245, 158, 11, 0.12) 40%, rgba(255,255,255,0) 75%)`,
        transition: 'opacity 0.2s ease',
      });
    },
    [maxTilt, perspective, scale, glareOpacity]
  );

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
      transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    });
    setGlareStyle({
      opacity: 0,
      background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 80%)',
      transition: 'opacity 0.5s ease',
    });
  };

  // Mobile Device Gyroscope listener fallback
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!cardRef.current || isHovered) return;
      const beta = event.beta || 0; // [-180, 180] pitch
      const gamma = event.gamma || 0; // [-90, 90] roll

      // Clamp values for smooth subtle phone tilt
      const clampBeta = Math.min(Math.max(beta - 45, -20), 20) / 20;
      const clampGamma = Math.min(Math.max(gamma, -20), 20) / 20;

      const rotateX = -clampBeta * maxTilt * 0.7;
      const rotateY = clampGamma * maxTilt * 0.7;

      setStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1, 1, 1)`,
        transition: 'transform 0.2s ease-out',
      });
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [perspective, maxTilt, isHovered]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: 'preserve-3d',
        ...style,
      }}
      className={`relative rounded-2xl will-change-transform ${className}`}
    >
      {/* Dynamic Specular Light Glare Overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none z-30 transition-opacity duration-300 mix-blend-overlay overflow-hidden"
        style={glareStyle}
      />
      {children}
    </div>
  );
}
