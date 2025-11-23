export interface PopulatedCreator {
  _id: { toString: () => string };
  username?: string;
  email?: string;
}

export interface CreatorIdObject {
  _id: { toString: () => string };
}

