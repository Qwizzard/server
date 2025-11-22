import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  VerifyCallback,
  StrategyOptions,
  Profile,
} from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user.service';

interface GoogleEmail {
  value: string;
  verified: boolean;
}

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
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const { id, emails, displayName } = profile;
      const typedEmails = emails as GoogleEmail[] | undefined;

      if (!typedEmails || typedEmails.length === 0) {
        done(new Error('No email found in Google profile'), false);
        return;
      }

      const email = typedEmails[0].value;
      const username = displayName || email.split('@')[0];

      // Find or create user with account linking
      const user = await this.userService.findOrCreateGoogleUser({
        googleId: id,
        email,
        username,
      });

      done(null, user);
    } catch (error) {
      done(error as Error, false);
    }
  }
}
