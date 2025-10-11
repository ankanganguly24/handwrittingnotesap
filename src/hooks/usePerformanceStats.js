import { useState, useEffect, useRef } from 'react';

export default function usePerformanceStats() {
  const [fps, setFps] = useState(60);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    let animationFrameId;
    
    const measurePerformance = () => {
      const now = Date.now();
      frameCountRef.current += 1;
      
      // Calculate FPS every second
      if (now - lastTimeRef.current >= 1000) {
        const delta = now - lastTimeRef.current;
        const currentFps = Math.round((frameCountRef.current * 1000) / delta);
        setFps(currentFps);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
        
        // Simulate memory usage (in MB)
        const simulatedMemory = 50 + Math.random() * 20;
        setMemoryUsage(simulatedMemory);
        
        // Simulate render time (in ms)
        const simulatedRenderTime = 8 + Math.random() * 8;
        setRenderTime(simulatedRenderTime);
      }
      
      animationFrameId = requestAnimationFrame(measurePerformance);
    };
    
    measurePerformance();
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return { 
    fps, 
    memoryUsage: Math.round(memoryUsage), 
    renderTime: Math.round(renderTime * 10) / 10 
  };
}
