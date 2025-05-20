"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

// Dynamically import the ParticleBackground component with SSR disabled
const ParticleBackground = dynamic(
  () => import('@/components/particle-background').then(mod => mod.ParticleBackground),
  { ssr: false }
);

interface ParticleProps {
  color?: string;
  quantity?: number;
  speed?: number;
  className?: string;
}

export function ClientParticleWrapper({
  color = "#6366f1",
  quantity = 50,
  speed = 1,
  className
}: ParticleProps) {
  const { theme } = useTheme();
  
  // Use a lighter color for particles in light mode
  const particleColor = theme === "light" ? "#4f46e5" : color;
  
  return (
    <ParticleBackground 
      color={particleColor} 
      quantity={quantity} 
      speed={speed} 
      className={className} 
    />
  );
}
