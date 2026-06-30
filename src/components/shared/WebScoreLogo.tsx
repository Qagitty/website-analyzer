import { cn } from '@/lib/utils';

interface WebScoreLogoProps {
  className?: string;
  /** compact = icon only; default = icon + wordmark */
  compact?: boolean;
  /** size of the icon area in px, default 28 */
  size?: number;
}

export function WebScoreLogo({ className, compact = false, size = 28 }: WebScoreLogoProps) {
  const arc = size * 0.5;        // outer arc radius
  const mid = size * 0.375;      // mid arc radius
  const inn = size * 0.25;       // inner arc radius
  const cx = size * 0.43;        // pivot x
  const cy = size * 0.65;        // pivot y
  const dotR = size * 0.15;      // dot radius

  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      {/* Signal arc icon */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* outer arc */}
        <path
          d={`M ${cx} ${cy} A ${arc} ${arc} 0 0 1 ${cx + arc * Math.cos(-Math.PI / 4)} ${cy - arc * Math.sin(-Math.PI / 4)}`}
          stroke="#0ea5e9"
          strokeWidth={size * 0.11}
          strokeLinecap="round"
          opacity="0.35"
        />
        {/* mid arc */}
        <path
          d={`M ${cx} ${cy} A ${mid} ${mid} 0 0 1 ${cx + mid * Math.cos(-Math.PI / 4)} ${cy - mid * Math.sin(-Math.PI / 4)}`}
          stroke="#0ea5e9"
          strokeWidth={size * 0.11}
          strokeLinecap="round"
          opacity="0.65"
        />
        {/* inner arc */}
        <path
          d={`M ${cx} ${cy} A ${inn} ${inn} 0 0 1 ${cx + inn * Math.cos(-Math.PI / 4)} ${cy - inn * Math.sin(-Math.PI / 4)}`}
          stroke="#0ea5e9"
          strokeWidth={size * 0.11}
          strokeLinecap="round"
        />
        {/* dot */}
        <circle cx={cx} cy={cy} r={dotR} fill="#0ea5e9" />
      </svg>

      {!compact && (
        <span className="flex items-baseline gap-0 leading-none font-sans">
          <span className="font-light tracking-tight text-foreground">Web</span>
          <span className="font-bold tracking-tight text-sky-500">Score</span>
        </span>
      )}
    </span>
  );
}
