import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";

/**
 * Shared Canvas wrapper. Transparent background so the site's paper (#F7F6F2)
 * shows through -- these scenes are meant to sit inside a Card like any other
 * chart, not look like a bolted-on game HUD. Lighting uses the site's own
 * accent/gold palette rather than generic white studio lights, so the 3D
 * pieces render with the same warmth as the rest of the UI.
 */
export default function Scene({
  children,
  height = 260,
  cameraPosition = [0, 1.4, 7.5],
  fov = 38,
  className = "",
  ariaLabel,
}) {
  return (
    <div
      className={`w-full rounded-xl2 overflow-hidden ${className}`}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: cameraPosition, fov }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.75} color="#F7F6F2" />
        <directionalLight position={[4, 6, 5]} intensity={1.15} color="#FFFFFF" />
        <directionalLight position={[-5, -2, -4]} intensity={0.4} color="#C9A24B" />
        <pointLight position={[0, 3, 2]} intensity={0.3} color="#1F6F5C" />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
