// src/tests/firebase-test.ts
import { firebaseService } from '../services/firebase-service';
import logger from '../services/logger';
import { UserPresenceStatus } from '../types/websocket';

// Función para realizar pruebas de conexión a Firebase
async function testFirebaseConnection() {
  try {
    logger.info('Starting Firebase connection test...');

    // Crear datos de prueba para la presencia del usuario
    const testPresenceData = {
      userId: 'test-user', // ID del usuario de prueba
      status: UserPresenceStatus.ONLINE, // Estado de presencia (ONLINE)
      lastSeen: new Date().toISOString(), // Timestamp de la última vez que el usuario estuvo activo
      metadata: {
        test: true, // Información adicional de prueba
      },
    };

    // Test de escritura: actualizar presencia del usuario
    await firebaseService.updatePresence(testPresenceData);
    logger.info('✅ Write test passed successfully');

    // Test de lectura: obtener la presencia del usuario
    const readData = await firebaseService.getPresence('test-user');
    logger.info('Read data:', readData);
    logger.info('✅ Read test passed successfully');

    // Test de limpieza: restaurar estado de presencia del usuario a OFFLINE
    const cleanupData = {
      userId: 'test-user', // ID del usuario de prueba
      status: UserPresenceStatus.OFFLINE, // Estado de presencia (OFFLINE)
      lastSeen: new Date().toISOString(), // Timestamp actualizado
    };
    await firebaseService.updatePresence(cleanupData);
    logger.info('✅ Cleanup completed successfully');

    // Todos los tests pasaron correctamente
    logger.success('All Firebase tests passed!');
    process.exit(0); // Salir con código 0 (éxito)
  } catch (error) {
    // Si ocurre un error, se maneja y se muestra en los logs
    logger.error('Firebase test failed', error as Error);
    process.exit(1); // Salir con código 1 (error)
  }
}

// Ejecutar las pruebas de Firebase
testFirebaseConnection();
