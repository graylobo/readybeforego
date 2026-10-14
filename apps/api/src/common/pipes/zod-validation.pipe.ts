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
      // zod v4는 오류 목록이 issues에 있다 (v3의 errors는 없어져, 예전에는 구체적인 이유 없이 'Validation failed'만 갔다)
      const issues: any[] | undefined = error?.issues ?? error?.errors;
      if (Array.isArray(issues) && issues.length > 0) {
        const firstIssue = issues[0];
        let message = firstIssue.message || '입력값이 올바르지 않습니다.';
        // 스키마에 한국어 문구가 없어 zod 기본 문구가 나오면, 어느 항목이 문제인지 알려준다
        if (message === 'Invalid input' || message === 'Required') {
          message = firstIssue.path?.length
            ? `입력 항목(${firstIssue.path.join('.')})의 값이 올바르지 않습니다.`
            : '입력 필수 항목의 값을 확인해 주세요.';
        }
        throw new BadRequestException({
          // 화면 알림에 그대로 보이도록 첫 번째 이유를 메시지로 (스키마에 적은 한국어 문구)
          message,
          error: issues.map((e: any) => ({
            path: (e.path ?? []).join('.'),
            message: e.message,
          })),
        });
      }
      throw new BadRequestException('입력값이 올바르지 않습니다.');
    }
  }
}
