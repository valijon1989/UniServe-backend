import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgentsModule } from './agents/agents.module';
import { ServicesModule } from './services/services.module';
import { ListingsModule } from './listings/listings.module';
import { FeedModule } from './feed/feed.module';
import { AdminModule } from './admin/admin.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URL'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    AgentsModule,
    ServicesModule,
    ListingsModule,
    FeedModule,
    AdminModule,
    UploadsModule,
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
