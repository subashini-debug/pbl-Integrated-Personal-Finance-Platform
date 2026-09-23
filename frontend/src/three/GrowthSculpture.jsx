import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, OrbitControls } from "@react-three/drei";
import usePrefersReducedMotion from "./usePrefersReducedMotion.js";

const ACCENT = "#1F6F5C";
const CORAL = "#D9694F";

function Bar({ x, targetHeight, color, delay }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const grown = Math.min(1, Math.max(0, (t - delay) * 1.8));
    const breathe = 1 + Math.sin(t * 1.1 + x) * 0.008;
    const scaleY = Math.max(0.001, grown * breathe);
    ref.current.scale.set(1, scaleY, 1);
    ref.current.position.y = (targetHeight * scaleY) / 2;
  });

  return (
    <RoundedBox ref={ref} args={[0.42, targetHeight, 0.42]} radius={0.06} smoothness={4} position={[x, 0, 0]}>
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
    </RoundedBox>
  );
}

/**
 * A 3D reading of the same running-balance series as the dashboard's area
 * chart: each bar is a day, colored green when that day's balance sat at or
 * above the trailing average and coral when it dipped below -- literally
 * "in the black" vs "in the red", rendered as a physical ledger.
 *
 * `points`: [{ value: number }] in chronological order.
 */
export default function GrowthSculpture({ points = [] }) {
  const reduced = usePrefersReducedMotion();

  const bars = useMemo(() => {
    if (!points.length) return [];
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const span = max - min || 1;
    const spacing = 0.58;
    const startX = -((points.length - 1) * spacing) / 2;

    return points.map((p, i) => {
      const norm = (p.value - min) / span;
      return {
        x: startX + i * spacing,
        targetHeight: 0.3 + norm * 2.4,
        color: p.value >= mean ? ACCENT : CORAL,
        delay: i * 0.025,
      };
    });
  }, [points]);

  if (!bars.length) return null;

  const floorWidth = bars.length * 0.58 + 1.2;

  return (
    <>
      <group position={[0, -1.2, 0]}>
        {bars.map((b, i) => (
          <Bar key={i} x={b.x} targetHeight={b.targetHeight} color={b.color} delay={b.delay} />
        ))}
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[floorWidth, 1.8]} />
          <meshStandardMaterial color="#0F1115" opacity={0.05} transparent />
        </mesh>
      </group>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={!reduced}
        autoRotateSpeed={0.55}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={Math.PI / 3.4}
      />
    </>
  );
}
