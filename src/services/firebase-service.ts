import * as admin from 'firebase-admin';
import { initializeFirebase } from '../config/firebase-config';
import * as path from 'path';
import logger from './logger';
import { PresenceData, UserPresenceStatus } from '../types/websocket';

export class FirebaseService {
  private db: admin.firestore.Firestore;
  
  constructor() {
    try {
      const app = initializeFirebase();
      this.db = app.firestore();
      logger.info('Firebase initialized successfully');
    } catch (error) {
      logger.error('Error in FirebaseService constructor:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  async updatePresence(presenceData: PresenceData): Promise<void> {
    try {
      logger.debug('Updating presence for user:', presenceData.userId);
      
      const presenceRef = this.db.collection('presence').doc(presenceData.userId);
      
      await presenceRef.set({
        ...presenceData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      logger.debug('Presence updated successfully');
    } catch (error) {
      logger.error('Error updating presence in Firebase:', error);
      throw this.handleError(error);
    }
  }

  async getPresence(userId: string): Promise<PresenceData | null> {
    try {
      const presenceRef = this.db.collection('presence').doc(userId);
      const doc = await presenceRef.get();
      
      if (doc.exists) {
        return doc.data() as PresenceData;
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting presence from Firebase', error as Error);
      throw error;
    }
  }

  async watchPresenceChanges(callback: (presenceData: PresenceData) => void): Promise<() => void> {
    try {
      const unsubscribe = this.db.collection('presence')
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified' || change.type === 'added') {
              const presenceData = change.doc.data() as PresenceData;
              callback(presenceData);
            }
          });
        }, (error) => {
          logger.error('Error in presence snapshot listener', error);
        });

      return unsubscribe;
    } catch (error) {
      logger.error('Error setting up presence watcher', error as Error);
      throw error;
    }
  }

  async cleanupOfflinePresence(): Promise<void> {
    try {
      const presenceRef = this.db.collection('presence');
      const batch = this.db.batch();
      
      const snapshot = await presenceRef
        .where('status', '==', UserPresenceStatus.ONLINE)
        .get();
      
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: UserPresenceStatus.OFFLINE,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      
      await batch.commit();
      logger.info('Cleaned up offline presence states');
    } catch (error) {
      logger.error('Error cleaning up offline presence', error as Error);
      throw error;
    }
  }
}

export const firebaseService = new FirebaseService();