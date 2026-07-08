import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { AuthService } from '../auth.service';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const apiUrl =
      configService.get<string>('API_URL') || 'http://localhost:4000';

    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID') || 'mock_id',
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET') || 'mock_secret',
      callbackURL:
        configService.get<string>('KAKAO_CALLBACK_URL') ||
        `${apiUrl}/auth/kakao/callback`,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const user = await this.authService.validateKakaoUser(profile);
    done(null, user);
  }
}
