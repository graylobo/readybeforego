export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role?: 'user' | 'admin';
  googleId?: string;
  kakaoId?: string;
  naverId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
