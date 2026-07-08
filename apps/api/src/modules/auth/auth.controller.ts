import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { PointsService } from '../points/points.service';
import type { User } from '@community/shared-types';
import * as Express from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly pointsService: PointsService,
  ) {}

  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(
    @Req() req: Express.Request,
    @Res() res: Express.Response,
  ) {
    this.handleOAuthCallback(req, res);
  }

  @Get('kakao')
  @ApiOperation({ summary: '카카오 로그인 시작' })
  @UseGuards(AuthGuard('kakao'))
  async kakaoAuth() {}

  @Get('kakao/callback')
  @ApiOperation({ summary: '카카오 로그인 콜백' })
  @UseGuards(AuthGuard('kakao'))
  kakaoAuthCallback(@Req() req: Express.Request, @Res() res: Express.Response) {
    this.handleOAuthCallback(req, res);
  }

  @Get('naver')
  @ApiOperation({ summary: '네이버 로그인 시작' })
  @UseGuards(AuthGuard('naver'))
  async naverAuth() {}

  @Get('naver/callback')
  @ApiOperation({ summary: '네이버 로그인 콜백' })
  @UseGuards(AuthGuard('naver'))
  naverAuthCallback(@Req() req: Express.Request, @Res() res: Express.Response) {
    this.handleOAuthCallback(req, res);
  }

  private handleOAuthCallback(req: any, res: Express.Response) {
    if (!req.user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=auth_failed`,
      );
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { access_token, user } = this.authService.login(req.user, ip as string, userAgent);
    
    // Set HttpOnly cookie
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Production(HTTPS)에서는 'none' 필요
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const userParam = encodeURIComponent(JSON.stringify(user));
    res.redirect(
      `${process.env.FRONTEND_URL}/login?user=${userParam}`,
    );
  }

  @Get('me')
  @ApiOperation({ summary: '내 정보 조회' })
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: any): Promise<User> {
    const userPoints = await this.pointsService.getMyPoints(req.user.id);
    
    return {
      ...req.user,
      accumulatedPoints: userPoints.accumulatedPoints,
      availablePoints: userPoints.availablePoints,
      level: userPoints.level,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: '로그아웃' })
  async logout(@Res() res: Express.Response) {
    res.clearCookie('access_token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    return res.status(200).json({ message: 'Logged out' });
  }
}
