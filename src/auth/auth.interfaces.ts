export interface GoogleUser {
  _id: { toString: () => string };
  email: string;
  username: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

export interface UserProfile {
  id: unknown;
  email: string;
  username: string;
}

