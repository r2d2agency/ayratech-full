import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { UPLOAD_ROOT } from './config/upload.config';
import { json, urlencoded } from 'express';

async function bootstrap() {
  console.log('Starting application with Standard NestJS CORS...');
  try {
    // Ensure uploads directory exists
    const uploadsPath = UPLOAD_ROOT;
    try {
      fs.writeFileSync('debug_upload_root.txt', `UPLOAD_ROOT: ${uploadsPath}\nCWD: ${process.cwd()}`);
    } catch (e) {
      console.error('Failed to write debug file', e);
    }
    if (!fs.existsSync(uploadsPath)) {
      console.log(`Creating uploads directory at: ${uploadsPath}`);
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
  } catch (err) {
    console.error('Warning: Could not create uploads directory:', err);
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Increase body limit for Base64 images
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enable standard CORS with credentials support
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://admin.ayratech.app.br',
        'https://ayratech.app.br',
        'https://www.ayratech.app.br',
        'https://api.ayratech.app.br',
        'https://promotor.ayratech.app.br',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4173',
        'http://localhost:5174'
      ];
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        // Log blocked origin for debugging
        console.warn(`Blocked CORS origin: ${origin}`);
        return callback(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT || 3000;
  try {
    console.log(`Starting application on port ${port}...`);
    // Force reload trigger
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: ${await app.getUrl()}`);
    console.log(`Server bound to 0.0.0.0:${port}`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}
bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
