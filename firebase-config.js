// Firebase Configuration & Initialization
// Pure Vanilla JS - Firebase v8 Compatibility Build

const firebaseConfig = {
  apiKey: "AIzaSyBGDT1IZGFR0ravirAC-jpcuj4Y9Uuipks",
  authDomain: "adageorge-35236.firebaseapp.com",
  projectId: "adageorge-35236",
  storageBucket: "adageorge-35236.firebasestorage.app",
  messagingSenderId: "397933347333",
  appId: "1:397933347333:web:316bacd8dc69b56f7fd26c",
  measurementId: "G-6PPH3KWEXY"
};

// Initialize Firebase (v8 compat - loaded via script tags in HTML)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// Enable offline persistence
try {
  db.enablePersistence({ synchronizeTabs: true });
} catch (err) {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence can only be enabled in one tab
    console.warn('Firestore persistence: Multiple tabs detected, using single-tab mode.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence: Browser does not support persistence.');
  }
}

// Long polling fallback for sandboxed environments
try {
  db.settings({ experimentalForceLongPolling: true });
} catch (e) {
  // Settings may already be configured
}

// ── Console Circularity Guard ──────────────────────────────
const _seen = new WeakSet();
function _sanitize(obj, depth) {
  depth = depth || 0;
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (_seen.has(obj)) return '[Circular]';
  _seen.add(obj);
  if (Array.isArray(obj)) return obj.map(function(v) { return _sanitize(v, depth + 1); });
  var out = {};
  for (var k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    var v = obj[k];
    if (typeof v === 'function') continue;
    try {
      var proto = Object.getPrototypeOf(v);
      if (proto && proto.constructor && proto.constructor.name &&
          ['Object', 'Array', 'Date'].indexOf(proto.constructor.name) === -1) continue;
    } catch (e) { /* skip */ }
    out[k] = _sanitize(v, depth + 1);
  }
  return out;
}

var safeLog = function() {
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, args.map(function(a) { return _sanitize(a); }));
};
var safeWarn = function() {
  var args = Array.prototype.slice.call(arguments);
  console.warn.apply(console, args.map(function(a) { return _sanitize(a); }));
};
var safeError = function() {
  var args = Array.prototype.slice.call(arguments);
  console.error.apply(console, args.map(function(a) { return _sanitize(a); }));
};
