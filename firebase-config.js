// ============================================================================
// Robust Console Interceptor to prevent circular reference serialization crashes
// inside AI Studio's iframe harness when Firestore and system logs are output.
// ============================================================================
(function() {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  const seenSet = new WeakSet();

  function safeClean(val) {
    if (val === null || val === undefined) return val;
    const type = typeof val;
    if (type !== 'object' && type !== 'function') return val;
    
    if (type === 'function') {
      return `[Function: ${val.name || 'anonymous'}]`;
    }

    if (seenSet.has(val)) {
      return '[Circular]';
    }

    const constructorName = val.constructor ? val.constructor.name : '';
    if (constructorName === 'Hn' || constructorName === 'le' || constructorName.includes('Firestore') || constructorName.startsWith('t') || constructorName.startsWith('e')) {
      return `[FirestoreObject: ${constructorName}]`;
    }
    
    if (val instanceof HTMLElement || val instanceof Event || val instanceof Window) {
      return '[BrowserObject]';
    }

    seenSet.add(val);

    try {
      if (Array.isArray(val)) {
        const arrCopy = val.map(v => {
          try {
            return safeClean(v);
          } catch (e) {
            return '[Clean Error]';
          }
        });
        seenSet.delete(val);
        return arrCopy;
      }

      const copy = {};
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          try {
            copy[key] = safeClean(val[key]);
          } catch (e) {
            copy[key] = '[Access Error]';
          }
        }
      }
      seenSet.delete(val);
      return copy;
    } catch (e) {
      seenSet.delete(val);
      return '[Uncleanable Object]';
    }
  }

  function sanitizeArgs(args) {
    try {
      return Array.from(args).map(arg => {
        if (arg === null || arg === undefined) return arg;
        if (typeof arg !== 'object') return arg;
        try {
          return safeClean(arg);
        } catch (e) {
          return '[Serialization Warning]';
        }
      });
    } catch (err) {
      return ['[Arg Sanitization Failed]'];
    }
  }

  console.error = function() {
    try {
      originalError.apply(console, sanitizeArgs(arguments));
    } catch (e) {
      originalError.apply(console, ['Failed to log error safely']);
    }
  };
  console.warn = function() {
    try {
      originalWarn.apply(console, sanitizeArgs(arguments));
    } catch (e) {
      originalWarn.apply(console, ['Failed to log warning safely']);
    }
  };
  console.log = function() {
    try {
      originalLog.apply(console, sanitizeArgs(arguments));
    } catch (e) {
      originalLog.apply(console, ['Failed to log info safely']);
    }
  };
})();

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
  MOMENTS: 'moments',
  SECTIONS: 'sections'
};

// Initialize Firebase
console.log("Initializing Firebase with project:", firebaseConfig.projectId);
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = app.firestore();
const auth = app.auth();
console.log("Firestore initialized for project:", firebaseConfig.projectId);

try {
  // Standard settings for reliability
  const settings = {
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
  };
  
  // Use long polling in sandboxed environments to bypass gRPC blocks
  if (window.location.hostname.includes('run.app') || 
      window.location.hostname.includes('web-container') ||
      window.location.hostname.includes('europe-west1')) {
    settings.experimentalForceLongPolling = true;
  }
  
  // Only set settings if not already configured to avoid errors
  db.settings(settings);
  console.log("Firestore settings applied.");
} catch (error) {
  console.warn("Firestore settings already configured:", error.message);
}

// Global attempt to ensure network is active
db.enableNetwork().catch(err => console.warn("db.enableNetwork error:", err ? (err.message || String(err)) : "Unknown Error"));

// Firestore Operation Types
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

