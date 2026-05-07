'use client';

interface ScoreGaugeProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = { sm: 64, md: 88, lg: 112 };
const STROKE = { sm: 6, md: 8, lg: 10 };

function scoreToColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

export function ScoreGauge({ score, label, size = 'md' }: ScoreGaugeProps) {
  const diameter = SIZE[size];
  const strokeWidth = STROKE[size];
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const dashOffset = circumference * (1 - clamped / 100);
  const stroke = scoreToColor(clamped);
  const center = diameter / 2;
  const fontSize = size === 'lg' ? 22 : size === 'md' ? 18 : 14;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={diameter} height={diameter} aria-label={`${label}: ${score}`}>
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
          {clamped}
        </text>
      </svg>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
