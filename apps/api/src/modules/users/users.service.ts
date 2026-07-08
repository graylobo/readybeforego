import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { users } from '../../database/schema';
import { UploadsService } from '../uploads/uploads.service';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly uploadsService: UploadsService,
  ) {}

  async findAll(search?: string) {
    return this.usersRepo.findAll(search);
  }

  async findByName(name: string) {
    return this.usersRepo.findByName(name);
  }


  async createOrUpdate(data: Partial<typeof users.$inferInsert>) {
    // 1. Check if user exists by Social ID or Email
    const existingUser = await this.usersRepo.findBySocialOrEmail(data);

    if (existingUser) {
        // Update existing user
        const updateData: any = {
            ...data,
        };

        // PROTECT NICKNAME: If profile is already setup, don't let social provider data overwrite the user's chosen name
        if (existingUser.isProfileSetup && data.name) {
            delete updateData.name;
        }

        const updated = await this.usersRepo.updateUser(existingUser.id, updateData);
        return updated;
    } else {
        // Create new user
        // Ensure required fields
        if (!data.name) {
            throw new Error('Name is required for new user');
        }

        // Ensure name is unique
        let finalName = data.name;
        const nameExists = await this.usersRepo.findByName(finalName);
        if (nameExists) {
            // If collision, append random digits or counter
            const suffix = Math.floor(1000 + Math.random() * 9000);
            finalName = `${data.name}_${suffix}`;
            
            // Double check if generated name also exists (recursive/loop not needed for simple suffix usually, but safer)
            const secondCheck = await this.usersRepo.findByName(finalName);
            if (secondCheck) {
                finalName = `${data.name}_${Date.now().toString().slice(-4)}`;
            }
        }


        const created = await this.usersRepo.createUser({
            email: data.email,
            name: finalName,
            picture: data.picture,
            googleId: data.googleId,
            kakaoId: data.kakaoId,
            naverId: data.naverId,
        });
        return created;
    }
  }

  async findById(id: string) {
    return this.usersRepo.findById(id);
  }

  async getPublicProfile(id: string) {
    const user = await this.usersRepo.findPublicProfile(id);

    if (!user) return null;

    const points = await this.usersRepo.findUserPoints(id);
    const postCount = await this.usersRepo.countUserPosts(id);
    const visitDays = await this.usersRepo.countUserVisitDays(id);

    return {
      ...user,
      points,
      postCount,
      visitDays: visitDays || 1, // At least 1 day if they exist
    };
  }

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    if (data.picture) {
      const existingUser = await this.findById(id);
      if (existingUser && existingUser.picture && existingUser.picture !== data.picture) {
        // 기존 이미지가 우리 스토리지(profiles)에 저장된 이미지인 경우 삭제 처리
        const pathIndex = existingUser.picture.indexOf('profiles/');
        if (pathIndex !== -1) {
          const pathWithExtras = existingUser.picture.substring(pathIndex);
          const path = pathWithExtras.split(/[?#]/)[0];
          
          this.uploadsService.deleteImage(path).then(() => {
            this.logger.log(`Deleted orphan profile image: ${path}`);
          }).catch(err => {
            this.logger.error(`Failed to delete orphan profile image: ${path}`, err);
          });
        }
      }
    }

    if (data.name) {
        const nameExists = await this.findByName(data.name);
        if (nameExists && nameExists.id !== id) {
            throw new ConflictException('이미 사용 중인 닉네임입니다.');
        }
    }

    const updated = await this.usersRepo.updateUser(id, data);
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.usersRepo.deleteUser(id);
    return deleted;
  }
}
