import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { UsersModule } from '../users/users.module';
import { PointsModule } from '../points/points.module';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardRepository } from './dashboard/admin-dashboard.repository';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';

@Module({
  imports: [UsersModule, PointsModule],
  controllers: [AdminController, AdminDashboardController],
  providers: [AdminService, AdminRepository, AdminDashboardService, AdminDashboardRepository],
  exports: [AdminService, AdminRepository],
})
export class AdminModule {}
