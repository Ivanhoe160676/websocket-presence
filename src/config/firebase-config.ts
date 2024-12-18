import * as admin from 'firebase-admin';
import * as path from 'path';
import logger from '../services/logger';

export function initializeFirebase() {
  try {
    if (admin.apps.length) {
      return admin.app();
    }

    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
    
    logger.info('Initializing Firebase with service account from:', serviceAccountPath);
    
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath)
    });

    logger.info('Firebase initialized successfully');
    return app;
  } catch (error) {
    logger.error('Error initializing Firebase:', error);
    throw error;
  }
}