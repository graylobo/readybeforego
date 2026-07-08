import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';
import { supabaseProvider } from './providers/supabase.provider';
import { UploadsCleanupService } from './services/uploads-cleanup.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    UploadsCleanupService,
    supabaseProvider,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (configService: ConfigService, supabaseProvider: any) => {
        const storageType = configService.get<string>('STORAGE_TYPE') || 'local';
        
        if (storageType === 'supabase') {
          if (!supabaseProvider) {
            throw new Error(
              'SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured when STORAGE_TYPE is set to "supabase"',
            );
          }
          return new SupabaseStorageProvider(supabaseProvider, configService);
        }
        
        if (storageType === 'local') {
          return new LocalStorageProvider(configService);
        }
        
        return new LocalStorageProvider(configService);
      },
      inject: [ConfigService, 'SUPABASE_CLIENT'],
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
