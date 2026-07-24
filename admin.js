// ═══════════════════════════════════════════════════════════════
// Admin CMS — Ada George Church
// Pure Vanilla JS with Firebase v8 (Firestore)
// ═══════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────
var AdminState = {
  authenticated: false,
  currentPanel: 'dashboard',
  sermons: [],
  events: [],
  quotes: [],
  testimonies: [],
  messages: [],
  sections: [],
  theme: {},
  hero: {},
  editingSermon: null,
  editingEvent: null,
  editingQuote: null,
  editingSection: null,
  testimonyFilter: 'all',
  messageFilter: 'new'
};

// ── Local Storage Helpers ──────────────────────────────────
var LS_PREFIX = 'church_';

function lsKey(collection, id) {
  return id ? LS_PREFIX + collection + '_' + id : LS_PREFIX + collection + '_all';
}

function lsGet(key) {
  try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch (e) { return null; }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('localstorage_data_changed', { detail: { key: key } }));
    // Cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', { key: key, storageArea: localStorage }));
  } catch (e) {}
}

function dispatchSync(collectionName) {
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: lsKey(collectionName),
      storageArea: localStorage
    }));
  } catch (e) {}
}

// ── Toast Notifications ───────────────────────────────────
function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 4000);
}

// ── Data Operations ───────────────────────────────────────
function safeGet(collectionName, docId) {
  var key = lsKey(collectionName, docId);
  var cached = lsGet(key);
  db.collection(collectionName).doc(docId).get().then(function(snap) {
    if (snap.exists) {
      var data = Object.assign({ id: snap.id }, snap.data());
      lsSet(key, data);
    }
  }).catch(function(err) { console.error('safeGet error:', err); });
  return cached;
}

function safeList(collectionName, orderField, limitCount) {
  orderField = orderField || 'createdAt';
  limitCount = limitCount || 50;
  var key = lsKey(collectionName);
  var cached = lsGet(key) || [];
  db.collection(collectionName).orderBy(orderField, 'desc').limit(limitCount).get().then(function(snap) {
    var items = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    lsSet(key, items);
  }).catch(function(err) { console.error('safeList error:', err); });
  return cached;
}

