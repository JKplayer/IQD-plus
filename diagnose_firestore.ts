
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

async function diagnose() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  console.log('Target Project:', config.projectId);
  console.log('Target Database:', config.firestoreDatabaseId);

  admin.initializeApp({
    projectId: config.projectId
  });

  const projectNum = '258012273293';
  console.log('Testing with Project Number:', projectNum);
  
  admin.initializeApp({
    projectId: projectNum
  }, 'numApp');

  const dbs2 = [{ name: 'default', id: '(default)' }];
  for (const dbInfo of dbs2) {
    console.log(`\nTesting Project Number with DB: ${dbInfo.name} (${dbInfo.id})`);
    try {
      const db = getFirestore(admin.app('numApp'));
      const snap = await db.collection('users').limit(1).get();
      console.log(`Success! Found ${snap.size} users.`);
    } catch (e: any) {
      console.error(`Failed: ${e.message}`);
    }
  }
}

admin.initializeApp({
  projectId: 'ais-europe-west3-7a5d96df6e894'
}, 'envApp');
diagnose();
