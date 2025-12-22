/**
 * Trust Scoring Engine Service
 * 
 * Provides security scoring for registered MCP servers by:
 * 1. Running npm audit on server source code (if available)
 * 2. LLM-based code scanning for security issues
 * 3. Analyzing dependencies and configurations
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '../config/database'
import type { McpServer } from '@prisma/client'

const execAsync = promisify(exec)

export interface SecurityScanResult {
  score: number // 0-100, higher is better
  npmAudit?: {
    vulnerabilities: number
    critical: number
    high: number
    moderate: number
    low: number
    summary: string
  }
  codeAnalysis?: {
    issues: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low'
      type: string
      description: string
      location?: string
    }>
    summary: string
  }
  dependencies?: {
    total: number
    outdated: number
    insecure: number
  }
  timestamp: Date
  error?: string
}

export class TrustScoringService {
  /**
   * Run security scan on a server and update its security score
   */
  async scanServer(serverId: string): Promise<SecurityScanResult> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })
    
    if (!server) {
      throw new Error(`Server not found: ${serverId}`)
    }
    
    console.log(`🔒 Running security scan for server: ${serverId}`)
    
    const result: SecurityScanResult = {
      score: 100, // Start with perfect score, deduct for issues
      timestamp: new Date(),
    }
    
    try {
      // Extract source code location from metadata
      const metadata = server.metadata ? JSON.parse(server.metadata) : {}
      const sourceUrl = metadata.sourceUrl || metadata.repository || metadata.endpoint
      
      if (sourceUrl) {
        // Try to run npm audit if package.json is available
        const npmAuditResult = await this.runNpmAudit(sourceUrl)
        if (npmAuditResult) {
          result.npmAudit = npmAuditResult
          
          // Deduct points based on vulnerabilities
          const criticalPenalty = npmAuditResult.critical * 10
          const highPenalty = npmAuditResult.high * 5
          const moderatePenalty = npmAuditResult.moderate * 2
          const lowPenalty = npmAuditResult.low * 1
          
          result.score = Math.max(0, result.score - criticalPenalty - highPenalty - moderatePenalty - lowPenalty)
        }
        
        // Run LLM-based code analysis (placeholder for now)
        const codeAnalysis = await this.runCodeAnalysis(sourceUrl, server)
        if (codeAnalysis) {
          result.codeAnalysis = codeAnalysis
          
          // Deduct points for code issues
          const criticalIssues = codeAnalysis.issues.filter(i => i.severity === 'critical').length
          const highIssues = codeAnalysis.issues.filter(i => i.severity === 'high').length
          const mediumIssues = codeAnalysis.issues.filter(i => i.severity === 'medium').length
          
          result.score = Math.max(0, result.score - (criticalIssues * 5) - (highIssues * 2) - (mediumIssues * 1))
        }
      } else {
        // No source code available - apply penalty
        result.score = 50 // Default score when source is not available
        result.error = 'Source code URL not available for scanning'
      }
      
      // Update server with security score
      await prisma.mcpServer.update({
        where: { serverId },
        data: {
          securityScore: Math.round(result.score),
          lastSecurityScan: new Date(),
          securityScanResults: JSON.stringify(result),
        },
      })
      
      console.log(`✅ Security scan completed for ${serverId}: Score ${Math.round(result.score)}/100`)
      
      return result
    } catch (error: any) {
      console.error(`❌ Error scanning server ${serverId}:`, error)
      result.score = 0
      result.error = error.message || 'Security scan failed'
      
      // Still update the server with the error
      await prisma.mcpServer.update({
        where: { serverId },
        data: {
          securityScore: 0,
          lastSecurityScan: new Date(),
          securityScanResults: JSON.stringify(result),
        },
      })
      
      return result
    }
  }
  
  /**
   * Run npm audit on a package (if source code is available)
   */
  private async runNpmAudit(sourceUrl: string): Promise<SecurityScanResult['npmAudit'] | null> {
    try {
      // TODO: Clone repository or download package.json
      // For now, this is a placeholder that simulates npm audit
      
      // In production, you would:
      // 1. Clone the repository from sourceUrl
      // 2. Run `npm audit --json` in the repository directory
      // 3. Parse the results
      
      console.log('⚠️  npm audit is a placeholder - implement repository cloning for production')
      
      // Simulated result for demonstration
      return {
        vulnerabilities: 0,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        summary: 'npm audit not yet implemented - requires repository access',
      }
    } catch (error) {
      console.error('❌ Error running npm audit:', error)
      return null
    }
  }
  
  /**
   * Run LLM-based code analysis
   */
  private async runCodeAnalysis(
    sourceUrl: string,
    server: McpServer
  ): Promise<SecurityScanResult['codeAnalysis'] | null> {
    try {
      // TODO: Implement LLM-based code scanning
      // This would:
      // 1. Fetch source code from repository
      // 2. Use an LLM (e.g., Gemini, Claude) to analyze code for:
      //    - Security vulnerabilities
      //    - Best practices
      //    - Dependency issues
      //    - Configuration problems
      
      console.log('⚠️  LLM code analysis is a placeholder - implement for production')
      
      // For now, return a basic analysis based on server metadata
      const issues: Array<{
        severity: 'critical' | 'high' | 'medium' | 'low'
        type: string
        description: string
        location?: string
      }> = []
      
      // Check for common issues in metadata
      try {
        const env = server.env ? JSON.parse(server.env) : {}
        if (typeof env === 'object' && env !== null) {
          const envKeys = Object.keys(env)
          if (envKeys.some(key => key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD'))) {
            issues.push({
              severity: 'high',
              type: 'exposed-credentials',
              description: 'Sensitive environment variables detected in configuration',
            })
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
      
      if (!server.identityVerified) {
        issues.push({
          severity: 'medium',
          type: 'unverified-identity',
          description: 'Server identity not verified via SEP-1302',
        })
      }
      
      return {
        issues,
        summary: issues.length === 0 
          ? 'No security issues detected' 
          : `Found ${issues.length} potential security issue(s)`,
      }
    } catch (error) {
      console.error('❌ Error running code analysis:', error)
      return null
    }
  }
  
  /**
   * Scan all active servers in the registry
   */
  async scanAllServers(): Promise<void> {
    const servers = await prisma.mcpServer.findMany({
      where: { isActive: true },
    })
    
    console.log(`🔒 Starting security scan for ${servers.length} servers...`)
    
    for (const server of servers) {
      try {
        await this.scanServer(server.serverId)
        // Add delay between scans to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`❌ Failed to scan server ${server.serverId}:`, error)
      }
    }
    
    console.log('✅ Security scan completed for all servers')
  }
}

export const trustScoringService = new TrustScoringService()

