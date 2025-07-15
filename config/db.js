const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dotenv = require('dotenv');
dotenv.config();

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('Connected to MySQL database successfully!');
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
};



module.exports = {connectDB,prisma};