import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../database/database.module';
import { ScamsModule } from '../modules/scams/scams.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    ScamsModule,
  ],
})
export class ScamsPurgeDeletedJobModule {}
