'use client';

interface ScoreGaugeProps {
  score: number | null;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZE = { sm: 64, md: 88, lg: 112 };
const STROKE = { sm: 6, md: 8, lg: 10 };

function scoreToColor(score: number): string {
  if (score >= 90) return '#10B981'; // emerald — Excellent
  if (score >= 75) return '#34D399'; // emerald-lighter — Good
  if (score >= 50) return '#F59E0B'; // amber — Needs improvement
  if (score >= 25) return '#F97316'; // orange — Poor
  return '#EF4444';                  // red — Critical
}

/** Score band label — mirrors spec §8 thresholds exactly. */
function scoreBandLabel(score: number | null): string {
  if (score === null) return 'Not measured';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs improvement';
  if (score >= 25) return 'Poor';
  return 'Critical';
}

function scoreBandColor(score: number | null): string {
  if (score === null) return 'text-zinc-400';
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-emerald-300';
  if (score >= 50) return 'text-amber-400';
  if (score >= 25) return 'text-orange-400';
  return 'text-red-400';
}

export function ScoreGauge({ score, label, size = 'md', showLabel = false }: ScoreGaugeProps) {
  const diameter = SIZE[size];
  const strokeWidth = STROKE[size];
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const dashOffset = score !== null ? circumference * (1 - clamped / 100) : circumference;
  const stroke = score !== null ? scoreToColor(clamped) : 'rgba(255,255,255,0.15)';
  const center = diameter / 2;
  const fontSize = size === 'lg' ? 22 : size === 'md' ? 18 : 14;
  const displayText = score !== null ? String(clamped) : '—';
  const band = scoreBandLabel(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={diameter} height={diameter} aria-label={`${label}: ${score !== null ? score : 'not measured'}`}>
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        {/* Progress — starts at top (-90°) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x={center}
          y={center + fontSize * 0.35}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill={stroke}
        >
          {displayText}
        </text>
      </svg>
      <span className="text-muted-foreground text-xs">{label}</span>
      {showLabel && (
        <span className={`text-xs font-medium ${scoreBandColor(score)}`}>{band}</span>
      )}
    </div>
  );
}

export { scoreBandLabel, scoreBandColor };