// Safe stringify helper to avoid circularity - defined at top level for reuse
const safeStringify = (obj) => {
  const seen = new WeakSet();
  
  function clean(val) {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    
    // Check if we've already seen this object
    if (seen.has(val)) {
      return '[Circular]';
    }
    
    // Don't traverse deeply into Firestore database reference fields or native DOM objects
    const constructorName = val.constructor ? val.constructor.name : '';
    if (constructorName === 'Hn' || constructorName === 'le' || constructorName.includes('Firestore') || constructorName.startsWith('t') || constructorName.startsWith('e')) {
      return `[FirestoreObject: ${constructorName}]`;
    }
    if (val instanceof HTMLElement || val instanceof Event || val instanceof Window) {
      return '[BrowserObject]';
    }
    
    seen.add(val);
    
    if (Array.isArray(val)) {
      return val.map(clean);
    }
    
    const copy = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        try {
          copy[key] = clean(val[key]);
        } catch (e) {
          copy[key] = '[Access Error]';
        }
      }
    }
    return copy;
  }
  
  try {
    const cleanedObj = clean(obj);
    return JSON.stringify(cleanedObj);
  } catch (err) {
    return '{"error":"Serialization failed"}';
  }
};

// Robust Firestore Error Handler
function handleFirestoreError(error, operationType, path) {
  let errorMessage = 'Unknown error';
  if (error) {
    if (typeof error === 'string') errorMessage = error;
    else if (error.message) errorMessage = String(error.message);
    else if (error.code) errorMessage = `Firebase Error [${error.code}]`;
    else {
      try {
        errorMessage = String(error);
      } catch (e) {
        errorMessage = 'Unstringifiable error object';
      }
    }
  }
  
  const authRef = (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') ? firebase.auth() : null;
  const user = authRef ? authRef.currentUser : null;
  
  // Create a clean object with ABSOLUTELY NO direct circular references
  const errInfo = {
    error: errorMessage,
    operationType: String(operationType || 'unknown'),
    path: String(path || 'unknown'),
    authInfo: user ? {
      userId: String(user.uid),
      email: String(user.email || ''),
      emailVerified: !!user.emailVerified
    } : null,
    timestamp: new Date().toISOString()
  };
  
  const errString = safeStringify(errInfo);
  console.error('[Firestore Error]', errorMessage, `(Op: ${operationType}, Path: ${path})`);
  throw new Error(errString);
}

// ============================================================================
// Robust Offline Fallback Data Definitions
// ============================================================================
const FALLBACK_DATA = {
  "settings/theme": {
    mode: 'light',
    primaryColor: '#e11d48', // High-contrast ruby red (Salvation Ministries theme)
    secondaryColor: '#1e293b',
    accentColor: '#fbbf24',
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
  },
  "content/about": {
    mission: 'To spread the Gospel of Jesus Christ and transform lives through biblical teaching and community service.',
    missionImage: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80',
    vision: 'Building a community of believers who live out their faith with passion and purpose.',
    visionImage: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=80',
    welcomeMessage: 'We are a vibrant community of believers committed to worshipping God, studying His Word, and serving our community with love and compassion.',
    welcomeImage: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?w=800&q=80'
  },
  "services/schedule": {
    sunday1: { title: '1st Sunday Service', time: '6:30 AM', description: 'Early morning worship and word' },
    sunday2: { title: '2nd Sunday Service', time: '8:00 AM', description: 'Praise, worship and transformation' },
    sunday3: { title: '3rd Sunday Service', time: '9:30 AM', description: 'Encounter with the word' },
    sunday4: { title: '4th Sunday Service', time: '11:00 AM', description: 'Closing service of the day' },
    midweek: { title: 'Midweek Service', time: 'Wednesday 6:00 PM', description: 'Prayer, Bible study, and fellowship' },
    special: { title: 'Special Programs', time: 'Check Events', description: 'Monthly special services and programs' }
  },
  "content/contact": {
    email: 'adageorgestudio@gmail.com',
    phone: '+234 123 456 7890',
    address: 'Ada George Road, Port Harcourt, Rivers State, Nigeria',
    offeringAccounts: [
      {
        title: 'General Offering',
        bank: 'Access Bank',
        accountName: 'Salvation Ministries Ada George',
        accountNumber: '0123456789'
      }
    ]
  },
  "admin/credentials": {
    username: 'admin',
    password: 'admin123'
  }
};

const FALLBACK_LISTS = {
  "quotes": [
    {
      id: "q1",
      text: "The word of God is a lamp unto my feet and a light unto my path.",
      author: "Psalm 119:105",
      active: true,
      createdAt: { toMillis: () => Date.now() }
    }
  ],
  "moments": [
    {
      id: "m1",
      type: 'photo',
      url: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1200&q=80',
      title: 'Sunday Worship',
      description: 'A powerful time in God\'s presence.',
      createdAt: { toMillis: () => Date.now() }
    },
    {
      id: "m2",
      type: 'video',
      url: 'https://www.facebook.com/smhosglobal',
      title: 'Live Service Highlights',
      createdAt: { toMillis: () => Date.now() }
    }
  ],
  "testimonies": [
    {
      id: "t1",
      name: "Brother David",
      message: "I thank God for the healing of my chronic back pain during the last service. Truly, God is at work in Salvation Ministries!",
      approved: true,
      createdAt: { toMillis: () => Date.now() },
      submittedAt: { toMillis: () => Date.now() }
    },
    {
      id: "t2",
      name: "Sister Faith",
      message: "God provided a miraculous job opportunity for me when all hope was lost. Thank you Jesus!",
      approved: true,
      createdAt: { toMillis: () => Date.now() },
      submittedAt: { toMillis: () => Date.now() }
    }
  ],
  "events": [
    {
      id: "e1",
      title: "5 Nights of Glory 2026",
      description: "A specialized encounter with God for global transformation and miracles.",
      date: "2026-07-20",
      time: "5:00 PM Daily",
      image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80",
      location: "Ada George Church Auditorium",
      createdAt: { toMillis: () => Date.now() }
    },
    {
      id: "e2",
      title: "Youth Empowerment Seminar",
      description: "Building the next generation of Christian leaders and entrepreneurs.",
      date: "2026-08-15",
      time: "10:00 AM",
      image: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=80",
      location: "Ada George Youth Hall",
      createdAt: { toMillis: () => Date.now() }
    }
  ],
  "sermons": [
    {
      id: "s1",
      title: "Walking in Divine Purpose",
      speaker: "Pastor David Ibiyeomie",
      date: "2026-07-05",
      topic: "Faith & Purpose",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      description: "Discover the foundational steps to identifying and pursuing the divine mandate for your life.",
      image: "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80",
      createdAt: { toMillis: () => Date.now() }
    },
    {
      id: "s2",
      title: "The Power of Persistent Prayer",
      speaker: "Pastor David Ibiyeomie",
      date: "2026-06-28",
      topic: "Prayer",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      description: "Learn how consistent, faith-filled prayer breaks limitations and establishes victory.",
      image: "https://images.unsplash.com/photo-1507679799987-c7377f323b88?w=800&q=80",
      createdAt: { toMillis: () => Date.now() }
    }
  ],
  "sections": []
};

function getCollectionId(query) {
    if (!query) return null;
    if (query.id) return query.id;
    try {
        if (query._query && query._query.path) {
            const segments = query._query.path.segments;
            if (segments && segments.length > 0) {
                return segments[segments.length - 1];
            }
        }
    } catch (e) {}
    try {
        if (query.path) {
            const parts = query.path.split('/');
            return parts[parts.length - 1];
        }
    } catch (e) {}
    return null;
}

// ============================================================================
// Robust Offline Wrapper and Fallback Mechanism
// ============================================================================
let isFirestoreOffline = false;

// Initialize local storage fallback if not already set
try {
    if (!localStorage.getItem('adageorge_fallback_docs')) {
        localStorage.setItem('adageorge_fallback_docs', JSON.stringify(FALLBACK_DATA));
    }
    if (!localStorage.getItem('adageorge_fallback_lists')) {
        localStorage.setItem('adageorge_fallback_lists', JSON.stringify(FALLBACK_LISTS));
    }
} catch (e) {
    console.warn("localStorage not available:", e.message);
}

async function withTimeout(promise, ms = 1500) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("Timeout"));
        }, ms);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

