import * as admin from 'firebase-admin'; // SDK de Firebase Admin para manejar servicios de Firebase
import * as path from 'path'; // Módulo de Node.js para manejar rutas de archivos
import logger from '../services/logger'; // Sistema de logs personalizado

/**
 * Inicializa la instancia de Firebase Admin SDK.
 * Si ya hay una instancia activa, se reutiliza en lugar de crear una nueva.
 * 
 * @returns {admin.app.App} La instancia inicializada de Firebase Admin
 * @throws {Error} Si ocurre algún error durante la inicialización
 */
export function initializeFirebase() {
  try {
    // Verificar si ya existe una aplicación Firebase inicializada
    if (admin.apps.length) {
      logger.info('Firebase app already initialized, reusing the existing instance.');
      return admin.app(); // Retorna la instancia ya existente
    }

    // Ruta al archivo de credenciales del servicio
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
    
    logger.info('Initializing Firebase with service account from:', serviceAccountPath);

    // Inicializar la app Firebase con las credenciales proporcionadas
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath), // Cargar credenciales del archivo JSON
    });

    logger.info('Firebase initialized successfully'); // Log de éxito
    return app; // Retornar la instancia inicializada de Firebase
  } catch (error) {
    logger.error('Error initializing Firebase:', error); // Log de error detallado
    throw error; // Lanzar el error para que sea manejado por el llamador
  }
}
