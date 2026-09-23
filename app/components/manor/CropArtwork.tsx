import type { ManorCrop } from "@/lib/gamify";

interface CropArtworkProps {
  crop: ManorCrop;
  stage: number;
  className?: string;
}

const OUTLINE = "var(--manor-ink)";

function Leaf({ x, y, flip = false, color }: { x: number; y: number; flip?: boolean; color: string }) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx="15"
      ry="8"
      transform={`rotate(${flip ? -28 : 28} ${x} ${y})`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth="3"
    />
  );
}

export function CropArtwork({ crop, stage, className }: CropArtworkProps) {
  if (stage <= 0) {
    return (
      <svg className={className} data-crop={crop.id} viewBox="0 0 120 120" aria-hidden="true">
        <ellipse cx="60" cy="88" rx="30" ry="9" fill="var(--crop-shadow)" opacity="0.24" />
        <path d="M46 79c7-18 23-18 29-2-4 15-20 21-29 2Z" fill="var(--crop-accent)" stroke={OUTLINE} strokeWidth="4" />
        <path d="M56 73c5 3 9 7 12 13" fill="none" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  const stemTop = stage === 1 ? 58 : stage === 2 ? 35 : 22;
  return (
    <svg className={className} data-crop={crop.id} viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="100" rx="35" ry="10" fill="var(--crop-shadow)" opacity="0.22" />
      <path d={`M60 99 C57 78,62 55,60 ${stemTop}`} fill="none" stroke="var(--crop-stem)" strokeWidth="6" strokeLinecap="round" />
      <Leaf x={49} y={stage === 1 ? 72 : 66} color="var(--crop-leaf)" />
      <Leaf x={72} y={stage === 1 ? 63 : 54} flip color="var(--crop-leaf-2)" />

      {stage >= 2 && crop.id === "wheat" && (
        <>
          {[0, 1, 2, 3].map((i) => <ellipse key={`l-${i}`} cx={51 - i * 2} cy={45 - i * 8} rx="7" ry="10" transform={`rotate(-30 ${51 - i * 2} ${45 - i * 8})`} fill="var(--crop-primary)" stroke={OUTLINE} strokeWidth="2.5" />)}
          {[0, 1, 2, 3].map((i) => <ellipse key={`r-${i}`} cx={69 + i * 2} cy={45 - i * 8} rx="7" ry="10" transform={`rotate(30 ${69 + i * 2} ${45 - i * 8})`} fill="var(--crop-accent)" stroke={OUTLINE} strokeWidth="2.5" />)}
        </>
      )}
      {stage >= 2 && crop.id === "tomato" && (
        <>
          <path d="M46 40 60 30 74 40 60 46Z" fill="var(--crop-stem)" stroke={OUTLINE} strokeWidth="3" />
          <circle cx="46" cy="49" r={stage === 3 ? 15 : 10} fill="var(--crop-primary)" stroke={OUTLINE} strokeWidth="3" />
          <circle cx="75" cy="54" r={stage === 3 ? 14 : 9} fill={stage === 3 ? "var(--crop-primary)" : "var(--crop-accent)"} stroke={OUTLINE} strokeWidth="3" />
        </>
      )}
      {stage >= 2 && crop.id === "bean" && (
        <>
          <path d="M60 62C88 51 88 25 68 20C86 36 67 43 60 35" fill="none" stroke="var(--crop-stem)" strokeWidth="5" strokeLinecap="round" />
          <path d="M73 37c12-6 20 3 13 13-11 4-19-2-13-13Z" fill="var(--crop-accent)" stroke={OUTLINE} strokeWidth="3" />
          {stage === 3 && <path d="M47 34c-13-5-21 7-13 17 14 2 21-7 13-17Z" fill="var(--crop-primary)" stroke={OUTLINE} strokeWidth="3" />}
        </>
      )}
      {stage >= 2 && crop.id === "rice" && (
        <>
          {[42, 51, 60, 69, 78].map((x, i) => (
            <path key={x} d={`M60 66 Q${x} ${44 - i * 2} ${x} 27`} fill="none" stroke={i % 2 ? "var(--crop-primary)" : "var(--crop-leaf-2)"} strokeWidth="4" strokeLinecap="round" />
          ))}
          {stage === 3 && [43, 51, 69, 77].map((x) => <circle key={x} cx={x} cy="31" r="5" fill="var(--crop-accent)" stroke={OUTLINE} strokeWidth="2" />)}
        </>
      )}
      {stage >= 2 && crop.id === "sunflower" && (
        <>
          <g transform={stage === 3 ? "scale(1.08) translate(-4.5 -3)" : undefined}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => <ellipse key={deg} cx="60" cy="24" rx="9" ry="18" transform={`rotate(${deg} 60 43)`} fill="var(--crop-accent)" stroke={OUTLINE} strokeWidth="2.5" />)}
            <circle cx="60" cy="43" r="15" fill="var(--crop-primary)" stroke={OUTLINE} strokeWidth="3" />
          </g>
        </>
      )}
      {stage >= 2 && crop.id === "bamboo" && (
        <>
          <path d="M52 82V27M69 80V39" fill="none" stroke="var(--crop-primary)" strokeWidth="10" strokeLinecap="round" />
          {[43, 60].map((y) => <path key={`a-${y}`} d={`M47 ${y}h10M64 ${y + 7}h10`} stroke="var(--crop-accent)" strokeWidth="3" />)}
          <Leaf x={43} y={34} color="var(--crop-accent)" />
          {stage === 3 && <Leaf x={79} y={29} flip color="var(--crop-primary)" />}
        </>
      )}

      {stage === 1 && <circle cx="60" cy="53" r="7" fill="var(--crop-accent)" stroke={OUTLINE} strokeWidth="3" />}
    </svg>
  );
}
