import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import usePrefersReducedMotion from "./usePrefersReducedMotion.js";

function CoinStack({ x, count, color, label, pct, delay }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const grown = Math.min(1, Math.max(0, (t - delay) * 2.2));
    groupRef.current.scale.set(1, grown, 1);
  });

  const coins = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        y: i * 0.13,
        jitterX: Math.sin(i * 12.9) * 0.02,
        jitterZ: Math.cos(i * 7.3) * 0.02,
        rot: (i * 0.35) % (Math.PI * 2),
      })),
    [count]
  );

  return (
    <group position={[x, 0, 0]}>
      <group ref={groupRef}>
        {coins.map((c, i) => (
          <mesh key={i} position={[c.jitterX, c.y, c.jitterZ]} rotation={[0, c.rot, 0]}>
            <cylinderGeometry args={[0.46, 0.46, 0.11, 28]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.45} />
          </mesh>
        ))}
      </group>
      <Html center position={[0, -0.45, 0]} distanceFactor={7.5} occlude={false}>
        <div className="text-center pointer-events-none select-none">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/60 whitespace-nowrap">
            {label}
          </div>
          <div className="font-display text-sm text-ink whitespace-nowrap">{pct}%</div>
        </div>
      </Html>
    </group>
  );
}

/**
 * Renders an asset allocation as four physical coin stacks -- one per asset
 * class, height proportional to its percentage. A literal reading of "where
 * your money sits" rather than an abstract 3D donut.
 *
 * `segments`: [{ key, label, pct, color }]
 */
export default function AllocationSculpture({ segments = [] }) {
  const reduced = usePrefersReducedMotion();
  if (!segments.length) return null;

  const spacing = 1.55;
  const startX = -((segments.length - 1) * spacing) / 2;

  return (
    <>
      <group position={[0, -0.85, 0]}>
        {segments.map((s, i) => (
          <CoinStack
            key={s.key}
            x={startX + i * spacing}
            count={Math.max(1, Math.round(s.pct / 5))}
            color={s.color}
            label={s.label}
            pct={s.pct}
            delay={i * 0.15}
          />
        ))}
      </group>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={!reduced}
        autoRotateSpeed={0.45}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 3.6}
      />
    </>
  );
}
