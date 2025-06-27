import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPbc82p3XWtzH0X4Ougj9MPeDiJF9vzYk",
  authDomain: "sms-db-7b1c7.firebaseapp.com",
  databaseURL: "https://sms-db-7b1c7-default-rtdb.firebaseio.com",
  projectId: "sms-db-7b1c7",
  storageBucket: "sms-db-7b1c7.firebasestorage.app",
  messagingSenderId: "848657966289",
  appId: "1:848657966289:web:3d4ab0afabc6bc9b57d1f0",
  measurementId: "G-45LBM5CTZ0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function getStudentData(studentId) {
  const studentDoc = doc(db, "students", studentId);
  const snapshot = await getDoc(studentDoc);
  if (!snapshot.exists()) {
    throw new Error("Student not found");
  }
  return snapshot.data();
}

export async function addPrescriptionToStudent(studentId, prescription) {
  const studentDoc = doc(db, "students", studentId);
  await updateDoc(studentDoc, {
    prescriptions: arrayUnion(prescription),
  });
}
