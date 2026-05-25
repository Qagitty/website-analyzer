import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {/* Bar chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ width: 22, height: 42, background: 'rgba(255,255,255,0.5)', borderRadius: 4 }} />
          <div style={{ width: 22, height: 66, background: 'rgba(255,255,255,0.75)', borderRadius: 4 }} />
          <div style={{ width: 22, height: 90, background: '#ffffff', borderRadius: 4 }} />
        </div>
        {/* Underline accent */}
        <div
          style={{
            width: 80,
            height: 6,
            background: 'rgba(255,255,255,0.6)',
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
