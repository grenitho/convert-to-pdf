require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 26214400, // Default 25MB dalam bytes
  uploadDir: process.env.UPLOAD_DIR || './tmp/uploads',
  convertedDir: process.env.CONVERTED_DIR || './tmp/converted',
  conversionTimeout: parseInt(process.env.CONVERSION_TIMEOUT, 10) || 120000, // Default 120 detik dalam ms
};

module.exports = config;