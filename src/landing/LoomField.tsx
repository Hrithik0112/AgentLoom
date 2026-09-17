import { MagnetLines } from "@/components/ui/magnet-lines";

/**
 * Split out and lazily imported. The effect is decoration below the fold, and the
 * component brings framer-motion with it, which is not worth blocking first paint for.
 */
export default function LoomField() {
  return (
    <MagnetLines
      rows={9}
      columns={22}
      containerSize="min(1100px, 100%)"
      lineColor="var(--color-line-strong)"
      lineWidth="2px"
      lineHeight="26px"
      baseAngle={0}
      style={{ height: "300px", pointerEvents: "auto" }}
    />
  );
}
