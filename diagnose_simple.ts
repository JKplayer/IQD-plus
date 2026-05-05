
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

async function diagnose() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  console.log('Config Project:', config.projectId);
  
  admin.initializeApp();
  console.log('Default App Project:', admin.app().options.projectId);
  
  const db = getFirestore(config.firestoreDatabaseId);
  try {
     const snap = await db.collection('users').limit(1).get();
     console.log('Success with Default Init + Config DB ID');
  } catch (e: any) {
     console.error('Failed with Default Init:', e.message);
  }

  await admin.app().delete();
  
  console.log('\n--- Testing with Config Project ID ---');
  admin.initializeApp({ projectId: config.projectId });
  const db2 = getFirestore(config.firestoreDatabaseId);
  try {
     const snap = await db2.collection('users').limit(1).get();
     console.log('Success with Config Project ID + Config DB ID');
  } catch (e: any) {
     console.error('Failed with Config Project ID:', e.message);
  }
}

diagnose();
