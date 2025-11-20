import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to not throw an error if no token is provided
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _info: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _status?: unknown,
  ): TUser {
    // If there's an error or no user, just return null instead of throwing
    if (err || !user) {
      return null as TUser;
    }
    return user;
  }

  // Override canActivate to always return true
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // If authentication fails, continue anyway (user will be null)
    }
    return true;
  }
}
