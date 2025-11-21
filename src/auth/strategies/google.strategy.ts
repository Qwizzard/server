import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      clientID: configService.get<string>('google.clientId'),
      clientSecret: configService.get<string>('google.clientSecret'),
      callbackURL: configService.get<string>('google.callbackURL'),
      scope: ['email', 'profile'],
    } as StrategyOptions);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, emails, displayName } = profile;

      if (!emails || emails.length === 0) {
        return done(new Error('No email found in Google profile'), false);
      }

      const email = emails[0].value;

      // Find or create user with account linking
      const user = await this.userService.findOrCreateGoogleUser({
        googleId: id,
        email,
        username: displayName || email.split('@')[0],
      });

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}

