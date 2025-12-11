'use client';

import { useEffect, useState } from 'react';

export function SnowfallEffect() {
  const [snowflakes, setSnowflakes] = useState<JSX.Element[]>([]);

  useEffect(() => {
    const flakes: JSX.Element[] = [];
    const numFlakes = 50;

    for (let i = 0; i < numFlakes; i++) {
      const left = Math.random() * 100;
      const animationDuration = 10 + Math.random() * 20; // 10-30 seconds
      const animationDelay = Math.random() * 10; // 0-10 seconds
      const fontSize = 0.8 + Math.random() * 1.5; // 0.8-2.3rem
      const opacity = 0.3 + Math.random() * 0.7; // 0.3-1.0

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
