import { MARK_INNER, MARK_VIEWBOX } from "@/lib/brand-svg";

export function BrandMark({ size = 40, title = "Legal Nexus" }: { size?: number; title?: string }) {
  const [, , vw, vh] = MARK_VIEWBOX.split(" ").map(Number);
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={Math.round((size * vw) / vh)}
      height={size}
      role="img"
      aria-label={title}
      className="brand-mark"
      dangerouslySetInnerHTML={{ __html: MARK_INNER }}
    />
  );
}

/** Mark + stacked wordmark. Colour of the wordmark follows --brand-ink; the X is always brand gold. */
export function BrandLockup({ size = 40, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="brand-lockup" style={{ fontSize: Math.round(size * 0.5) }}>
      <BrandMark size={size} />
      <span className="brand-word">
        <span className="l1">LEGAL</span>
        <span className="l2">
          NE<i>X</i>US
        </span>
        {tagline && <span className="l3">LEGAL MANAGEMENT &amp; ENTERPRISE SOLUTIONS</span>}
      </span>
    </span>
  );
}