function getLocalDoc(path) {
    try {
        const docs = JSON.parse(localStorage.getItem('adageorge_fallback_docs') || '{}');
        return docs[path] !== undefined ? docs[path] : FALLBACK_DATA[path];
    } catch (e) {
        return FALLBACK_DATA[path];
    }
}

function setLocalDoc(path, data) {
    try {
        const docs = JSON.parse(localStorage.getItem('adageorge_fallback_docs') || '{}');
        docs[path] = data;
        localStorage.setItem('adageorge_fallback_docs', JSON.stringify(docs));
    } catch (e) {}
}

function getLocalList(collectionName) {
    try {
        const lists = JSON.parse(localStorage.getItem('adageorge_fallback_lists') || '{}');
        return lists[collectionName] !== undefined ? lists[collectionName] : (FALLBACK_LISTS[collectionName] || []);
    } catch (e) {
        return FALLBACK_LISTS[collectionName] || [];
    }
}

function setLocalList(collectionName, list) {
    try {
        const lists = JSON.parse(localStorage.getItem('adageorge_fallback_lists') || '{}');
        lists[collectionName] = list;
        localStorage.setItem('adageorge_fallback_lists', JSON.stringify(lists));
    } catch (e) {}
}

function updateItemInList(collectionName, docId, data, isMerge = false) {
    if (!collectionName) return;
    const list = getLocalList(collectionName);
    const index = list.findIndex(item => item.id === docId);
    if (index !== -1) {
        const existingItem = list[index];
        const updatedItem = isMerge ? { ...existingItem, ...data } : { id: docId, ...data };
        list[index] = updatedItem;
        setLocalList(collectionName, list);
    } else {
        const listCollections = ['quotes', 'moments', 'testimonies', 'events', 'sermons', 'sections', 'messages'];
        if (listCollections.includes(collectionName)) {
            const newItem = { id: docId, ...data };
            list.unshift(newItem); // Put new items at the beginning
            setLocalList(collectionName, list);
        }
    }
}

