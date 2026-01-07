import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/user.module';
import { PostsModule } from './posts/posts.module';
import { DeliveryModule } from './delivery/delivery.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGO_URL');
        if (!uri) {
          throw new Error('MONGO_URL is not set');
        }
        return { uri };
      },
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
    PostsModule,
    DeliveryModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
