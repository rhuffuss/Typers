export interface SqlLabOptions {
  url: string;
  schema: string;
}
export interface MongoLabOptions {
  url: string;
  database: string;
}
export const SQL_LAB_OPTIONS = Symbol('SQL_LAB_OPTIONS');
export const MONGO_LAB_OPTIONS = Symbol('MONGO_LAB_OPTIONS');

/** Isolation is mandatory for destructive schema setup/cleanup in these labs. */
export function assertLabNamespace(value: string): string {
  if (!/^typers_lab_[a-z0-9_]{8,80}$/.test(value)) {
    throw new Error(
      'Laboratory namespace must start with typers_lab_ and contain only lowercase letters, numbers and underscores',
    );
  }
  return value;
}
