import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Debug output
console.log('Environment variables loaded:');
console.log('HOST:', process.env.DATABASE_HOST);
console.log('PORT:', process.env.DATABASE_PORT);
console.log('USERNAME:', process.env.DATABASE_USERNAME);
console.log(
  'PASSWORD:',
  process.env.DATABASE_PASSWORD ? '(exists)' : 'MISSING!',
);
console.log('DATABASE:', process.env.DATABASE_NAME);

// For local development
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  ssl: false,
});

//for production
// export const AppDataSource = new DataSource({
//   type: 'postgres',
//   url: process.env.DATABASE_URL,
//   entities: ['dist/**/*.entity{.ts,.js}'],
//   migrations: ['dist/migrations/*{.ts,.js}'],
//   synchronize: false,
//   ssl: { rejectUnauthorized: false },
// });
