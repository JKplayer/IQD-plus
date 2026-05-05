
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listUsers() {
  const snapshot = await getDocs(collection(db, 'users'));
  snapshot.forEach(doc => {
    console.log(`ID: ${doc.id}, Email: ${doc.data().email}`);
  });
}

listUsers().catch(console.error);
