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
    <nav className="border-b border-border bg-card">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Slash MCP" width={32} height={32} />
          <h1 className="text-lg font-semibold">Slash MCP</h1>
        </div>
        <div className="ml-12 flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            // Handle root path matching for chat (since / redirects to /chat)
            const isActive = pathname === item.href || (item.href === "/chat" && pathname === "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
