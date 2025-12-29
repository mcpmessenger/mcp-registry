"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { LayoutDashboard, MessageSquare, Settings } from "lucide-react"
import Image from "next/image"

const navItems = [
  {
    title: "Chat",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Registry",
    href: "/registry",
    icon: LayoutDashboard,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex h-14 sm:h-16 items-center px-3 sm:px-6 gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Image src="/logo.png" alt="Slash MCP" width={28} height={28} className="sm:w-8 sm:h-8" />
          <h1 className="text-base sm:text-lg font-semibold hidden sm:block">Slash MCP</h1>
        </div>
        <div className="flex-1 flex items-center gap-0.5 sm:gap-1 sm:ml-8 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon
            // Handle root path matching for chat (since / redirects to /chat)
            const isActive = pathname === item.href || (item.href === "/chat" && pathname === "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-muted whitespace-nowrap",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{item.title}</span>
              </Link>
            )
          })}
        </div>
        <div className="ml-auto shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
