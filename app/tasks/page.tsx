"use client"

import { useState, useEffect } from "react"
import { getTasks, getSecurityScores } from "@/lib/api"
import type { DurableTask, SecurityScore } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, Shield, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function TasksPage() {
  const [tasks, setTasks] = useState<DurableTask[]>([])
  const [securityScores, setSecurityScores] = useState<SecurityScore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const { toast } = useToast()

  const fetchTasks = async () => {
    try {
      setIsLoading(true)
      const filters: any = {}
      if (statusFilter !== "all") {
        filters.status = statusFilter
      }
      const response = await getTasks(filters)
      setTasks(response.tasks)
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast({
        title: "Error loading tasks",
        description: error instanceof Error ? error.message : "Failed to fetch tasks",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSecurityScores = async () => {
    try {
      const response = await getSecurityScores()
      setSecurityScores(response.servers)
    } catch (error) {
      console.error("Error fetching security scores:", error)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchSecurityScores()
  }, [statusFilter])

  // Auto-refresh every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchTasks()
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh, statusFilter])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "PROCESSING":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>
      case "PROCESSING":
        return <Badge variant="default" className="bg-blue-500">Processing</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const getSecurityScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground"
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  const statusCounts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "PENDING").length,
    processing: tasks.filter((t) => t.status === "PROCESSING").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    failed: tasks.filter((t) => t.status === "FAILED").length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor durable requests and long-running operations across MCP servers (SEP-1686)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
            Auto-refresh
          </Button>
          <Button variant="outline" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.all}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{statusCounts.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{statusCounts.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{statusCounts.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Security Scores Summary */}
      {securityScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Scores Overview
            </CardTitle>
            <CardDescription>Trust scores for registered MCP servers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {securityScores.slice(0, 6).map((server) => (
                <div key={server.serverId} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{server.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{server.serverId}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {server.securityScore !== null ? (
                      <span className={`font-bold ${getSecurityScoreColor(server.securityScore)}`}>
                        {server.securityScore}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                    {server.identityVerified && (
                      <Badge variant="outline" className="text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tasks found matching your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(task.status)}
                      <CardTitle className="text-lg">{task.description || task.taskId}</CardTitle>
                      {getStatusBadge(task.status)}
                    </div>
                    <CardDescription>
                      {task.server?.name || task.serverId} • {task.taskType || "Unknown type"}
                    </CardDescription>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(task.createdAt).toLocaleString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-muted-foreground">{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>
                  {task.progressMessage && (
                    <p className="text-sm text-muted-foreground">{task.progressMessage}</p>
                  )}
                  {task.errorMessage && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                      <p className="text-sm text-destructive font-medium">Error:</p>
                      <p className="text-sm text-destructive/80">{task.errorMessage}</p>
                    </div>
                  )}
                  {task.output && (
                    <div className="p-3 bg-muted rounded">
                      <p className="text-sm font-medium mb-1">Output:</p>
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(task.output, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Task ID: {task.taskId}</span>
                    {task.completedAt && (
                      <span>• Completed: {new Date(task.completedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