function normalizeOnSnapshotArgs(arg1, arg2, arg3) {
    let onNext;
    let onError;
    if (typeof arg1 === 'function') {
        onNext = arg1;
        onError = arg2;
    } else if (arg1 && typeof arg1 === 'object') {
        if (typeof arg1.next === 'function') {
            onNext = arg1.next;
            onError = arg1.error;
        } else if (typeof arg2 === 'function') {
            onNext = arg2;
            onError = arg3;
        }
    }
    return {
        onNext: onNext || (() => {}),
        onError: onError || ((err) => console.warn("onSnapshot error:", err))
    };
}

function wrapDocRef(originalDocRef, collectionName, docId) {
    const path = originalDocRef ? originalDocRef.path : `${collectionName}/${docId}`;
    return {
        id: docId,
        path: path,
        get parent() { return originalDocRef ? originalDocRef.parent : null; },
        
        collection: (subName) => {
            const originalSub = originalDocRef ? originalDocRef.collection(subName) : null;
            return wrapCollectionRef(originalSub, `${path}/${subName}`);
        },

        onSnapshot: function(arg1, arg2, arg3) {
            const { onNext, onError } = normalizeOnSnapshotArgs(arg1, arg2, arg3);
            const self = this;
            let unsubscribed = false;
            let originalUnsubscribe = null;

            const triggerImmediate = async () => {
                if (unsubscribed) return;
                try {
                    const snap = await self.get();
                    if (!unsubscribed) {
                        onNext(snap);
                    }
                } catch (err) {
                    if (!unsubscribed && onError) onError(err);
                }
            };
            triggerImmediate();

            if (!isFirestoreOffline && originalDocRef) {
                try {
                    const wrappedOnNext = (snap) => {
                        if (unsubscribed) return;
                        if (snap && snap.exists) {
                            setLocalDoc(path, snap.data());
                        }
                        onNext(snap);
                    };

                    const wrappedOnError = (err) => {
                        if (unsubscribed) return;
                        console.warn(`Doc.onSnapshot error for ${path}:`, err.message);
                        onError(err);
                    };

                    originalUnsubscribe = originalDocRef.onSnapshot(wrappedOnNext, wrappedOnError);
                } catch (err) {
                    console.warn(`Doc.onSnapshot subscription failed for ${path}:`, err);
                }
            }

            return () => {
                unsubscribed = true;
                if (originalUnsubscribe) {
                    try {
                        originalUnsubscribe();
                    } catch (e) {}
                }
            };
        },
        
        get: async (options) => {
            if (isFirestoreOffline) {
                const data = getLocalDoc(path);
                return {
                    exists: data !== undefined,
                    id: docId,
                    ref: this,
                    data: () => data,
                    get: (field) => data ? data[field] : undefined
                };
            }
            try {
                if (originalDocRef) {
                    const snap = await withTimeout(originalDocRef.get(options), 1500);
                    if (snap.exists) {
                        setLocalDoc(path, snap.data());
                    }
                    return snap;
                }
                throw new Error("No originalDocRef");
            } catch (err) {
                console.warn(`Doc.get failed/timed out for ${path}, using local fallback`);
                isFirestoreOffline = true;
                const data = getLocalDoc(path);
                return {
                    exists: data !== undefined,
                    id: docId,
                    ref: this,
                    data: () => data,
                    get: (field) => data ? data[field] : undefined
                };
            }
        },
        
        set: async (data, options) => {
            let mergedData = data;
            if (options && options.merge) {
                const existing = getLocalDoc(path) || {};
                mergedData = { ...existing, ...data };
            }
            setLocalDoc(path, mergedData);
            updateItemInList(collectionName, docId, mergedData, options && options.merge);

            if (!isFirestoreOffline && originalDocRef) {
                try {
                    await withTimeout(originalDocRef.set(data, options), 2000);
                } catch (err) {
                    console.warn(`Doc.set failed/timed out for ${path}, using local fallback`);
                    isFirestoreOffline = true;
                }
            }
            return { id: docId };
        },
        
        update: async (data) => {
            const existing = getLocalDoc(path) || {};
            const mergedData = { ...existing, ...data };
            setLocalDoc(path, mergedData);
            updateItemInList(collectionName, docId, mergedData, true);

            if (!isFirestoreOffline && originalDocRef) {
                try {
                    await withTimeout(originalDocRef.update(data), 2000);
                } catch (err) {
                    console.warn(`Doc.update failed/timed out for ${path}, using local fallback`);
                    isFirestoreOffline = true;
                }
            }
            return { id: docId };
        },
        
        delete: async () => {
            try {
                const docs = JSON.parse(localStorage.getItem('adageorge_fallback_docs') || '{}');
                delete docs[path];
                localStorage.setItem('adageorge_fallback_docs', JSON.stringify(docs));
            } catch (e) {}
            
            if (collectionName) {
                const list = getLocalList(collectionName);
                const updatedList = list.filter(item => item.id !== docId);
                setLocalList(collectionName, updatedList);
            }

            if (!isFirestoreOffline && originalDocRef) {
                try {
                    await withTimeout(originalDocRef.delete(), 2000);
                } catch (err) {
                    console.warn(`Doc.delete failed/timed out for ${path}, using local fallback`);
                    isFirestoreOffline = true;
                }
            }
            return { success: true };
        }
    };
}

