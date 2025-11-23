import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from '../schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { GoogleUserData } from './user.interfaces';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(registerDto: RegisterDto): Promise<User> {
    const { email, password, username } = registerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new this.userModel({
      email,
      password: hashedPassword,
      username,
      authProvider: AuthProvider.LOCAL,
    });

    return user.save();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findOrCreateGoogleUser(userData: GoogleUserData): Promise<User> {
    const { googleId, email, username } = userData;

    // First, check if user exists with this googleId
    let user = await this.findByGoogleId(googleId);
    if (user) {
      return user;
    }

    // Check if user exists with this email (account linking scenario)
    user = await this.findByEmail(email);
    if (user) {
      // Link Google account to existing user
      user.googleId = googleId;
      user.authProvider = AuthProvider.GOOGLE;
      return user.save();
    }

    // Create new Google user
    const newUser = new this.userModel({
      email,
      username,
      googleId,
      authProvider: AuthProvider.GOOGLE,
      // No password for Google users
    });

    return newUser.save();
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * STRICT: Delete user with cascade deletion of all related data
   * Cascade deletion is handled automatically by pre-delete hooks in user.schema.ts
   * This ensures no orphaned quizzes, attempts, or results remain
   */
  async deleteUser(userId: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(userId).exec();

    if (!result) {
      throw new ConflictException('User not found');
    }

    // Cascade deletion of quizzes, attempts, and results is handled by schema hooks
  }
}
