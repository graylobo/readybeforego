import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UploadsModule } from '../modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    UploadsModule,
  ],
})
export class UploadsTempCleanupJobModule {}