function safeAdd(collectionName, data) {
  return db.collection(collectionName).add(Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .then(function(ref) {
      var item = Object.assign({ id: ref.id }, data);
      var key = lsKey(collectionName);
      var list = lsGet(key) || [];
      lsSet(key, [item].concat(list));
      dispatchSync(collectionName);
      return ref.id;
    });
}

function safeUpdate(collectionName, docId, data) {
  return db.collection(collectionName).doc(docId).update(Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .then(function() {
      var key = lsKey(collectionName, docId);
      var existing = lsGet(key);
      if (existing) lsSet(key, Object.assign({}, existing, data));
      var listKey = lsKey(collectionName);
      var list = lsGet(listKey) || [];
      var updated = list.map(function(item) {
        return item.id === docId ? Object.assign({}, item, data) : item;
      });
      lsSet(listKey, updated);
      dispatchSync(collectionName);
    });
}

function safeDelete(collectionName, docId) {
  return db.collection(collectionName).doc(docId).delete()
    .then(function() {
      try { localStorage.removeItem(lsKey(collectionName, docId)); } catch(e){}
      var listKey = lsKey(collectionName);
      var list = lsGet(listKey) || [];
      lsSet(listKey, list.filter(function(item) { return item.id !== docId; }));
      dispatchSync(collectionName);
    });
}

// ── Authentication ────────────────────────────────────────
function initAuth() {
  var saved = lsGet('church_admin_auth');
  if (saved) {
    AdminState.authenticated = true;
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('adminLayout').classList.remove('hidden');
    loadAllData();
  }
}

function handleLogin(e) {
  e.preventDefault();
  var password = document.getElementById('loginPassword').value;
  var errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  // Try Firestore credentials first
  db.collection('admin').doc('credentials').get().then(function(snap) {
    if (snap.exists && snap.data().password === password) {
      loginSuccess();
    } else {
      // Master passphrase fallback
      if (password === 'adageorge2024') {
        loginSuccess();
      } else {
        errorEl.textContent = 'Invalid password. Please try again.';
      }
    }
  }).catch(function() {
    // If Firestore fails, try master passphrase
    if (password === 'adageorge2024') {
      loginSuccess();
    } else {
      errorEl.textContent = 'Invalid password. Please try again.';
    }
  });
}

function loginSuccess() {
  AdminState.authenticated = true;
  lsSet('church_admin_auth', { loggedIn: true, timestamp: Date.now() });
  document.getElementById('loginModal').classList.add('hidden');
  document.getElementById('adminLayout').classList.remove('hidden');
  showToast('Welcome to the Admin CMS!', 'success');
  loadAllData();
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    AdminState.authenticated = false;
    try { localStorage.removeItem('church_admin_auth'); } catch(e){}
    location.reload();
  }
}

// ── Password Toggle ────────────────────────────────────────
function initPasswordToggle() {
  var toggle = document.getElementById('passwordToggle');
  var input = document.getElementById('loginPassword');
  var visible = false;
  toggle.addEventListener('click', function() {
    visible = !visible;
    input.type = visible ? 'text' : 'password';
    toggle.innerHTML = visible
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
}

// ── Panel Navigation ──────────────────────────────────────
function initPanelNav() {
  var links = document.querySelectorAll('#sidebarNav a[data-panel]');
  links.forEach(function(link) {
    link.addEventListener('click', function() {
      var panel = this.getAttribute('data-panel');
      switchPanel(panel);
    });
  });
}

function switchPanel(panelName) {
  AdminState.currentPanel = panelName;

  // Update sidebar active
  document.querySelectorAll('#sidebarNav a').forEach(function(a) { a.classList.remove('active'); });
  var activeLink = document.querySelector('#sidebarNav a[data-panel="' + panelName + '"]');
  if (activeLink) activeLink.classList.add('active');

  // Show/hide panels
  document.querySelectorAll('.admin-panel').forEach(function(p) { p.classList.remove('active'); });
  var panelMap = {
    'dashboard': 'panelDashboard',
    'theme': 'panelTheme',
    'hero': 'panelHero',
    'about': 'panelAbout',
    'contactInfo': 'panelContactInfo',
    'sermons': 'panelSermons',
    'events': 'panelEvents',
    'quotes': 'panelQuotes',
    'testimonies': 'panelTestimonies',
    'messages': 'panelMessages',
    'sections': 'panelSections'
  };
  var panelEl = document.getElementById(panelMap[panelName]);
  if (panelEl) panelEl.classList.add('active');

  // Update title
  var titles = {
    'dashboard': 'Dashboard', 'theme': 'Theme Settings', 'hero': 'Hero & Content',
    'about': 'About Us', 'contactInfo': 'Contact Info', 'sermons': 'Sermon Manager',
    'events': 'Event Manager', 'quotes': 'Quote Manager', 'testimonies': 'Testimony Manager',
    'messages': 'Messages Inbox', 'sections': 'Section Builder'
  };
  document.getElementById('panelTitle').textContent = titles[panelName] || 'Dashboard';
}

// ── Load All Data ─────────────────────────────────────────
function loadAllData() {
  // Theme
  AdminState.theme = safeGet('settings', 'theme') || {};
  populateThemeForm();

  // Hero
  AdminState.hero = safeGet('content', 'hero') || {};
  populateHeroForm();

  // About
  var about = safeGet('content', 'about') || {};
  populateAboutForm(about);

  // Contact Info
  var contact = safeGet('content', 'contact') || {};
  populateContactForm(contact);

  // Collections
  AdminState.sermons = safeList('sermons', 'createdAt', 50);
  AdminState.events = safeList('events', 'createdAt', 50);
  AdminState.quotes = safeList('quotes', 'createdAt', 50);
  AdminState.testimonies = safeList('testimonies', 'createdAt', 50);
  AdminState.messages = safeList('messages', 'createdAt', 50);
  AdminState.sections = safeList('sections', 'order', 50);

  // After cache, fetch fresh and re-render
  setTimeout(function() {
    AdminState.sermons = lsGet(lsKey('sermons')) || AdminState.sermons;
    AdminState.events = lsGet(lsKey('events')) || AdminState.events;
    AdminState.quotes = lsGet(lsKey('quotes')) || AdminState.quotes;
    AdminState.testimonies = lsGet(lsKey('testimonies')) || AdminState.testimonies;
    AdminState.messages = lsGet(lsKey('messages')) || AdminState.messages;
    AdminState.sections = lsGet(lsKey('sections')) || AdminState.sections;
    renderAll();
  }, 1500);

  renderAll();
  updateStats();
}

function renderAll() {
  renderSermonsTable();
  renderEventsTable();
  renderQuotesTable();
  renderTestimoniesTable();
  renderMessagesTable();
  renderSectionsList();
  updateStats();
}

function updateStats() {
  document.getElementById('statSermons').textContent = AdminState.sermons.length;
  document.getElementById('statEvents').textContent = AdminState.events.length;
  document.getElementById('statQuotes').textContent = AdminState.quotes.filter(function(q) { return q.active; }).length;
  document.getElementById('statMessages').textContent = AdminState.messages.filter(function(m) { return m.status === 'new'; }).length;
}

// ── Theme Panel ────────────────────────────────────────────
function populateThemeForm() {
  var t = AdminState.theme;
  var pairs = [
    ['themePrimary', 'themePrimaryText', t.primaryColor || '#8B5E3C'],
    ['themeHover', 'themeHoverText', t.hoverColor || '#A0724D'],
    ['themeSecondary', 'themeSecondaryText', t.secondaryColor || '#F5E6D3'],
    ['themeAccent', 'themeAccentText', t.accentColor || '#C4956A']
  ];
  pairs.forEach(function(pair) {
    var color = document.getElementById(pair[0]);
    var text = document.getElementById(pair[1]);
    if (color) color.value = pair[2];
    if (text) text.value = pair[2];
  });

  setRange('themeRadius', 'themeRadiusVal', t.borderRadius || 12, 'px');
  setRange('themeFontScale', 'themeFontScaleVal', (t.fontScale || 1) * 100, '');
  document.getElementById('themeFontScaleVal').textContent = (t.fontScale || 1).toFixed(1);
  setRange('themeSpacing', 'themeSpacingVal', t.sectionSpacing || 80, 'px');
  document.getElementById('themeDarkMode').checked = !!t.darkMode;
  document.getElementById('themeLogo').value = t.logoUrl || '';
  document.getElementById('themeFavicon').value = t.faviconUrl || '';
}

function setRange(inputId, valId, value, suffix) {
  var input = document.getElementById(inputId);
  var val = document.getElementById(valId);
  if (input) input.value = value;
  if (val) val.textContent = value + suffix;
}

function initThemeSync() {
  var colorPairs = [
    ['themePrimary', 'themePrimaryText'],
    ['themeHover', 'themeHoverText'],
    ['themeSecondary', 'themeSecondaryText'],
    ['themeAccent', 'themeAccentText']
  ];
  colorPairs.forEach(function(pair) {
    var c = document.getElementById(pair[0]);
    var t = document.getElementById(pair[1]);
    if (c && t) {
      c.addEventListener('input', function() { t.value = c.value; });
      t.addEventListener('input', function() { c.value = t.value; });
    }
  });

  var ranges = [
    ['themeRadius', 'themeRadiusVal', 'px'],
    ['themeFontScale', 'themeFontScaleVal', ''],
    ['themeSpacing', 'themeSpacingVal', 'px']
  ];
  ranges.forEach(function(item) {
    var input = document.getElementById(item[0]);
    var val = document.getElementById(item[1]);
    if (input && val) {
      input.addEventListener('input', function() {
        var v = parseFloat(input.value);
        if (item[0] === 'themeFontScale') {
          val.textContent = (v / 100).toFixed(1);
        } else {
          val.textContent = v + item[2];
        }
      });
    }
  });
}

function handleThemeSave(e) {
  e.preventDefault();
  var themeData = {
    primaryColor: document.getElementById('themePrimary').value,
    hoverColor: document.getElementById('themeHover').value,
    secondaryColor: document.getElementById('themeSecondary').value,
    accentColor: document.getElementById('themeAccent').value,
    borderRadius: parseInt(document.getElementById('themeRadius').value),
    fontScale: parseInt(document.getElementById('themeFontScale').value) / 100,
    sectionSpacing: parseInt(document.getElementById('themeSpacing').value),
    darkMode: document.getElementById('themeDarkMode').checked,
    logoUrl: document.getElementById('themeLogo').value,
    faviconUrl: document.getElementById('themeFavicon').value
  };

  db.collection('settings').doc('theme').set(themeData).then(function() {
    lsSet(lsKey('settings', 'theme'), Object.assign({ id: 'theme' }, themeData));
    dispatchSync('settings');
    AdminState.theme = themeData;
    showToast('Theme saved successfully!', 'success');
  }).catch(function(err) {
    showToast('Error saving theme: ' + err.message, 'error');
  });
}

// ── Hero & Content Panels ─────────────────────────────────
function populateHeroForm() {
  var h = AdminState.hero;
  document.getElementById('heroHeadline').value = h.headline || '';
  document.getElementById('heroSubtitle').value = h.subtitle || '';
  document.getElementById('heroServiceTime').value = h.serviceTime || '';
  document.getElementById('heroWatchLive').value = h.watchLiveUrl || '';
  document.getElementById('heroBgImage').value = h.backgroundImage || '';
}

function handleHeroSave(e) {
  e.preventDefault();
  var heroData = {
    headline: document.getElementById('heroHeadline').value,
    subtitle: document.getElementById('heroSubtitle').value,
    serviceTime: document.getElementById('heroServiceTime').value,
    watchLiveUrl: document.getElementById('heroWatchLive').value,
    backgroundImage: document.getElementById('heroBgImage').value
  };
  db.collection('content').doc('hero').set(heroData).then(function() {
    lsSet(lsKey('content', 'hero'), Object.assign({ id: 'hero' }, heroData));
    dispatchSync('content');
    showToast('Hero content saved!', 'success');
  }).catch(function(err) { showToast('Error: ' + err.message, 'error'); });
}

function populateAboutForm(about) {
  document.getElementById('aboutMission').value = about.mission || '';
  document.getElementById('aboutVision').value = about.vision || '';
  document.getElementById('aboutHistory').value = about.history || '';
  document.getElementById('aboutPastors').value = about.pastors || '';
}

function handleAboutSave(e) {
  e.preventDefault();
  var data = {
    mission: document.getElementById('aboutMission').value,
    vision: document.getElementById('aboutVision').value,
    history: document.getElementById('aboutHistory').value,
    pastors: document.getElementById('aboutPastors').value
  };
  db.collection('content').doc('about').set(data).then(function() {
    lsSet(lsKey('content', 'about'), Object.assign({ id: 'about' }, data));
    dispatchSync('content');
    showToast('About content saved!', 'success');
  }).catch(function(err) { showToast('Error: ' + err.message, 'error'); });
}

function populateContactForm(contact) {
  document.getElementById('ciAddress').value = contact.address || '';
  document.getElementById('ciPhone').value = contact.phone || '';
  document.getElementById('ciEmail').value = contact.email || '';
  document.getElementById('ciMapUrl').value = contact.mapEmbedUrl || '';
  var social = contact.socialLinks || {};
  document.getElementById('ciFacebook').value = social.facebook || '';
  document.getElementById('ciInstagram').value = social.instagram || '';
  document.getElementById('ciTwitter').value = social.twitter || '';
  document.getElementById('ciYoutube').value = social.youtube || '';
}

function handleContactInfoSave(e) {
  e.preventDefault();
  var data = {
    address: document.getElementById('ciAddress').value,
    phone: document.getElementById('ciPhone').value,
    email: document.getElementById('ciEmail').value,
    mapEmbedUrl: document.getElementById('ciMapUrl').value,
    socialLinks: {
      facebook: document.getElementById('ciFacebook').value,
      instagram: document.getElementById('ciInstagram').value,
      twitter: document.getElementById('ciTwitter').value,
      youtube: document.getElementById('ciYoutube').value
    }
  };
  db.collection('content').doc('contact').set(data).then(function() {
    lsSet(lsKey('content', 'contact'), Object.assign({ id: 'contact' }, data));
    dispatchSync('content');
    showToast('Contact info saved!', 'success');
  }).catch(function(err) { showToast('Error: ' + err.message, 'error'); });
}

// ── Sermon Manager ─────────────────────────────────────────
function renderSermonsTable() {
  var tbody = document.getElementById('sermonsTableBody');
  if (!tbody) return;
  if (AdminState.sermons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:32px">No sermons yet. Click "Add Sermon" to create one.</td></tr>';
    return;
  }
  tbody.innerHTML = AdminState.sermons.map(function(s) {
    return '<tr>' +
      '<td><strong>' + escapeHtml(s.title || 'Untitled') + '</strong></td>' +
      '<td>' + escapeHtml(s.speaker || '-') + '</td>' +
      '<td>' + escapeHtml(s.date || '-') + '</td>' +
      '<td><span class="status-badge active">' + escapeHtml(s.type || 'video') + '</span></td>' +
      '<td>' +
        '<button class="action-btn edit" onclick="editSermon(\'' + s.id + '\')">Edit</button> ' +
        '<button class="action-btn delete" onclick="deleteSermon(\'' + s.id + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function openSermonModal(sermon) {
  AdminState.editingSermon = sermon;
  document.getElementById('sermonModalTitle').textContent = sermon ? 'Edit Sermon' : 'Add Sermon';
  document.getElementById('sermonTitle').value = sermon ? (sermon.title || '') : '';
  document.getElementById('sermonSpeaker').value = sermon ? (sermon.speaker || '') : '';
  document.getElementById('sermonDate').value = sermon ? (sermon.date || '') : '';
  document.getElementById('sermonVideoUrl').value = sermon ? (sermon.videoUrl || '') : '';
  document.getElementById('sermonAudioUrl').value = sermon ? (sermon.audioUrl || '') : '';
  document.getElementById('sermonSeries').value = sermon ? (sermon.series || '') : '';
  document.getElementById('sermonType').value = sermon ? (sermon.type || 'video') : 'video';
  document.getElementById('sermonNotesUrl').value = sermon ? (sermon.notesUrl || '') : '';
  document.getElementById('sermonEditModal').classList.add('open');
}

function editSermon(id) {
  var sermon = AdminState.sermons.find(function(s) { return s.id === id; });
  if (sermon) openSermonModal(sermon);
}

function handleSermonSave(e) {
  e.preventDefault();
  var data = {
    title: document.getElementById('sermonTitle').value,
    speaker: document.getElementById('sermonSpeaker').value,
    date: document.getElementById('sermonDate').value,
    videoUrl: document.getElementById('sermonVideoUrl').value,
    audioUrl: document.getElementById('sermonAudioUrl').value,
    series: document.getElementById('sermonSeries').value,
    type: document.getElementById('sermonType').value,
    notesUrl: document.getElementById('sermonNotesUrl').value
  };

  if (AdminState.editingSermon) {
    safeUpdate('sermons', AdminState.editingSermon.id, data).then(function() {
      var idx = AdminState.sermons.findIndex(function(s) { return s.id === AdminState.editingSermon.id; });
      if (idx > -1) AdminState.sermons[idx] = Object.assign({}, AdminState.sermons[idx], data);
      renderSermonsTable();
      updateStats();
      showToast('Sermon updated!', 'success');
      closeAllModals();
    });
  } else {
    safeAdd('sermons', data).then(function(id) {
      data.id = id;
      AdminState.sermons.unshift(data);
      renderSermonsTable();
      updateStats();
      showToast('Sermon added!', 'success');
      closeAllModals();
    });
  }
}

function deleteSermon(id) {
  if (!confirm('Delete this sermon?')) return;
  safeDelete('sermons', id).then(function() {
    AdminState.sermons = AdminState.sermons.filter(function(s) { return s.id !== id; });
    renderSermonsTable();
    updateStats();
    showToast('Sermon deleted.', 'success');
  });
}

// ── Event Manager ──────────────────────────────────────────
function renderEventsTable() {
  var tbody = document.getElementById('eventsTableBody');
  if (!tbody) return;
  if (AdminState.events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:32px">No events yet.</td></tr>';
    return;
  }
  tbody.innerHTML = AdminState.events.map(function(ev) {
    return '<tr>' +
      '<td><strong>' + escapeHtml(ev.title || 'Untitled') + '</strong></td>' +
      '<td>' + escapeHtml(ev.date || '-') + '</td>' +
      '<td>' + escapeHtml(ev.time || '-') + '</td>' +
      '<td>' + escapeHtml(ev.location || '-') + '</td>' +
      '<td>' +
        '<button class="action-btn edit" onclick="editEvent(\'' + ev.id + '\')">Edit</button> ' +
        '<button class="action-btn delete" onclick="deleteEvent(\'' + ev.id + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function openEventModal(event) {
  AdminState.editingEvent = event;
  document.getElementById('eventModalTitle').textContent = event ? 'Edit Event' : 'Add Event';
  document.getElementById('eventTitle').value = event ? (event.title || '') : '';
  document.getElementById('eventDate').value = event ? (event.date || '') : '';
  document.getElementById('eventTime').value = event ? (event.time || '') : '';
  document.getElementById('eventLocation').value = event ? (event.location || '') : '';
  document.getElementById('eventSpeaker').value = event ? (event.speaker || '') : '';
  document.getElementById('eventThumbnail').value = event ? (event.thumbnail || '') : '';
  document.getElementById('eventRegLink').value = event ? (event.registrationLink || '') : '';
  document.getElementById('eventEditModal').classList.add('open');
}

function editEvent(id) {
  var ev = AdminState.events.find(function(e) { return e.id === id; });
  if (ev) openEventModal(ev);
}

function handleEventSave(e) {
  e.preventDefault();
  var data = {
    title: document.getElementById('eventTitle').value,
    date: document.getElementById('eventDate').value,
    time: document.getElementById('eventTime').value,
    location: document.getElementById('eventLocation').value,
    speaker: document.getElementById('eventSpeaker').value,
    thumbnail: document.getElementById('eventThumbnail').value,
    registrationLink: document.getElementById('eventRegLink').value
  };

  if (AdminState.editingEvent) {
    safeUpdate('events', AdminState.editingEvent.id, data).then(function() {
      var idx = AdminState.events.findIndex(function(ev) { return ev.id === AdminState.editingEvent.id; });
      if (idx > -1) AdminState.events[idx] = Object.assign({}, AdminState.events[idx], data);
      renderEventsTable();
      updateStats();
      showToast('Event updated!', 'success');
      closeAllModals();
    });
  } else {
    safeAdd('events', data).then(function(id) {
      data.id = id;
      AdminState.events.unshift(data);
      renderEventsTable();
      updateStats();
      showToast('Event added!', 'success');
      closeAllModals();
    });
  }
}

function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  safeDelete('events', id).then(function() {
    AdminState.events = AdminState.events.filter(function(e) { return e.id !== id; });
    renderEventsTable();
    updateStats();
    showToast('Event deleted.', 'success');
  });
}

// ── Quote Manager ──────────────────────────────────────────
function renderQuotesTable() {
  var tbody = document.getElementById('quotesTableBody');
  if (!tbody) return;
  if (AdminState.quotes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:32px">No quotes yet.</td></tr>';
    return;
  }
  tbody.innerHTML = AdminState.quotes.map(function(q) {
    var preview = (q.text || '').substring(0, 60) + ((q.text || '').length > 60 ? '...' : '');
    return '<tr>' +
      '<td>' + escapeHtml(preview) + '</td>' +
      '<td>' + escapeHtml(q.author || '-') + '</td>' +
      '<td><span class="status-badge active">' + escapeHtml(q.type || 'text') + '</span></td>' +
      '<td><span class="status-badge ' + (q.active ? 'approved' : 'inactive') + '">' + (q.active ? 'Active' : 'Inactive') + '</span></td>' +
      '<td>' +
        '<button class="action-btn edit" onclick="editQuote(\'' + q.id + '\')">Edit</button> ' +
        '<button class="action-btn delete" onclick="deleteQuote(\'' + q.id + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function openQuoteModal(quote) {
  AdminState.editingQuote = quote;
  document.getElementById('quoteModalTitle').textContent = quote ? 'Edit Quote' : 'Add Quote';
  document.getElementById('quoteText').value = quote ? (quote.text || '') : '';
  document.getElementById('quoteAuthor').value = quote ? (quote.author || '') : '';
  document.getElementById('quoteType').value = quote ? (quote.type || 'text') : 'text';
  document.getElementById('quoteImageUrl').value = quote ? (quote.imageUrl || '') : '';
  document.getElementById('quoteActive').checked = quote ? !!quote.active : true;
  document.getElementById('quoteEditModal').classList.add('open');
}

function editQuote(id) {
  var q = AdminState.quotes.find(function(q) { return q.id === id; });
  if (q) openQuoteModal(q);
}

function handleQuoteSave(e) {
  e.preventDefault();
  var data = {
    text: document.getElementById('quoteText').value,
    author: document.getElementById('quoteAuthor').value,
    type: document.getElementById('quoteType').value,
    imageUrl: document.getElementById('quoteImageUrl').value,
    active: document.getElementById('quoteActive').checked
  };

  if (AdminState.editingQuote) {
    safeUpdate('quotes', AdminState.editingQuote.id, data).then(function() {
      var idx = AdminState.quotes.findIndex(function(q) { return q.id === AdminState.editingQuote.id; });
      if (idx > -1) AdminState.quotes[idx] = Object.assign({}, AdminState.quotes[idx], data);
      renderQuotesTable();
      updateStats();
      showToast('Quote updated!', 'success');
      closeAllModals();
    });
  } else {
    safeAdd('quotes', data).then(function(id) {
      data.id = id;
      AdminState.quotes.unshift(data);
      renderQuotesTable();
      updateStats();
      showToast('Quote added!', 'success');
      closeAllModals();
    });
  }
}

function deleteQuote(id) {
  if (!confirm('Delete this quote?')) return;
  safeDelete('quotes', id).then(function() {
    AdminState.quotes = AdminState.quotes.filter(function(q) { return q.id !== id; });
    renderQuotesTable();
    updateStats();
    showToast('Quote deleted.', 'success');
  });
}

// ── Testimony Manager ──────────────────────────────────────
function renderTestimoniesTable() {
  var tbody = document.getElementById('testimoniesTableBody');
  if (!tbody) return;
  var filtered = AdminState.testimonies;
  if (AdminState.testimonyFilter === 'pending') {
    filtered = filtered.filter(function(t) { return !t.approved; });
  } else if (AdminState.testimonyFilter === 'approved') {
    filtered = filtered.filter(function(t) { return !!t.approved; });
  }
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:32px">No testimonies found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function(t) {
    return '<tr>' +
      '<td><strong>' + escapeHtml(t.name || 'Anonymous') + '</strong></td>' +
      '<td>' + escapeHtml(t.date || '-') + '</td>' +
      '<td>' + (t.isPublic ? '<span class="status-badge approved">Yes</span>' : '<span class="status-badge inactive">No</span>') + '</td>' +
      '<td>' + (t.approved ? '<span class="status-badge approved">Approved</span>' : '<span class="status-badge pending">Pending</span>') + '</td>' +
      '<td>' +
        '<button class="action-btn approve" onclick="toggleTestimony(\'' + t.id + '\')">' + (t.approved ? 'Unapprove' : 'Approve') + '</button> ' +
        '<button class="action-btn delete" onclick="deleteTestimony(\'' + t.id + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function toggleTestimony(id) {
  var t = AdminState.testimonies.find(function(t) { return t.id === id; });
  if (!t) return;
  safeUpdate('testimonies', id, { approved: !t.approved }).then(function() {
    t.approved = !t.approved;
    renderTestimoniesTable();
    showToast(t.approved ? 'Testimony approved!' : 'Testimony unapproved.', 'success');
  });
}

function deleteTestimony(id) {
  if (!confirm('Delete this testimony?')) return;
  safeDelete('testimonies', id).then(function() {
    AdminState.testimonies = AdminState.testimonies.filter(function(t) { return t.id !== id; });
    renderTestimoniesTable();
    showToast('Testimony deleted.', 'success');
  });
}

// ── Messages Manager ───────────────────────────────────────
function renderMessagesTable() {
  var tbody = document.getElementById('messagesTableBody');
  if (!tbody) return;
  var filtered = AdminState.messages;
  if (AdminState.messageFilter !== 'all') {
    filtered = filtered.filter(function(m) { return m.status === AdminState.messageFilter; });
  }
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:32px">No messages found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function(m) {
    return '<tr>' +
      '<td><strong>' + escapeHtml(m.name || 'Anonymous') + '</strong></td>' +
      '<td>' + escapeHtml(m.email || '-') + '</td>' +
      '<td>' + escapeHtml(m.subject || '-') + '</td>' +
      '<td><span class="status-badge active">' + escapeHtml(m.type || 'contact') + '</span></td>' +
      '<td><span class="status-badge ' + m.status + '">' + capitalize(m.status || 'new') + '</span></td>' +
      '<td>' +
        (m.status === 'new' ? '<button class="action-btn approve" onclick="markMessage(\'' + m.id + '\', \'read\')">Read</button> ' : '') +
        (m.status !== 'archived' ? '<button class="action-btn edit" onclick="markMessage(\'' + m.id + '\', \'archived\')">Archive</button> ' : '') +
        '<button class="action-btn delete" onclick="deleteMessage(\'' + m.id + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function markMessage(id, status) {
  safeUpdate('messages', id, { status: status }).then(function() {
    var m = AdminState.messages.find(function(m) { return m.id === id; });
    if (m) m.status = status;
    renderMessagesTable();
    updateStats();
    showToast('Message ' + status + '.', 'success');
  });
}

function deleteMessage(id) {
  if (!confirm('Delete this message?')) return;
  safeDelete('messages', id).then(function() {
    AdminState.messages = AdminState.messages.filter(function(m) { return m.id !== id; });
    renderMessagesTable();
    updateStats();
    showToast('Message deleted.', 'success');
  });
}

// ── Section Builder ───────────────────────────────────────
function renderSectionsList() {
  var list = document.getElementById('sectionsList');
  if (!list) return;
  var sorted = AdminState.sections.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  if (sorted.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:32px">No custom sections yet. Add one above.</p>';
    return;
  }
  list.innerHTML = sorted.map(function(s, i) {
    return '<div class="section-list-item" draggable="true" data-id="' + s.id + '" data-index="' + i + '">' +
      '<span class="drag-handle">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>' +
      '</span>' +
      '<div class="section-info">' +
        '<h4>' + escapeHtml(s.title || 'Untitled Section') + '</h4>' +
        '<p>' + escapeHtml(s.type || 'text-image') + ' &bull; ' + (s.visible ? 'Visible' : 'Hidden') + '</p>' +
      '</div>' +
      '<div class="section-actions">' +
        '<button class="action-btn edit" onclick="editSection(\'' + s.id + '\')">Edit</button>' +
        '<button class="action-btn delete" onclick="deleteSection(\'' + s.id + '\')">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');

  initDragDrop();
}

function initDragDrop() {
  var items = document.querySelectorAll('.section-list-item');
  var dragItem = null;

  items.forEach(function(item) {
    item.addEventListener('dragstart', function() {
      dragItem = this;
      setTimeout(function() { item.classList.add('dragging'); }, 0);
    });
    item.addEventListener('dragend', function() {
      item.classList.remove('dragging');
      dragItem = null;
      // Update order
      var newOrder = [];
      document.querySelectorAll('.section-list-item').forEach(function(el, idx) {
        var id = el.getAttribute('data-id');
        var section = AdminState.sections.find(function(s) { return s.id === id; });
        if (section) {
          newOrder.push({ id: id, data: { order: idx } });
        }
      });
      // Batch update order in Firestore
      var batch = db.batch();
      newOrder.forEach(function(item) {
        batch.update(db.collection('sections').doc(item.id), { order: item.data.order });
      });
      batch.commit().then(function() {
        // Update local
        newOrder.forEach(function(item) {
          var section = AdminState.sections.find(function(s) { return s.id === item.id; });
          if (section) section.order = item.data.order;
        });
        lsSet(lsKey('sections'), AdminState.sections);
        dispatchSync('sections');
        showToast('Section order updated!', 'success');
      });
    });
    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (dragItem && dragItem !== this) {
        var rect = this.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          list().insertBefore(dragItem, this);
        } else {
          list().insertBefore(dragItem, this.nextSibling);
        }
      }
    });
  });

  function list() { return document.getElementById('sectionsList'); }
}

function openSectionModal(section) {
  AdminState.editingSection = section;
  document.getElementById('sectionModalTitle').textContent = section ? 'Edit Section' : 'Add Section';
  document.getElementById('sectionTitle').value = section ? (section.title || '') : '';
  document.getElementById('sectionType').value = section ? (section.type || 'text-image') : 'text-image';
  document.getElementById('sectionContent').value = section ? (section.content || '') : '';
  document.getElementById('sectionImageUrl').value = section ? (section.imageUrl || '') : '';
  document.getElementById('sectionVideoUrl').value = section ? (section.videoUrl || '') : '';
  document.getElementById('sectionItems').value = section ? JSON.stringify(section.items || []) : '[]';
  document.getElementById('sectionVisible').checked = section ? !!section.visible : true;
  document.getElementById('sectionEditModal').classList.add('open');
}

function editSection(id) {
  var s = AdminState.sections.find(function(s) { return s.id === id; });
  if (s) openSectionModal(s);
}

function handleSectionSave(e) {
  e.preventDefault();
  var itemsRaw = document.getElementById('sectionItems').value;
  var items = [];
  try { items = JSON.parse(itemsRaw); } catch(err) { items = []; }

  var data = {
    title: document.getElementById('sectionTitle').value,
    type: document.getElementById('sectionType').value,
    content: document.getElementById('sectionContent').value,
    imageUrl: document.getElementById('sectionImageUrl').value,
    videoUrl: document.getElementById('sectionVideoUrl').value,
    items: items,
    visible: document.getElementById('sectionVisible').checked
  };

  if (AdminState.editingSection) {
    safeUpdate('sections', AdminState.editingSection.id, data).then(function() {
      var idx = AdminState.sections.findIndex(function(s) { return s.id === AdminState.editingSection.id; });
      if (idx > -1) AdminState.sections[idx] = Object.assign({}, AdminState.sections[idx], data);
      renderSectionsList();
      showToast('Section updated!', 'success');
      closeAllModals();
    });
  } else {
    data.order = AdminState.sections.length;
    safeAdd('sections', data).then(function(id) {
      data.id = id;
      AdminState.sections.push(data);
      renderSectionsList();
      showToast('Section added!', 'success');
      closeAllModals();
    });
  }
}

function deleteSection(id) {
  if (!confirm('Delete this section?')) return;
  safeDelete('sections', id).then(function() {
    AdminState.sections = AdminState.sections.filter(function(s) { return s.id !== id; });
    renderSectionsList();
    showToast('Section deleted.', 'success');
  });
}

// ── Modal Helpers ───────────────────────────────────────────
function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(function(m) { m.classList.remove('open'); });
  AdminState.editingSermon = null;
  AdminState.editingEvent = null;
  AdminState.editingQuote = null;
  AdminState.editingSection = null;
}

// ── Utility Functions ──────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ── Initialization ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Auth
  initAuth();
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  initPasswordToggle();

  // Panel nav
  initPanelNav();

  // Theme
  initThemeSync();
  document.getElementById('themeForm').addEventListener('submit', handleThemeSave);

  // Hero & Content
  document.getElementById('heroForm').addEventListener('submit', handleHeroSave);
  document.getElementById('aboutForm').addEventListener('submit', handleAboutSave);
  document.getElementById('contactInfoForm').addEventListener('submit', handleContactInfoSave);

  // Sermons
  document.getElementById('addSermonBtn').addEventListener('click', function() { openSermonModal(null); });
  document.getElementById('sermonEditForm').addEventListener('submit', handleSermonSave);

  // Events
  document.getElementById('addEventBtn').addEventListener('click', function() { openEventModal(null); });
  document.getElementById('eventEditForm').addEventListener('submit', handleEventSave);

  // Quotes
  document.getElementById('addQuoteBtn').addEventListener('click', function() { openQuoteModal(null); });
  document.getElementById('quoteEditForm').addEventListener('submit', handleQuoteSave);

  // Testimony filters
  document.querySelectorAll('#panelTestimonies .filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#panelTestimonies .filter-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      AdminState.testimonyFilter = this.getAttribute('data-filter');
      renderTestimoniesTable();
    });
  });

  // Message filters
  document.querySelectorAll('#panelMessages .filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#panelMessages .filter-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      AdminState.messageFilter = this.getAttribute('data-filter');
      renderMessagesTable();
    });
  });

  // Sections
  document.getElementById('addSectionBtn').addEventListener('click', function() {
    var type = document.getElementById('newSectionType').value;
    openSectionModal(null);
    document.getElementById('sectionType').value = type;
  });
  document.getElementById('sectionEditForm').addEventListener('submit', handleSectionSave);

  // Modal close handlers
  document.querySelectorAll('[data-close]').forEach(function(el) {
    el.addEventListener('click', function() {
      var modalId = this.getAttribute('data-close');
      document.getElementById(modalId).classList.remove('open');
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(function(modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAllModals();
  });
});
