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
          background: '#0f1e2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 22 22" fill="none">
          <path d="M9 17 A11 11 0 0 1 20 6" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" opacity="0.35"/>
          <path d="M9 17 A8 8 0 0 1 17 9" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" opacity="0.65"/>
          <path d="M9 17 A5 5 0 0 1 14 12" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round"/>
          <circle cx="9" cy="17" r="2.5" fill="#0ea5e9"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
