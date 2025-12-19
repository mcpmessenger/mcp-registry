import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { env } from '../config/env'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

/**
 * Global error handler middleware
 * Provides MCP-compliant error responses
 */
export function errorMiddleware(
  error: AppError | ZodError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  console.error('Error:', {
    message: error.message,
    stack: env.server.nodeEnv === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
  })

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    })
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any
    if (prismaError.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Duplicate entry',
        message: 'A record with this value already exists',
      })
    }
    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Record not found',
        message: 'The requested resource does not exist',
      })
    }
  }

  // Handle custom AppError
  const statusCode = (error as AppError).statusCode || 500
  const message = error.message || 'Internal server error'

  // Don't expose internal errors in production
  const errorMessage =
    env.server.nodeEnv === 'production' && statusCode === 500
      ? 'Internal server error'
      : message

  res.status(statusCode).json({
    success: false,
    error: error.name || 'Error',
    message: errorMessage,
    ...(env.server.nodeEnv === 'development' && {
      stack: error.stack,
    }),
  })
}

/**
 * 404 Not Found handler
 */
export function notFoundMiddleware(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  })
}
