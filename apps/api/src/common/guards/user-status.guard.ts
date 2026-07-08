import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Not logged in, let other guards handle auth if needed
    }

    if (user.status === 'banned') {
      throw new ForbiddenException('정지된 계정입니다. 관리자에게 문의하세요.');
    }

    if (user.status === 'suspended') {
      if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
        const remainingDate = new Date(user.bannedUntil).toLocaleDateString();
        throw new ForbiddenException(`${remainingDate}까지 활동이 정지된 계정입니다.`);
      }
      // If suspension expired, we might want to automatically reactivate here,
      // but Guards should ideally be side-effect free.
      // For now, let's just allow it.
    }

    return true;
  }
}
