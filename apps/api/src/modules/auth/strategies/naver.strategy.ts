import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver-v2';
import { AuthService } from '../auth.service';

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const apiUrl =
      configService.get<string>('API_URL') || 'http://localhost:4000';

    super({
      clientID: configService.get<string>('NAVER_CLIENT_ID') || 'mock_id',
      clientSecret: configService.get<string>('NAVER_CLIENT_SECRET') || 'mock_secret',
      callbackURL:
        configService.get<string>('NAVER_CALLBACK_URL') ||
        `${apiUrl}/auth/naver/callback`,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const user = await this.authService.validateNaverUser(profile);
    done(null, user);
  }
}
