import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.userService.create(registerDto);

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (local auth)
    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses Google Sign-In. Please login with Google.',
      );
    }

    const isPasswordValid = await this.userService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
      },
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Record<string, unknown> | null> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return null;
    }

    // Check if user has a password
    if (!user.password) {
      return null;
    }

    const isPasswordValid = await this.userService.validatePassword(
      password,
      user.password,
    );

    if (isPasswordValid) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user.toObject() as Record<
        string,
        unknown
      > & { password: string };
      return result;
    }

    return null;
  }

  async getProfile(userId: string) {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user._id,
      email: user.email,
      username: user.username,
    };
  }

  async googleLogin(user: any) {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
      },
    };
  }
}
