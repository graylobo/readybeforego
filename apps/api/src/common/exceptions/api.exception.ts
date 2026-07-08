import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '@community/shared-types';

export class ApiException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    message?: string,
  ) {
    const finalMessage = message || ErrorMessages[errorCode] || errorCode;
    super(
      {
        message: finalMessage,
        errorCode,
      },
      status,
    );
  }
}
