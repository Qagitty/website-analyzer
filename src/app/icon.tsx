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
          position: 'relative',
        }}
      >
        {/* Dot */}
        <div style={{
          position: 'absolute',
          left: 7,
          bottom: 7,
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#0ea5e9',
        }} />
        {/* Inner arc — border trick */}
        <div style={{
          position: 'absolute',
          left: 7,
          bottom: 7,
          width: 9,
          height: 9,
          borderRadius: '50%',
          borderLeft: '2px solid transparent',
          borderBottom: '2px solid transparent',
          borderTop: '2px solid #0ea5e9',
          borderRight: '2px solid #0ea5e9',
          transform: 'rotate(225deg)',
        }} />
        {/* Mid arc */}
        <div style={{
          position: 'absolute',
          left: 7,
          bottom: 7,
          width: 15,
          height: 15,
          borderRadius: '50%',
          borderLeft: '2px solid transparent',
          borderBottom: '2px solid transparent',
          borderTop: '2px solid rgba(14,165,233,0.65)',
          borderRight: '2px solid rgba(14,165,233,0.65)',
          transform: 'rotate(225deg)',
        }} />
        {/* Outer arc */}
        <div style={{
          position: 'absolute',
          left: 7,
          bottom: 7,
          width: 21,
          height: 21,
          borderRadius: '50%',
          borderLeft: '2px solid transparent',
          borderBottom: '2px solid transparent',
          borderTop: '2px solid rgba(14,165,233,0.35)',
          borderRight: '2px solid rgba(14,165,233,0.35)',
          transform: 'rotate(225deg)',
        }} />
      </div>
    ),
    { ...size }
  );
}
