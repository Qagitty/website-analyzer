import { ImageResponse } from 'next/og';

export const runtime     = 'edge';
export const alt         = 'Pricing — WebAnalyzer';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TIERS = [
  { name: 'Free',        price: '$0',   color: '#94a3b8' },
  { name: 'Pro',         price: '$29',  color: '#818cf8' },
  { name: 'Agency',      price: '$99',  color: '#a78bfa' },
  { name: 'Compliance',  price: '$249', color: '#34d399' },
];

export default function PricingOgImage() {
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
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(234,88,12,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(234,88,12,0.2) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Glow */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 300, background: 'radial-gradient(ellipse at center, rgba(234,88,12,0.2) 0%, transparent 70%)' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#ffffff' }}>WebAnalyzer</span>
        </div>

        <div style={{ fontSize: 48, fontWeight: 800, color: '#ffffff', marginBottom: 12, letterSpacing: '-0.03em' }}>
          Simple, transparent pricing
        </div>
        <div style={{ fontSize: 20, color: '#94a3b8', marginBottom: 48 }}>
          No credit card required · Cancel anytime
        </div>

        {/* Tier pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {TIERS.map(({ name, price, color }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 24px', minWidth: 130 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color }}>{price}</span>
              <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
