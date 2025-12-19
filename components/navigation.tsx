"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { LayoutDashboard, MessageSquare, Settings } from "lucide-react"
import Image from "next/image"

const navItems = [
  {
    title: "Registry",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Chat",
    href: "/chat",
    icon: MessageSquare,
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
    <nav className="border-b border-border bg-card sticky top-0 z-50 w-full">
      <div className="flex h-16 items-center px-6 gap-4 max-w-full">
        <div className="flex items-center gap-3 shrink-0 min-w-0 max-w-[200px]">
          <Image src="/logo.png" alt="MCP Registry" width={32} height={32} className="shrink-0" />
          <h1 className="text-lg font-semibold whitespace-nowrap hidden sm:block truncate">MCP Registry</h1>
        </div>
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted shrink-0",
                  pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{item.title}</span>
              </Link>
            )
          })}
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
