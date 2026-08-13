export function createDatabaseConfig(environment = process.env) {
  if (environment.DATABASE_URL) {
    return { connectionString: environment.DATABASE_URL };
  }

  return {
    host: environment.DB_HOST || 'localhost',
    port: Number(environment.DB_PORT || 5432),
    user: environment.DB_USER || 'postgres',
    password: environment.DB_PASSWORD || 'postgres',
    database: environment.DB_NAME || 'feedback_db',
  };
}
