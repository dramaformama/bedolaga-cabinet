import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';

interface DaysProgressBarProps {
  daysLeft: number;
  startDate: string;
  endDate: string;
}

export default function DaysProgressBar({ daysLeft, startDate, endDate }: DaysProgressBarProps) {
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  const totalDays = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000),
  );
  const fillPercent = Math.max(0, Math.min(100, (daysLeft / totalDays) * 100));

  const colorVar =
    daysLeft <= 3
      ? 'var(--color-error-400)'
      : daysLeft <= 7
        ? 'var(--color-warning-400)'
        : 'var(--color-accent-400)';
  const color = `rgb(${colorVar})`;
  const colorRaw = colorVar;

  return (
    <div role="progressbar" aria-valuenow={daysLeft} aria-valuemin={0} aria-valuemax={totalDays}>
      <div
        className="relative overflow-hidden"
        style={{
          height: 10,
          borderRadius: 8,
          background: g.trackBg,
          border: `1px solid ${g.trackBorder}`,
        }}
      >
        <div
          className="absolute bottom-0 left-0 top-0 overflow-hidden"
          style={{
            width: `${fillPercent}%`,
            borderRadius: 8,
            transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: color, transition: 'background 0.6s ease' }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
            }}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 right-0 top-0"
            style={{
              height: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
              borderRadius: '8px 8px 0 0',
            }}
            aria-hidden="true"
          />
        </div>

        {fillPercent > 2 && (
          <div
            className="pointer-events-none absolute"
            style={{
              top: -4,
              bottom: -4,
              left: `calc(${fillPercent}% - 8px)`,
              width: 16,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${colorRaw}, 0.4), transparent)`,
              filter: 'blur(4px)',
              transition: 'left 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
