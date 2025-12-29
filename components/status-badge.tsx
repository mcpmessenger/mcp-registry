import { cn } from "@/lib/utils"

type Status = "active" | "pre-integration" | "offline"

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn("h-2 w-2 rounded-full", {
          "bg-success animate-pulse": status === "active",
          "bg-warning": status === "pre-integration",
          "bg-destructive": status === "offline",
        })}
      />
      <span className="text-sm font-medium capitalize">
        {status === "pre-integration" ? "Pre-Integration" : status}
      </span>
    </div>
  )
}
