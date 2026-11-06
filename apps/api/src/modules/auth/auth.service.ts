import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LogsService } from '../logs/logs.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly logsService: LogsService,
  ) {}

  async validateGoogleUser(profile: any) {
    // In real app, normalize profile data G
    return this.usersService.createOrUpdate({
      email: profile.emails[0]?.value,
      name: profile.displayName,
      picture: profile.photos[0]?.value,
      googleId: profile.id,
    });
  }

  async validateKakaoUser(profile: any) {
    const { id, _json, displayName } = profile;
    // 이메일로 기존 계정을 찾아 연결하므로, 카카오가 인증·유효하다고 한 이메일만 쓴다
    // (이메일 동의항목을 켜야 오고, 사용자가 동의하지 않으면 없다)
    const account = _json?.kakao_account;
    const email =
      account?.is_email_valid && account?.is_email_verified
        ? account.email
        : undefined;
    const name = displayName || _json?.properties?.nickname || '카카오 사용자';
    const picture = _json?.properties?.profile_image || _json?.kakao_account?.profile?.profile_image_url;

    return this.usersService.createOrUpdate({
      email: email,
      name: name,
      picture: picture,
      kakaoId: id.toString(),
    });
  }

  async validateNaverUser(profile: any) {
    // passport-naver-v2 provides a flattened profile object
    const { id, email, name, nickname, profileImage } = profile;
    
    return this.usersService.createOrUpdate({
      email: email,
      name: name || nickname || '네이버 사용자',
      picture: profileImage,
      naverId: id,
    });
  }


  login(user: any, ip?: string, userAgent?: string) {
    const payload = { sub: user.id, email: user.email, name: user.name };
    
    // Asynchronous logging
    this.logsService.create({
      userId: user.id,
      type: 'LOGIN',
      action: '소셜 로그인을 통한 접속',
      ipAddress: ip,
      userAgent: userAgent,
    });

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async validateUser(payload: any) {
    return this.usersService.findById(payload.sub);
  }
}