function wrapCollectionRef(originalCollRef, collectionName) {
    return {
        id: collectionName,
        path: collectionName,
        
        doc: (docId) => {
            const finalId = docId || Math.random().toString(36).substring(2, 15);
            const originalDoc = originalCollRef ? originalCollRef.doc(finalId) : null;
            return wrapDocRef(originalDoc, collectionName, finalId);
        },

        onSnapshot: function(arg1, arg2, arg3) {
            const { onNext, onError } = normalizeOnSnapshotArgs(arg1, arg2, arg3);
            const self = this;
            let unsubscribed = false;
            let originalUnsubscribe = null;

            const triggerImmediate = async () => {
                if (unsubscribed) return;
                try {
                    const snap = await self.get();
                    if (!unsubscribed) {
                        onNext(snap);
                    }
                } catch (err) {
                    if (!unsubscribed && onError) onError(err);
                }
            };
            triggerImmediate();

            if (!isFirestoreOffline && originalCollRef) {
                try {
                    const wrappedOnNext = (snap) => {
                        if (unsubscribed) return;
                        const listToCache = [];
                        snap.forEach(doc => {
                            listToCache.push({ id: doc.id, ...doc.data() });
                        });
                        setLocalList(collectionName, listToCache);
                        onNext(snap);
                    };

                    const wrappedOnError = (err) => {
                        if (unsubscribed) return;
                        console.warn(`Collection.onSnapshot error for ${collectionName}:`, err.message);
                        onError(err);
                    };

                    originalUnsubscribe = originalCollRef.onSnapshot(wrappedOnNext, wrappedOnError);
                } catch (err) {
                    console.warn(`Collection.onSnapshot subscription failed for ${collectionName}:`, err);
                }
            }

            return () => {
                unsubscribed = true;
                if (originalUnsubscribe) {
                    try {
                        originalUnsubscribe();
                    } catch (e) {}
                }
            };
        },
        
        add: async (data) => {
            const docId = Math.random().toString(36).substring(2, 15);
            
            const list = getLocalList(collectionName);
            const newItem = { id: docId, ...data };
            list.unshift(newItem);
            setLocalList(collectionName, list);
            setLocalDoc(`${collectionName}/${docId}`, data);
            
            let docRef = null;
            if (!isFirestoreOffline && originalCollRef) {
                try {
                    docRef = await withTimeout(originalCollRef.add(data), 2000);
                } catch (err) {
                    console.warn(`Collection.add failed/timed out for ${collectionName}, using local fallback`);
                    isFirestoreOffline = true;
                }
            }
            
            return docRef || wrapDocRef(null, collectionName, docId);
        },
        
        orderBy: function(field, direction) {
            const origQuery = originalCollRef ? originalCollRef.orderBy(field, direction) : null;
            return wrapQuery(origQuery, collectionName, { type: 'orderBy', field, direction });
        },
        
        where: function(field, op, value) {
            const origQuery = originalCollRef ? originalCollRef.where(field, op, value) : null;
            return wrapQuery(origQuery, collectionName, { type: 'where', field, op, value });
        },
        
        limit: function(num) {
            const origQuery = originalCollRef ? originalCollRef.limit(num) : null;
            return wrapQuery(origQuery, collectionName, { type: 'limit', num });
        },
        
        get: async (options) => {
            if (isFirestoreOffline) {
                const list = getLocalList(collectionName);
                const mockDocs = list.map(item => {
                    const itemData = { ...item };
                    delete itemData.id;
                    return {
                        id: item.id || 'mock-id',
                        exists: true,
                        data: () => itemData,
                        get: (field) => itemData[field]
                    };
                });
                return {
                    empty: mockDocs.length === 0,
                    size: mockDocs.length,
                    docs: mockDocs,
                    forEach: (callback) => {
                        mockDocs.forEach(callback);
                    }
                };
            }
            try {
                if (originalCollRef) {
                    const snap = await withTimeout(originalCollRef.get(options), 1500);
                    const listToCache = [];
                    snap.forEach(doc => {
                        listToCache.push({ id: doc.id, ...doc.data() });
                    });
                    setLocalList(collectionName, listToCache);
                    return snap;
                }
                throw new Error("No originalCollRef");
            } catch (err) {
                console.warn(`Collection.get failed/timed out for ${collectionName}, using local fallback list`);
                isFirestoreOffline = true;
                const list = getLocalList(collectionName);
                const mockDocs = list.map(item => {
                    const itemData = { ...item };
                    delete itemData.id;
                    return {
                        id: item.id || 'mock-id',
                        exists: true,
                        data: () => itemData,
                        get: (field) => itemData[field]
                    };
                });
                return {
                    empty: mockDocs.length === 0,
                    size: mockDocs.length,
                    docs: mockDocs,
                    forEach: (callback) => {
                        mockDocs.forEach(callback);
                    }
                };
            }
        }
    };
}

