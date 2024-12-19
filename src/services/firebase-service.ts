import * as admin from 'firebase-admin';
import { initializeFirebase } from '../config/firebase-config';
import logger from './logger';
import { PresenceData, UserPresenceStatus } from '../types/websocket';

export class FirebaseService {
  private db: admin.firestore.Firestore;

  constructor() {
    try {
      // Inicialización de Firebase y conexión con Firestore
      const app = initializeFirebase();
      this.db = app.firestore();
      logger.info('Firebase initialized successfully');
    } catch (error) {
      logger.error('Error initializing FirebaseService:', error);
      throw this.handleError(error);  // Manejo de errores generalizado
    }
  }

  /**
   * Maneja los errores generales relacionados con Firebase.
   * Si el error es una instancia de Error, se devuelve tal cual.
   * En caso contrario, se convierte a un Error genérico.
   * @param error Error a manejar
   * @returns Un objeto Error.
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  /**
   * Actualiza la información de presencia de un usuario en Firestore.
   * 
   * @param presenceData Datos de presencia del usuario
   * @throws Error Si ocurre un error al actualizar los datos en Firebase
   */
  async updatePresence(presenceData: PresenceData): Promise<void> {
    try {
      logger.debug(`Updating presence for user: ${presenceData.userId}`);

      const presenceRef = this.db.collection('presence').doc(presenceData.userId);
      // Realiza una actualización con merge para no sobrescribir los datos existentes
      await presenceRef.set(
        {
          ...presenceData,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),  // Marca el momento de actualización
        },
        { merge: true }
      );

      logger.debug(`Presence for user ${presenceData.userId} updated successfully.`);
    } catch (error) {
      logger.error('Error updating presence in Firebase:', error);
      throw this.handleError(error);  // Propaga el error con manejo adecuado
    }
  }

  /**
   * Recupera los datos de presencia de un usuario específico.
   * 
   * @param userId ID del usuario cuya presencia se desea obtener
   * @returns Los datos de presencia si existen, de lo contrario, null
   * @throws Error Si ocurre un error al obtener los datos de Firebase
   */
  async getPresence(userId: string): Promise<PresenceData | null> {
    try {
      logger.debug(`Fetching presence for user: ${userId}`);

      const presenceRef = this.db.collection('presence').doc(userId);
      const doc = await presenceRef.get();

      // Si el documento no existe, retorna null
      if (!doc.exists) {
        logger.debug(`No presence data found for user: ${userId}`);
        return null;
      }

      return doc.data() as PresenceData;  // Devuelve los datos de presencia
    } catch (error) {
      logger.error(`Error fetching presence for user ${userId}:`, error);
      throw this.handleError(error);  // Propaga el error con manejo adecuado
    }
  }

  /**
   * Configura un listener para detectar cambios en la presencia de usuarios en Firestore.
   * 
   * @param callback Función que se ejecuta cuando se detectan cambios de presencia
   * @returns Una función para cancelar la suscripción
   * @throws Error Si ocurre un error al configurar el listener
   */
  async watchPresenceChanges(callback: (presenceData: PresenceData) => void): Promise<() => void> {
    try {
      logger.info('Setting up presence change listener');

      const unsubscribe = this.db.collection('presence').onSnapshot(
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (['added', 'modified'].includes(change.type)) {
              const presenceData = change.doc.data() as PresenceData;
              callback(presenceData);  // Llama al callback con los datos de presencia actualizados
            }
          });
        },
        (error) => {
          logger.error('Error in presence snapshot listener:', error);
        }
      );

      return unsubscribe;  // Devuelve la función de desuscripción
    } catch (error) {
      logger.error('Error setting up presence watcher:', error);
      throw this.handleError(error);  // Propaga el error con manejo adecuado
    }
  }

  /**
   * Limpia las entradas de presencia obsoletas, marcando a los usuarios como offline.
   * 
   * @throws Error Si ocurre un error al limpiar los datos de presencia
   */
  async cleanupOfflinePresence(): Promise<void> {
    try {
      logger.info('Cleaning up stale online presence entries');

      const presenceRef = this.db.collection('presence');
      const snapshot = await presenceRef.where('status', '==', UserPresenceStatus.ONLINE).get();

      // Si no hay entradas obsoletas, se termina el proceso
      if (snapshot.empty) {
        logger.info('No stale online presence entries found');
        return;
      }

      const batch = this.db.batch();  // Usar un batch para actualizar múltiples documentos

      // Actualiza todas las entradas obsoletas a offline
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: UserPresenceStatus.OFFLINE,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),  // Marca la hora de la última vista
        });
      });

      await batch.commit();  // Ejecuta el batch de actualizaciones
      logger.info('Stale online presence entries marked as offline successfully');
    } catch (error) {
      logger.error('Error cleaning up stale online presence:', error);
      throw this.handleError(error);  // Propaga el error con manejo adecuado
    }
  }
}

export const firebaseService = new FirebaseService();
