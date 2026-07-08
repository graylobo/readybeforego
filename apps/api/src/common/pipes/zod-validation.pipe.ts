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
      if (error.errors) {
        throw new BadRequestException({
          message: '입력값이 올바르지 않습니다.',
          error: error.errors.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
