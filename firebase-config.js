// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBGDT1IZGFR0ravirAC-jpcuj4Y9Uuipks",
  authDomain: "adageorge-35236.firebaseapp.com",
  projectId: "adageorge-35236",
  storageBucket: "adageorge-35236.firebasestorage.app",
  messagingSenderId: "397933347333",
  appId: "1:397933347333:web:316bacd8dc69b56f7fd26c",
  measurementId: "G-6PPH3KWEXY"
};

// Database Collections
const Collections = {
  SETTINGS: 'settings',
  SERMONS: 'sermons',
  EVENTS: 'events',
  SERVICES: 'services',
  TESTIMONIES: 'testimonies',
  CONTENT: 'content',
  ADMIN: 'admin',
  MESSAGES: 'messages',
  QUOTES: 'quotes',
  MOMENTS: 'moments'
};

// Initialize Firebase
console.log("Connecting to Firebase project:", firebaseConfig.projectId);
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firestore
let db;
try {
  console.log("Attempting Firestore initialization with database ID:", firebaseConfig.firestoreDatabaseId);
  if (firebaseConfig.firestoreDatabaseId) {
    // Try multiple patterns common in compat SDKs
    try {
      db = firebase.app().firestore(firebaseConfig.firestoreDatabaseId);
      console.log("Firestore initialized using firebase.app().firestore(id)");
    } catch (innerE) {
      console.warn("firebase.app().firestore(id) failed, trying firebase.firestore(app, id)");
      db = firebase.firestore(app, firebaseConfig.firestoreDatabaseId);
      console.log("Firestore initialized using firebase.firestore(app, id)");
    }
  } else {
    db = firebase.firestore();
  }
} catch (e) {
  console.warn("All named database initialization attempts failed:", e.message);
  db = firebase.firestore();
}

db.settings({ 
  experimentalForceLongPolling: true,
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});
// Remove network toggle as it can disrupt initialization for custom databases
// db.disableNetwork().then(() => db.enableNetwork());

// Firestore Operation Types
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

// Robust Firestore Error Handler
function handleFirestoreError(error, operationType, path) {
  const auth = (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') ? firebase.auth() : null;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: auth ? {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    } : { note: "Auth SDK not loaded or available" },
    operationType,
    path
  };
  
  let errString;
  try {
    errString = JSON.stringify(errInfo);
  } catch (e) {
    errString = `Firestore Error: ${errInfo.error} | Operation: ${operationType} | Path: ${path}`;
  }
  
  console.error('Firestore Error Details:', errString);
  throw new Error(errString);
}

// Global Error Catching
window.addEventListener('error', function(event) {
    if (event.message === 'Script error.') {
        console.warn('Masked "Script error." detected. This usually means a cross-origin script failed to load or executed with errors. Check script attributes and CORS headers.');
    } else {
        console.error('Captured Global Error:', event.message, 'at', event.filename, ':', event.lineno, ':', event.colno);
    }
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Captured Unhandled Rejection:', event.reason);
});

// Test connection to Firestore
async function testConnection() {
  try {
    // Try to get a document to verify connection
    await db.collection(Collections.SETTINGS).doc('theme').get({ source: 'server' });
    console.log("Firestore connection successful.");
    return true;
  } catch (error) {
    console.warn("Firestore connection test failed:", error.message);
    if (error.message && error.message.includes('offline')) {
      console.error("The client is offline. Database ID might be misconfigured or network is blocked.");
    } else if (error.code === 'permission-denied') {
      console.error("Permission denied. Check Firestore security rules.");
    }
    return false;
  }
}

// Global flag to track initialization
window.firebaseInitialized = false;

