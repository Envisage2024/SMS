// Authentication module
import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Login function
export async function loginWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Logout function
export async function logout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}

// Check authentication status
export function checkAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                // User is authenticated
                updateUserInfo(user);
                resolve(user);
            } else {
                // User is not authenticated, redirect to login
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = 'login.html';
                }
                reject('Not authenticated');
            }
        });
    });
}

// Update user information in the UI
function updateUserInfo(user) {
    const userEmailElement = document.getElementById('nurseEmail');
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }
}

// Get current user
export function getCurrentUser() {
    return auth.currentUser;
}

// Make logout function globally available
window.logout = logout;
