import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {/* Bar chart — 3 bars of increasing height */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ width: 4, height: 7, background: 'rgba(255,255,255,0.55)', borderRadius: 1 }} />
          <div style={{ width: 4, height: 11, background: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
          <div style={{ width: 4, height: 15, background: '#ffffff', borderRadius: 1 }} />
        </div>
        {/* Magnifying glass arc (simplified as a small circle ring + handle) */}
        <div
          style={{
            width: 8,
            height: 2,
            background: 'rgba(255,255,255,0.7)',
            borderRadius: 1,
            marginTop: 1,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