// Initialize default data if not exists
async function initializeDefaultData() {
  try {
    console.log('Firebase services initialized. Waiting for network stability...');
    // Small delay to allow the SDK to establish its background connection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Starting Firestore connection check...');
    const connected = await testConnection();
    
    if (!connected) {
      console.warn('Initial connection check failed, retrying in 2.5 seconds with fresh attempt...');
      await new Promise(resolve => setTimeout(resolve, 2500));
      const retryConnected = await testConnection();
      if (!retryConnected) {
        console.warn('Firestore still reporting offline state. This is common in some preview environments. The app will continue in offline-first mode.');
      }
    }

    // Check if settings exist
    const settingsDoc = await db.collection(Collections.SETTINGS).doc('theme').get();
    
    if (!settingsDoc.exists) {
      console.log('Initializing default data...');
      
      // Initialize default theme settings
      await db.collection(Collections.SETTINGS).doc('theme').set({
        mode: 'light',
        primaryColor: '#2563eb',
        secondaryColor: '#7c3aed',
        accentColor: '#f59e0b',
        heroMode: 'collage',
        heroImages: [
          { url: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?w=1600&q=80', link: '#' },
          { url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1200&q=80', link: '#' },
          { url: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1200&q=80', link: '#' },
          { url: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?w=1200&q=80', link: '#' },
          { url: 'https://images.unsplash.com/photo-1478147427282-58a87a120781?w=1200&q=80', link: '#' },
          { url: 'https://images.unsplash.com/photo-1507679799987-c7377f323b88?w=1200&q=80', link: '#' },
          { url: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1200&q=80', link: '#' },
          { url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200&q=80', link: '#' }
        ],
        heroText: 'Salvation Ministries Ada George',
        heroSubtext: 'A dynamic community where faith transforms lives.',
        logoUrl: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=200&q=80',
        faviconUrl: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=64&q=80',
        livestreamUrl: 'https://www.youtube.com/@SalvationMinistries',
        sermonBackground: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?w=1600&q=80',
        testimonyBackground: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?w=1600&q=80'
      });

      // Initialize default content
      await db.collection(Collections.CONTENT).doc('about').set({
        mission: 'To spread the Gospel of Jesus Christ and transform lives through biblical teaching and community service.',
        missionImage: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80',
        vision: 'Building a community of believers who live out their faith with passion and purpose.',
        visionImage: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=80',
        welcomeMessage: 'We are a vibrant community of believers committed to worshipping God, studying His Word, and serving our community with love and compassion.',
        welcomeImage: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?w=800&q=80'
      });

      // Initialize default quotes
      await db.collection(Collections.QUOTES).add({
        text: "The word of God is a lamp unto my feet and a light unto my path.",
        author: "Psalm 119:105",
        active: true,
        createdAt: firebase.firestore.Timestamp.now()
      });

      // Initialize default moments
      await db.collection(Collections.MOMENTS).add({
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1200&q=80',
        title: 'Sunday Worship',
        description: 'A powerful time in God\'s presence.',
        createdAt: firebase.firestore.Timestamp.now()
      });

      await db.collection(Collections.MOMENTS).add({
        type: 'video',
        url: 'https://www.facebook.com/smhosglobal',
        title: 'Live Service Highlights',
        createdAt: firebase.firestore.Timestamp.now()
      });

      // Initialize default service times
      await db.collection(Collections.SERVICES).doc('schedule').set({
        sunday1: {
          title: '1st Sunday Service',
          time: '6:30 AM',
          description: 'Early morning worship and word'
        },
        sunday2: {
          title: '2nd Sunday Service',
          time: '8:00 AM',
          description: 'Praise, worship and transformation'
        },
        sunday3: {
          title: '3rd Sunday Service',
          time: '9:30 AM',
          description: 'Encounter with the word'
        },
        sunday4: {
          title: '4th Sunday Service',
          time: '11:00 AM',
          description: 'Closing service of the day'
        },
        midweek: {
          title: 'Midweek Service',
          time: 'Wednesday 6:00 PM',
          description: 'Prayer, Bible study, and fellowship'
        },
        special: {
          title: 'Special Programs',
          time: 'Check Events',
          description: 'Monthly special services and programs'
        }
      });

      // Initialize contact info
      await db.collection(Collections.CONTENT).doc('contact').set({
        email: 'info@salvationministries-adageorge.org',
        phone: '+234 123 456 7890',
        address: 'Ada George Road, Port Harcourt, Rivers State, Nigeria',
        offeringAccounts: [
          {
            title: 'General Offering',
            bank: 'Sample Bank',
            accountName: 'Salvation Ministries Ada George',
            accountNumber: '0123456789'
          }
        ]
      });

      // Initialize default admin credentials
      await db.collection(Collections.ADMIN).doc('credentials').set({
        username: 'admin',
        password: 'admin123' // In production, this should be hashed
      });

      console.log('Default data initialized successfully');
    }
    
    // Mark initialization as complete
    window.firebaseInitialized = true;
    console.log('Firebase initialization complete');
  } catch (error) {
    console.error('Error initializing default data:', error);
    window.firebaseInitialized = true; // Still mark as initialized to allow login attempts
  }
}

// Call initialization on load
initializeDefaultData();

// Helper function to wait for Firebase initialization
function waitForFirebase() {
  return new Promise((resolve) => {
    if (window.firebaseInitialized) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (window.firebaseInitialized) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    }
  });
}
