'use client';

import { useEffect, useState } from 'react';

export function SnowfallEffect() {
  const [snowflakes, setSnowflakes] = useState<JSX.Element[]>([]);

  useEffect(() => {
    const flakes: JSX.Element[] = [];
    const numFlakes = 40; // Reduced for more elegant effect

    for (let i = 0; i < numFlakes; i++) {
      const left = Math.random() * 100;
      const animationDuration = 15 + Math.random() * 25; // Slower, more graceful fall
      const animationDelay = Math.random() * 15;
      const fontSize = 0.7 + Math.random() * 1.2; // Slightly smaller
      const opacity = 0.25 + Math.random() * 0.45; // More subtle

      flakes.push(
        <div
          key={i}
          className="snowflake"
          style={{
            left: `${left}%`,
            animationDuration: `${animationDuration}s`,
            animationDelay: `${animationDelay}s`,
            fontSize: `${fontSize}rem`,
            opacity: opacity,
          }}
          aria-hidden="true"
        >
          ❄
        </div>
      );
    }

    setSnowflakes(flakes);
  }, []);

  return <>{snowflakes}</>;
}
