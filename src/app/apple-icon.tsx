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
          position: 'relative',
        }}
      >
        {/* Dot */}
        <div style={{
          position: 'absolute',
          left: 42,
          bottom: 42,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#0ea5e9',
        }} />
        {/* Inner arc */}
        <div style={{
          position: 'absolute',
          left: 42,
          bottom: 42,
          width: 50,
          height: 50,
          borderRadius: '50%',
          borderLeft: '7px solid transparent',
          borderBottom: '7px solid transparent',
          borderTop: '7px solid #0ea5e9',
          borderRight: '7px solid #0ea5e9',
          transform: 'rotate(225deg)',
        }} />
        {/* Mid arc */}
        <div style={{
          position: 'absolute',
          left: 42,
          bottom: 42,
          width: 82,
          height: 82,
          borderRadius: '50%',
          borderLeft: '7px solid transparent',
          borderBottom: '7px solid transparent',
          borderTop: '7px solid rgba(14,165,233,0.65)',
          borderRight: '7px solid rgba(14,165,233,0.65)',
          transform: 'rotate(225deg)',
        }} />
        {/* Outer arc */}
        <div style={{
          position: 'absolute',
          left: 42,
          bottom: 42,
          width: 114,
          height: 114,
          borderRadius: '50%',
          borderLeft: '7px solid transparent',
          borderBottom: '7px solid transparent',
          borderTop: '7px solid rgba(14,165,233,0.35)',
          borderRight: '7px solid rgba(14,165,233,0.35)',
          transform: 'rotate(225deg)',
        }} />
      </div>
    ),
    { ...size }
  );
}
