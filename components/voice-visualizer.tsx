"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface VoiceVisualizerProps {
  isActive: boolean
  className?: string
}

export function VoiceVisualizer({ isActive, className }: VoiceVisualizerProps) {
  const [bars, setBars] = useState(Array(12).fill(0))

  useEffect(() => {
    if (!isActive) {
      setBars(Array(12).fill(0))
      return
    }

    const interval = setInterval(() => {
      setBars(
        Array(12)
          .fill(0)
          .map(() => Math.random()),
      )
    }, 100)

    return () => clearInterval(interval)
  }, [isActive])

  return (
    <div className={cn("flex items-center justify-center gap-1 h-16", className)}>
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1 bg-destructive rounded-full transition-all duration-100"
          style={{
            height: `${isActive ? Math.max(height * 100, 10) : 4}%`,
          }}
        />
      ))}
    </div>
  )
}
