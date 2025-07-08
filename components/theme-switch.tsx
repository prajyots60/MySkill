"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl bg-gradient-to-br from-background/90 via-card/80 to-background/70 backdrop-blur-xl border border-border/40 shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105 relative overflow-hidden group"
      >
        <span className="sr-only">Toggle theme</span>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-500 text-foreground/80 relative z-10" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-10 w-10 rounded-xl bg-gradient-to-br from-background/90 via-card/80 to-background/70 backdrop-blur-xl border border-border/40 shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105 relative overflow-hidden group"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <span className="sr-only">Toggle theme</span>

      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Icons with enhanced styling */}
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-700 dark:-rotate-90 dark:scale-0 text-foreground/80 group-hover:text-primary relative z-10 drop-shadow-sm" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-700 dark:rotate-0 dark:scale-100 text-foreground/80 group-hover:text-primary z-10 drop-shadow-sm" />

      {/* Glow effect for dark mode */}
      <div className="absolute inset-0 rounded-xl opacity-0 dark:opacity-20 bg-gradient-to-br from-primary/20 to-primary-accent/20 blur-xl transition-opacity duration-500" />
    </Button>
  );
}
