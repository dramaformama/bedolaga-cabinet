import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router';
import { UseMutationResult } from '@tanstack/react-query';
import DaysProgressBar from './DaysProgressBar';
import { useTheme } from '../../hooks/useTheme';
import { useTrafficZone } from '../../hooks/useTrafficZone';
import { formatTraffic } from '../../utils/formatTraffic';
import { getGlassColors } from '../../utils/glassTheme';
import { HoverBorderGradient } from '../ui/hover-border-gradient';
import { useHaptic } from '../../platform';
import type { Subscription } from '../../types';

interface SubscriptionCardActiveProps {
  subscription: Subscription;
  trafficData: {
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null;
  refreshTrafficMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trafficRefreshCooldown: number;
  connectedDevices: number;
}

const RefreshIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

export default function SubscriptionCardActive({
  subscription,
  trafficData,
  refreshTrafficMutation,
  trafficRefreshCooldown,
  connectedDevices,
}: SubscriptionCardActiveProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  const usedPercent = trafficData?.traffic_used_percent ?? subscription.traffic_used_percent;
  const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
  const isUnlimited = trafficData?.is_unlimited ?? subscription.traffic_limit_gb === 0;
  const zone = useTrafficZone(usedPercent);
  const haptic = useHaptic();

  const daysLeft = subscription.days_left;
  const isAtDeviceLimit =
    subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;

  const formattedEndDate = new Date(subscription.end_date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const daysColor =
    daysLeft <= 3
      ? 'rgb(var(--color-error-400))'
      : daysLeft <= 7
        ? 'rgb(var(--color-warning-400))'
        : 'rgb(var(--color-accent-400))';

  // Compact traffic bar fill gradient (always accent → zone)
  const trafficFill =
    usedPercent < 75
      ? `linear-gradient(90deg, rgb(var(--color-accent-400)), ${zone.mainVar})`
      : `linear-gradient(90deg, rgb(var(--color-accent-400)), rgb(var(--color-warning-400)), ${zone.mainVar})`;

  return (
    <div
      className="relative overflow-hidden rounded-3xl backdrop-blur-xl"
      style={{
        background: g.cardBg,
        border: subscription.is_trial
          ? '1px solid rgba(var(--color-accent-400), 0.15)'
          : `1px solid ${g.cardBorder}`,
        padding: '24px 24px 20px',
        boxShadow: g.shadow,
      }}
    >
      {/* Trial shimmer border */}
      {subscription.is_trial && (
        <div
          className="pointer-events-none absolute inset-[-1px] animate-trial-glow rounded-3xl"
          aria-hidden="true"
        />
      )}

      {/* Background glow */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: -60,
          right: -60,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(var(--color-accent-400), ${isDark ? '0.07' : '0.03'}) 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* ─── Header: status + tariff name ─── */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: 'rgb(var(--color-accent-400))',
              boxShadow: '0 0 8px rgba(var(--color-accent-400), 0.6)',
            }}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-dark-50">
            {subscription.tariff_name || t('subscription.currentPlan')}
          </span>
          {subscription.is_trial && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
              style={{
                background: 'rgba(var(--color-accent-400), 0.1)',
                border: '1px solid rgba(var(--color-accent-400), 0.2)',
                color: 'rgb(var(--color-accent-400))',
              }}
            >
              {t('subscription.trialStatus')}
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-dark-50/30">
          {t('dashboard.active', 'Активна')}
        </span>
      </div>

      {/* ─── Days remaining (PRIMARY) ─── */}
      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-50/35">
            {t('dashboard.remaining')}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="text-[32px] font-extrabold leading-none tracking-tight transition-colors duration-300"
              style={{ color: daysColor }}
            >
              {daysLeft}
            </span>
            <span className="text-sm font-medium text-dark-50/30">
              {t('subscription.daysShort')}
            </span>
          </div>
        </div>

        <DaysProgressBar
          daysLeft={daysLeft}
          startDate={subscription.start_date}
          endDate={subscription.end_date}
        />

        <div className="mt-1.5 text-right font-mono text-[10px] text-dark-50/25">
          {t('dashboard.validUntil', { date: formattedEndDate })}
        </div>
      </div>

      {/* ─── Traffic (SECONDARY — compact) ─── */}
      {!isUnlimited ? (
        <div
          className="mb-4 rounded-[12px] px-3.5 py-3"
          style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-50/30">
              {t('subscription.traffic')}
            </span>
            <span className="font-mono text-[11px]" style={{ color: zone.mainVar }}>
              {usedPercent.toFixed(0)}%
            </span>
          </div>
          {/* Mini traffic bar */}
          <div
            className="relative mb-1.5 overflow-hidden"
            style={{ height: 4, borderRadius: 4, background: g.trackBg }}
          >
            <div
              className="absolute bottom-0 left-0 top-0"
              style={{
                width: `${Math.min(usedPercent, 100)}%`,
                borderRadius: 4,
                background: trafficFill,
                transition: 'width 1s ease',
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-dark-50/30">
              {formatTraffic(usedGb)} {t('dashboard.usedSuffix')}
            </span>
            <span className="font-mono text-[10px] text-dark-50/20">
              / {formatTraffic(subscription.traffic_limit_gb)}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="mb-4 flex items-center justify-between rounded-[12px] px-3.5 py-2.5"
          style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-50/30">
            {t('subscription.traffic')}
          </span>
          <span className="text-sm font-bold" style={{ color: 'rgb(var(--color-accent-400))' }}>
            ∞ {t('dashboard.unlimited')}
          </span>
        </div>
      )}

      {/* ─── Connect Device Button ─── */}
      {subscription.subscription_url && (
        <HoverBorderGradient
          as="button"
          accentColor={zone.mainHex}
          disabled={isAtDeviceLimit}
          onClick={() => {
            if (isAtDeviceLimit) {
              haptic.notification('error');
              return;
            }
            navigate(`/connection?sub=${subscription.id}`);
          }}
          className={`mb-3 flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left transition-shadow duration-300 ${isAtDeviceLimit ? 'cursor-not-allowed opacity-50' : ''}`}
          data-onboarding="connect-devices"
          style={{ fontFamily: 'inherit' }}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: `rgba(var(--color-accent-400), 0.07)` }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgb(var(--color-accent-400))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M12 17v4M8 21h8" />
              <path d="M12 8v4M10 10h4" opacity="0.7" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-tight text-dark-50">
              {t('dashboard.connectDevice')}
            </div>
            <div className="mt-0.5 text-[11px] text-dark-50/30">
              {subscription.device_limit === 0
                ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
                : t('dashboard.devicesOfMax', {
                    used: connectedDevices,
                    max: subscription.device_limit,
                  })}
            </div>
            {isAtDeviceLimit && (
              <div
                className="mt-0.5 text-[10px] font-medium"
                style={{ color: 'rgb(var(--color-warning-400))' }}
              >
                {t('dashboard.deviceLimitReached')}
              </div>
            )}
          </div>

          {/* Device dots indicator */}
          {subscription.device_limit > 0 && subscription.device_limit <= 10 && (
            <div className="flex flex-shrink-0 gap-1" aria-hidden="true">
              {Array.from({ length: subscription.device_limit }, (_, i) => (
                <div
                  key={i}
                  className="h-[6px] w-[6px] rounded-full transition-all duration-300"
                  style={{
                    background: i < connectedDevices ? 'rgb(var(--color-accent-400))' : g.textGhost,
                    boxShadow:
                      i < connectedDevices ? '0 0 5px rgba(var(--color-accent-400), 0.4)' : 'none',
                  }}
                />
              ))}
            </div>
          )}
          {subscription.device_limit === 0 && (
            <span className="flex-shrink-0 text-base text-dark-50/30" aria-hidden="true">
              ∞
            </span>
          )}
        </HoverBorderGradient>
      )}

      {/* ─── Footer: refresh + view link ─── */}
      <div className="flex items-center justify-between px-0.5">
        <button
          type="button"
          onClick={() => refreshTrafficMutation.mutate()}
          disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
          aria-label={t('common.refresh')}
          aria-busy={refreshTrafficMutation.isPending}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-dark-50/30 transition-colors hover:bg-dark-50/[0.05] hover:text-dark-50/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshIcon
            className={`h-3 w-3 ${refreshTrafficMutation.isPending ? 'animate-spin' : ''}`}
          />
          {trafficRefreshCooldown > 0 ? `${trafficRefreshCooldown}s` : t('common.refresh')}
        </button>
        <Link
          to={`/subscriptions/${subscription.id}`}
          className="text-[11px] font-medium text-dark-50/25 transition-colors hover:text-dark-50/40"
        >
          {t('dashboard.viewSubscription')} &rarr;
        </Link>
      </div>
    </div>
  );
}
