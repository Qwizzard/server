import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface MongooseConnection {
  db: {
    collection: (name: string) => {
      deleteMany: (filter: {
        creatorId?: Types.ObjectId;
        userId?: Types.ObjectId;
      }) => Promise<unknown>;
    };
  };
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: false })
  password?: string;

  @Prop({ required: true, trim: true })
  username: string;

  @Prop({ type: String, enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @Prop({ required: false, unique: true, sparse: true })
  googleId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// STRICT: Cascade deletion hooks to prevent orphaned data
// These hooks automatically delete all related data when a user is deleted

// Hook for document deletion (e.g., user.deleteOne())
UserSchema.pre(
  'deleteOne',
  { document: true, query: false },
  async function (next) {
    try {
      const userId = this._id;
      const connection = this.db as unknown as MongooseConnection;
      const db = connection.db;

      if (!db) {
        throw new Error('Database connection not available');
      }

      // Delete all related data to prevent orphans
      await Promise.all([
        db.collection('quizzes').deleteMany({ creatorId: userId }),
        db.collection('attempts').deleteMany({ userId: userId }),
        db.collection('results').deleteMany({ userId: userId }),
      ]);

      console.log(`[CASCADE] Deleted all data for user ${userId.toString()}`);
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
  },
);

// Hook for query deletion (e.g., User.findByIdAndDelete(), User.deleteOne())
UserSchema.pre('findOneAndDelete', async function (next) {
  try {
    const query = this.getQuery();
    const doc = (await this.model.findOne(query).exec()) as
      | (Document & { _id: Types.ObjectId })
      | null;

    if (doc) {
      const userId: Types.ObjectId = doc._id;
      const connection = this.model.db as unknown as MongooseConnection;
      const db = connection.db;

      if (!db) {
        throw new Error('Database connection not available');
      }

      // Delete all related data to prevent orphans
      await Promise.all([
        db.collection('quizzes').deleteMany({ creatorId: userId }),
        db.collection('attempts').deleteMany({ userId: userId }),
        db.collection('results').deleteMany({ userId: userId }),
      ]);

      console.log(`[CASCADE] Deleted all data for user ${userId.toString()}`);
    }

    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error(String(error)));
  }
});
