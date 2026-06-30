import { ImageResponse } from 'next/og';

export const runtime     = 'edge';
export const alt         = "What's New — WebAnalyzer";
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

const RELEASES = [
  { version: '2.1', title: 'Agency Lead Capture Widget' },
  { version: '2.0', title: 'Competitor Comparison & White-label PDF' },
  { version: '1.9', title: 'Compliance Platform' },
];

export default function ChangelogOgImage() {
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
          padding: '60px 80px',
        }}
      >
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(234,88,12,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(234,88,12,0.2) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 300, background: 'radial-gradient(ellipse at center, rgba(234,88,12,0.2) 0%, transparent 70%)' }} />

        {/* Logo + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>WebAnalyzer</span>
          <span style={{ fontSize: 14, color: '#6366f1', background: 'rgba(234,88,12,0.2)', padding: '3px 10px', borderRadius: 100, border: '1px solid rgba(234,88,12,0.3)' }}>Changelog</span>
        </div>

        <div style={{ fontSize: 48, fontWeight: 800, color: '#ffffff', marginBottom: 40, letterSpacing: '-0.03em', textAlign: 'center' }}>
          What&apos;s new in WebAnalyzer
        </div>

        {/* Recent releases */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 700 }}>
          {RELEASES.map(({ version, title }, i) => (
            <div key={version} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 20px', opacity: 1 - i * 0.15 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', background: 'rgba(234,88,12,0.2)', padding: '3px 10px', borderRadius: 6, minWidth: 36, textAlign: 'center' }}>v{version}</span>
              <span style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 500 }}>{title}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
