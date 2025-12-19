import { cn } from "@/lib/utils"

type Status = "online" | "offline" | "warning"

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn("h-2 w-2 rounded-full", {
          "bg-success animate-pulse": status === "online",
          "bg-destructive": status === "offline",
          "bg-warning animate-pulse": status === "warning",
        })}
      />
      <span className="text-sm font-medium capitalize">{status}</span>
    </div>
  )
}
