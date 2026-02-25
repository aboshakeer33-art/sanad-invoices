// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAwWljVJ6koe4R_zfrpDm1P1IEBBy3L8w",
  authDomain: "sanad-invoices.firebaseapp.com",
  projectId: "sanad-invoices",
  storageBucket: "sanad-invoices.firebasestorage.app",
  messagingSenderId: "833120508757",
  appId: "1:833120508757:web:e15938d0b28343ad84addc"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
