import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Website Analyzer — Automatic Site Analysis';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0F',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(234,88,12,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(234,88,12,0.2) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700,
            height: 400,
            background: 'radial-gradient(ellipse at center, rgba(234,88,12,0.2) 0%, transparent 70%)',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
            marginBottom: 28,
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: 16,
            textAlign: 'center',
            lineHeight: 1.1,
            padding: '0 80px',
          }}
        >
          Website Analyzer
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: 22,
            color: '#94a3b8',
            textAlign: 'center',
            lineHeight: 1.5,
            padding: '0 120px',
            marginBottom: 48,
          }}
        >
          Performance · Accessibility · SEO · AI Insights
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'Performance', color: '#10b981' },
            { label: 'Accessibility', color: '#6366f1' },
            { label: 'SEO', color: '#f59e0b' },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 100,
                padding: '10px 20px',
                fontSize: 16,
                color: '#e2e8f0',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
