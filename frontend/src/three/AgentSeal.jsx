import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import usePrefersReducedMotion from "./usePrefersReducedMotion.js";

/**
 * A faceted "wax seal" -- an icosahedron core in the site's accent green with
 * a gold wireframe shell, echoing the paper-and-ink identity of the rest of
 * the app rather than a generic sci-fi orb. Rotates gently at idle and spins
 * up with a visible pulse while the agent is composing a reply.
 */
export default function AgentSeal({ thinking = false, size = 1 }) {
  const coreRef = useRef();
  const ringRef = useRef();
  const reduced = usePrefersReducedMotion();

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const idleSpeed = reduced ? 0 : 0.22;
    const thinkSpeed = reduced ? 0 : 1.5;

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * (thinking ? thinkSpeed : idleSpeed);
      coreRef.current.rotation.x += delta * (thinking ? thinkSpeed * 0.4 : idleSpeed * 0.25);
      const pulse = thinking ? 1 + Math.sin(t * 6) * 0.07 : 1 + Math.sin(t * 1.1) * 0.02;
      coreRef.current.scale.setScalar(size * pulse);
    }
    if (ringRef.current) {
      ringRef.current.rotation.y -= delta * (thinking ? 0.9 : 0.12);
      ringRef.current.rotation.z += delta * (thinking ? 0.5 : 0.06);
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={thinking ? "#2E8B73" : "#1F6F5C"}
          roughness={0.25}
          metalness={0.35}
          flatShading
        />
      </mesh>
      <mesh ref={ringRef} scale={1.35}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#C9A24B" wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
