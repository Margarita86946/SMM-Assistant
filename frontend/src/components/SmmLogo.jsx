import React from 'react';

export default function SmmLogo({ size = 24, className = '' }) {
  return (
    <img
      src="/favicon.svg"
      alt="SMM Assistant"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ display: 'block' }}
    />
  );
}
