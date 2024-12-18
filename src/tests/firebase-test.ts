// src/tests/firebase-test.ts
import { firebaseService } from '../services/firebase-service';
import logger from '../services/logger';
import { UserPresenceStatus } from '../types/websocket';

async function testFirebaseConnection() {
  try {
    logger.info('Testing Firebase connection...');

    // Test de escritura
    const testPresenceData = {
      userId: 'test-user',
      status: UserPresenceStatus.ONLINE,
      lastSeen: new Date().toISOString(),
      metadata: {
        test: true
      }
    };

    await firebaseService.updatePresence(testPresenceData);
    logger.info('✅ Write test passed');

    // Test de lectura
    const readData = await firebaseService.getPresence('test-user');
    logger.info('Read data:', readData);
    logger.info('✅ Read test passed');

    // Limpiar datos de prueba
    const cleanupData = {
      userId: 'test-user',
      status: UserPresenceStatus.OFFLINE,
      lastSeen: new Date().toISOString()
    };
    await firebaseService.updatePresence(cleanupData);
    logger.info('✅ Cleanup completed');

    logger.success('All Firebase tests passed!');
    process.exit(0);
  } catch (error) {
    logger.error('Firebase test failed', error as Error);
    process.exit(1);
  }
}

// Ejecutar tests
testFirebaseConnection();