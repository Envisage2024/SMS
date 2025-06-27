// Environment configuration loader
// This script makes environment variables available to the client-side application

// Load environment variables from Replit secrets
window.ENV = {
    VITE_FIREBASE_API_KEY: window.location.hostname.includes('replit') ? 
        (typeof process !== 'undefined' && process.env ? process.env.VITE_FIREBASE_API_KEY : null) : 
        null,
    VITE_FIREBASE_APP_ID: window.location.hostname.includes('replit') ? 
        (typeof process !== 'undefined' && process.env ? process.env.VITE_FIREBASE_APP_ID : null) : 
        null,
    VITE_FIREBASE_PROJECT_ID: window.location.hostname.includes('replit') ? 
        (typeof process !== 'undefined' && process.env ? process.env.VITE_FIREBASE_PROJECT_ID : null) : 
        null
};

// Fallback configuration for development
if (!window.ENV.VITE_FIREBASE_API_KEY) {
    window.ENV = {
        VITE_FIREBASE_API_KEY: "AIzaSyDVmQjXrMJv_IUJhkJb2OmGEb_i_HPqd1s",
        VITE_FIREBASE_APP_ID: "1:593777018359:web:e3dbc90b8d7bab61fcdaf2",
        VITE_FIREBASE_PROJECT_ID: "sms-db-7db30"
    };
}

console.log('Environment configuration loaded:', {
    hasApiKey: !!window.ENV.VITE_FIREBASE_API_KEY,
    hasAppId: !!window.ENV.VITE_FIREBASE_APP_ID,
    hasProjectId: !!window.ENV.VITE_FIREBASE_PROJECT_ID
});