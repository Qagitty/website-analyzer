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
          borderRadius: 7,
          background: '#0f1e2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          {/* outer arc */}
          <path d="M9 17 A11 11 0 0 1 20 6" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" opacity="0.35"/>
          {/* mid arc */}
          <path d="M9 17 A8 8 0 0 1 17 9" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" opacity="0.65"/>
          {/* inner arc */}
          <path d="M9 17 A5 5 0 0 1 14 12" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round"/>
          {/* dot */}
          <circle cx="9" cy="17" r="2.5" fill="#0ea5e9"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