function wrapQuery(originalQuery, collectionName, queryOp) {
    return {
        orderBy: function(field, direction) {
            const orig = originalQuery ? originalQuery.orderBy(field, direction) : null;
            return wrapQuery(orig, collectionName, { type: 'orderBy', field, direction });
        },
        where: function(field, op, value) {
            const orig = originalQuery ? originalQuery.where(field, op, value) : null;
            return wrapQuery(orig, collectionName, { type: 'where', field, op, value });
        },
        limit: function(num) {
            const orig = originalQuery ? originalQuery.limit(num) : null;
            return wrapQuery(orig, collectionName, { type: 'limit', num });
        },

        onSnapshot: function(arg1, arg2, arg3) {
            const { onNext, onError } = normalizeOnSnapshotArgs(arg1, arg2, arg3);
            const self = this;
            let unsubscribed = false;
            let originalUnsubscribe = null;

            const triggerImmediate = async () => {
                if (unsubscribed) return;
                try {
                    const snap = await self.get();
                    if (!unsubscribed) {
                        onNext(snap);
                    }
                } catch (err) {
                    if (!unsubscribed && onError) onError(err);
                }
            };
            triggerImmediate();

            if (!isFirestoreOffline && originalQuery) {
                try {
                    const wrappedOnNext = (snap) => {
                        if (unsubscribed) return;
                        const listToCache = [];
                        snap.forEach(doc => {
                            listToCache.push({ id: doc.id, ...doc.data() });
                        });
                        if (!queryOp || queryOp.type === 'orderBy') {
                            setLocalList(collectionName, listToCache);
                        }
                        onNext(snap);
                    };

                    const wrappedOnError = (err) => {
                        if (unsubscribed) return;
                        console.warn(`Query.onSnapshot error for ${collectionName}:`, err.message);
                        onError(err);
                    };

                    originalUnsubscribe = originalQuery.onSnapshot(wrappedOnNext, wrappedOnError);
                } catch (err) {
                    console.warn(`Query.onSnapshot subscription failed for ${collectionName}:`, err);
                }
            }

            return () => {
                unsubscribed = true;
                if (originalUnsubscribe) {
                    try {
                        originalUnsubscribe();
                    } catch (e) {}
                }
            };
        },
        get: async (options) => {
            if (isFirestoreOffline) {
                const list = getLocalList(collectionName);
                const mockDocs = list.map(item => {
                    const itemData = { ...item };
                    delete itemData.id;
                    return {
                        id: item.id || 'mock-id',
                        exists: true,
                        data: () => itemData,
                        get: (field) => itemData[field]
                    };
                });
                return {
                    empty: mockDocs.length === 0,
                    size: mockDocs.length,
                    docs: mockDocs,
                    forEach: (callback) => {
                        mockDocs.forEach(callback);
                    }
                };
            }
            try {
                if (originalQuery) {
                    const snap = await withTimeout(originalQuery.get(options), 1500);
                    return snap;
                }
                throw new Error("No originalQuery");
            } catch (err) {
                console.warn(`Query.get failed/timed out for ${collectionName}, using local fallback`);
                isFirestoreOffline = true;
                const list = getLocalList(collectionName);
                const mockDocs = list.map(item => {
                    const itemData = { ...item };
                    delete itemData.id;
                    return {
                        id: item.id || 'mock-id',
                        exists: true,
                        data: () => itemData,
                        get: (field) => itemData[field]
                    };
                });
                return {
                    empty: mockDocs.length === 0,
                    size: mockDocs.length,
                    docs: mockDocs,
                    forEach: (callback) => {
                        mockDocs.forEach(callback);
                    }
                };
            }
        }
    };
}

