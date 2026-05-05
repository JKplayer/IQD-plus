
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function promoteAdmin() {
  const email = 'wreawali27@gmail.com';
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log('User not found');
    return;
  }

  const userDoc = snapshot.docs[0];
  const uid = userDoc.id;

  console.log(`Found user ${email} with UID ${uid}. Promoting to admin...`);

  // 1. Add to admins collection
  await setDoc(doc(db, 'admins', uid), {
    email: email,
    promotedAt: new Date().toISOString()
  });

  console.log('Successfully added to admins collection.');
}

promoteAdmin().catch(console.error);
