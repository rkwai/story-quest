import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

// Load environment variables
dotenv.config();

const execPromise = promisify(exec);

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME || 'storyquest',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      // Add options to handle different PostgreSQL versions
      application_name: 'storyquest',
    },
  }
);

// Create database if it doesn't exist
export const createDatabaseIfNotExists = async (): Promise<void> => {
  const dbName = process.env.DB_NAME || 'storyquest';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';

  try {
    // Check if database exists
    const checkCmd = `PGPASSWORD=${dbPassword} psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -lqt | cut -d \\| -f 1 | grep -qw ${dbName}`;
    
    try {
      await execPromise(checkCmd);
      console.log(`Database ${dbName} already exists.`);
    } catch (error) {
      // Database doesn't exist, create it
      console.log(`Database ${dbName} does not exist. Creating...`);
      const createCmd = `PGPASSWORD=${dbPassword} psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -c "CREATE DATABASE ${dbName}"`;
      await execPromise(createCmd);
      console.log(`Database ${dbName} created successfully.`);
    }
  } catch (error) {
    console.error('Error creating database:', error);
    console.log('You may need to create the database manually:');
    console.log(`createdb -h ${dbHost} -p ${dbPort} -U ${dbUser} ${dbName}`);
  }
};

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    console.error('Please check your PostgreSQL installation and connection settings.');
    console.error('Make sure PostgreSQL is running and the database exists.');
    
    // Try to create the database if it doesn't exist
    await createDatabaseIfNotExists();
    
    // Retry connection
    try {
      await sequelize.authenticate();
      console.log('Database connection has been established successfully after creating database.');
    } catch (retryError) {
      console.error('Still unable to connect to the database after creating it:', retryError);
      throw retryError;
    }
  }
};

export default sequelize; 