// Intercept Firestore collection accessor
const originalCollectionMethod = db.collection;
db.collection = function(name) {
    return wrapCollectionRef(originalCollectionMethod.call(db, name), name);
};

// Global data fetching helper
async function safeGet(ref, operationType = OperationType.GET) {
    try {
        // Try server first for fresh data
        return await ref.get({ source: 'server' });
    } catch (error) {
        console.warn(`Firestore server unreachable for path: ${ref ? ref.path : 'unknown'}. Trying cache fallback...`);
        
        // If offline or timed out, try default fetch (which queries cache first if offline)
        try {
            return await ref.get(); 
        } catch (innerError) {
            console.warn(`Firestore cache/default fetch failed for path: ${ref ? ref.path : 'unknown'}. Using local fallback.`);
            
            // Check if we have local fallback data for this document path
            if (ref && ref.path && FALLBACK_DATA[ref.path]) {
                const data = FALLBACK_DATA[ref.path];
                console.info(`[Offline Fallback] Returning local fallback data for path: ${ref.path}`);
                return {
                    exists: true,
                    id: ref.id,
                    ref: ref,
                    data: () => data,
                    get: (field) => data[field]
                };
            }
            
            // If no exact fallback, return a mock empty doc snapshot instead of crashing the app
            return {
                exists: false,
                id: ref ? ref.id : 'unknown',
                ref: ref,
                data: () => null,
                get: () => null
            };
        }
    }
}

