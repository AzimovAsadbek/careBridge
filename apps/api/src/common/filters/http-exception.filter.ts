import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Log-safe description of an error. Prisma error messages embed the full query including
 * patient data, so only their class and code are logged; other messages are truncated.
 */
export function describeError(exception: unknown): string {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) return `Prisma ${exception.code}`;
  if (
    exception instanceof Prisma.PrismaClientValidationError ||
    exception instanceof Prisma.PrismaClientUnknownRequestError ||
    exception instanceof Prisma.PrismaClientRustPanicError ||
    exception instanceof Prisma.PrismaClientInitializationError
  ) {
    return exception.name;
  }
  const err = exception as Error | undefined;
  return `${err?.name ?? 'Error'}: ${String(err?.message ?? '').slice(0, 200)}`;
}

/** Uniform error body; never leaks stack traces or SQL to clients. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Resource already exists';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid request';
      }
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.route?.path ?? req.path} → ${describeError(exception)}`);
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
  }
}
