import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: any) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      if (metadata.type !== 'body') {
        return value;
      }

      // Handle ZodDto classes from @anatine/zod-nestjs
      const zodSchema = this.schema.zodSchema || this.schema;
      
      if (!zodSchema || typeof zodSchema.parse !== 'function') {
          return value;
      }

      const parsedValue = zodSchema.parse(value);
      return parsedValue;
    } catch (error: any) {
      console.error('ZodValidationPipe Error:', error);
      const issues = error.issues || error.errors;
      if (issues && Array.isArray(issues) && issues.length > 0) {
        const firstIssue = issues[0];
        let detailMessage = firstIssue.message;
        if (detailMessage === 'Invalid input' || detailMessage === 'Required') {
          if (firstIssue.path && firstIssue.path.length > 0) {
            const fieldName = firstIssue.path.join('.');
            detailMessage = `입력 항목(${fieldName})의 값이 올바르지 않습니다.`;
          } else {
            detailMessage = '입력 필수 항목의 값을 확인해 주세요.';
          }
        }
        throw new BadRequestException({
          message: detailMessage,
          errors: issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw new BadRequestException('입력 정보 검증에 실패했습니다. 각 항목의 입력값을 확인해 주세요.');
    }
  }
}
