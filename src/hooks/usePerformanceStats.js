import { useState, useEffect } from 'react';
import { PerformanceObserver, performance } from 'perf_hooks';
import { Platform } from 'react-native';

export default function usePerformanceStatus() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTime;
      setFps(Math.round((frameCount * 1000) / delta));
      frameCount = 0;
      lastTime = now;
    }, 1000);

    const onFrame = () => {
      frameCount += 1;
      requestAnimationFrame(onFrame);
    };
    requestAnimationFrame(onFrame);

    return () => clearInterval(interval);
  }, []);

  return { fps };
}
