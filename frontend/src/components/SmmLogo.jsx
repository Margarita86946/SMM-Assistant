import React from 'react';

export default function SmmLogo({ size = 24, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(50,50)">
        <path
          d="M -8,-26 L -5,-34 5,-34 8,-26
             Q 14,-24 19,-19
             L 26,-8 34,-5 34,5 26,8
             Q 24,14 19,19
             L 8,26 5,34 -5,34 -8,26
             Q -14,24 -19,19
             L -26,8 -34,5 -34,-5 -26,-8
             Q -24,-14 -19,-19
             L -8,-26 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinejoin="round"
        />
      </g>
      <polyline
        points="32,65 42,48 50,54 62,36"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="53,33 62,36 59,45"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
