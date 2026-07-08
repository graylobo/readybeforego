import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';

  protected throwThrottlerException(): Promise<void> {
    throw new ThrottlerException(this.errorMessage);
  }
}
