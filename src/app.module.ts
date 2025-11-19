import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OpenAIModule } from './openai/openai.module';
import { QuizModule } from './quiz/quiz.module';
import { AttemptModule } from './attempt/attempt.module';
import { ResultModule } from './result/result.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
    }),
    AuthModule,
    OpenAIModule,
    QuizModule,
    AttemptModule,
    ResultModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