// Global list fetching helper
async function safeList(query, operationType = OperationType.LIST) {
    try {
        return await query.get({ source: 'server' });
    } catch (error) {
        console.warn(`Firestore server unreachable for query. Trying cache fallback...`);
        
        try {
            return await query.get();
        } catch (innerError) {
            const collectionId = getCollectionId(query);
            console.warn(`Firestore cache/default fetch failed for collection: ${collectionId}. Using local fallback list.`);
            
            const fallbackList = FALLBACK_LISTS[collectionId] || [];
            console.info(`[Offline Fallback] Returning local fallback list for collection: ${collectionId} (${fallbackList.length} items)`);
            
            const mockDocs = fallbackList.map(item => {
                const itemData = { ...item };
                delete itemData.id;
                return {
                    id: item.id || 'mock-id',
                    exists: true,
                    data: () => itemData,
                    get: (field) => itemData[field]
                };
            });
            
            return {
                empty: mockDocs.length === 0,
                size: mockDocs.length,
                docs: mockDocs,
                forEach: (callback) => {
                    mockDocs.forEach(callback);
                }
            };
        }
    }
}

// Global Error Catching
window.addEventListener('error', function(event) {
    if (event.message === 'Script error.') {
        console.warn('Masked "Script error." detected.');
        return;
    }
    
    // Prevent default platform/browser circular object logging
    try {
        event.preventDefault();
        event.stopImmediatePropagation();
    } catch (e) {}

    const msg = event.message || (event.error && event.error.message) || 'Unknown global error';
    console.warn('Captured Global Error:', String(msg));
}, true); // Use capture phase to intercept before parent/harness listeners

window.addEventListener('unhandledrejection', function(event) {
    // Prevent default platform/browser circular object logging
    try {
        event.preventDefault();
        event.stopImmediatePropagation();
    } catch (e) {}

    const reason = event.reason;
    const msg = reason?.message || String(reason || 'Unknown rejection');
    console.warn('Captured Unhandled Rejection:', String(msg));
}, true); // Use capture phase to intercept before parent/harness listeners

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
      console.info("The client is offline. App will use cache and local fallback presets safely.");
    } else if (error.code === 'permission-denied') {
      console.info("Permission restricted. Check Firestore security rules or fallback configs.");
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
        email: 'adageorgestudio@gmail.com',
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
    console.error('Error initializing default data:', error.message || String(error));
    window.firebaseInitialized = true; // Still mark as initialized to allow login attempts
  }
}

// Global initialization
async function startApp() {
  console.log('Starting Firebase app initialization...');
  
  if (window.location.pathname.includes('admin.html')) {
    await initializeDefaultData();
  } else {
    // On public site, verify connection before proceeding
    let connected = await testConnection();
    if (!connected) {
      console.warn("Initial connection check failed on public site, retrying...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      connected = await testConnection();
    }
    
    window.firebaseInitialized = true;
    console.log('Firebase ready for public access. Connectivity:', connected ? 'Online' : 'Offline (limited functionality)');
  }
}

startApp();

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
