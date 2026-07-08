import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode, ApiResponse } from '@community/shared-types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      message = exceptionResponse.message || exception.message;
      errorCode = exceptionResponse.errorCode || exceptionResponse.code || this.mapStatusToErrorCode(status);

      // Validation error (Pipe)
      if (Array.isArray(exceptionResponse.message)) {
        message = exceptionResponse.message[0];
        errorCode = ErrorCode.INVALID_INPUT;
      }
    } else {
      // Unhandled error (hide internal details from client)
      message = '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    const errorResponse: ApiResponse<null> = {
      success: false,
      data: null,
      message,
      errorCode,
    };

    // 추가 정보 (디버깅용)
    const debugInfo = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
    };

    if (status >= 500) {
      const logMessage = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        `[${request.method}] ${request.url} - ${status} - ${logMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${status} - ${message}`);
    }

    response.status(status).json({
        ...errorResponse,
        ...debugInfo,
    });
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.INVALID_INPUT;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_REQUESTS;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }
}
