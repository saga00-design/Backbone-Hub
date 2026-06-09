import { db, collection, addDoc, LOCATION_ID, handleFirestoreError, OperationType, cleanObject } from '../firebase';
import { AuditLog } from '../types';

export async function logAuditAction(
  userId: string,
  userName: string,
  action: string,
  targetType: AuditLog['targetType'],
  targetId: string,
  targetName: string,
  oldValue?: any,
  newValue?: any
) {
  try {
    const log: Omit<AuditLog, 'id'> = {
      locationId: LOCATION_ID,
      userId,
      userName,
      action,
      targetType,
      targetId,
      targetName,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, 'auditLogs'), cleanObject(log));
  } catch (err) {
    console.error('Audit logging failed:', err);
    // Don't throw here to avoid blocking UI actions, but log it
  }
}
