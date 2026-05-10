// Admin Dashboard JavaScript - Salvation Ministries Ada George
// Handles authentication, content management, and real-time updates

let currentUser = null;

// Wait for DOM and Firebase to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, waiting for Firebase...');
  waitForFirebase().then(() => {
    console.log('Firebase ready, initializing admin...');
    initializeAdmin();
    loadThemeSettings(); // Apply theme to admin dashboard
  });
});

function initializeAdmin() {
    setupLogin();
    setupNavigation();
    setupForms();
    
    // Initialize icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ========================================
// Theme Settings Application
// ========================================

async function loadThemeSettings() {
    try {
        const doc = await safeGet(db.collection(Collections.SETTINGS).doc('theme'));
        if (doc && doc.exists) {
            const theme = doc.data();
            
            // Update CSS variables
            if (theme.primaryColor) {
                document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
            }
            if (theme.secondaryColor) {
                document.documentElement.style.setProperty('--secondary-color', theme.secondaryColor);
            }
            if (theme.accentColor) {
                document.documentElement.style.setProperty('--accent-color', theme.accentColor);
            }

            // Update logo
            if (theme.logoUrl) {
                const logos = document.querySelectorAll('.admin-logo img, .login-logo img');
                logos.forEach(logo => {
                    logo.src = theme.logoUrl;
                });
            }

            // Update favicon
            if (theme.faviconUrl) {
                let link = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = theme.faviconUrl;
            }
            
            // Apply dark mode if set
            if (theme.mode === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }
    } catch (error) {
        console.error('Error loading theme settings:', error.message || String(error));
    }
}

// ========================================
// Authentication
// ========================================

function setupLogin() {
    const loginForm = document.getElementById('loginForm');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const loginFeedback = document.getElementById('loginFeedback');
    
    // Check Firebase Auth state first
    auth.onAuthStateChanged((user) => {
        if (user && user.email === 'danielgiobari644@gmail.com' && user.emailVerified) {
            console.log('Firebase Auth: Admin recognized');
            sessionStorage.setItem('adminLoggedIn', 'true');
            currentUser = user.displayName || user.email;
            showDashboard();
        } else {
            console.log('Firebase Auth: No admin active');
            // If they were "logged in" via legacy but no Auth, we might still allow local session
            // but rules will fail. Better to stay on login screen if Auth is needed.
            const loggedIn = sessionStorage.getItem('adminLoggedIn');
            if (loggedIn === 'true') {
                showDashboard();
            }
        }
    });

    googleLoginBtn?.addEventListener('click', async () => {
        try {
            console.log('Google login attempt...');
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            
            if (user.email === 'danielgiobari644@gmail.com') {
                console.log('Google login successful');
                sessionStorage.setItem('adminLoggedIn', 'true');
                currentUser = user.displayName || user.email;
                showDashboard();
            } else {
                console.warn('Unauthorized email:', user.email);
                showFeedback(loginFeedback, 'Unauthorized access attempt. Access denied.', 'error');
                await auth.signOut();
            }
        } catch (error) {
            console.error('Google login error:', error.message || String(error));
            showFeedback(loginFeedback, `Login error: ${error.message || 'Unknown error'}`, 'error');
        }
    });
    
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        if (!username || !password) {
            showFeedback(loginFeedback, 'Please enter both username and password', 'error');
            return;
        }
        
        try {
            console.log('Attempting login...');
            
            // Wait for Firebase to be ready
            await waitForFirebase();
            
            const doc = await safeGet(db.collection(Collections.ADMIN).doc('credentials'));
            
            if (!doc || !doc.exists) {
                console.error('Credentials document does not exist');
                showFeedback(loginFeedback, 'Admin credentials not found. Please check Firebase setup.', 'error');
                return;
            }
            
            const credentials = doc.data();
            console.log('Credentials retrieved successfully');
            
            if (username === credentials.username && password === credentials.password) {
                console.log('Login successful');
                sessionStorage.setItem('adminLoggedIn', 'true');
                currentUser = username;
                showDashboard();
            } else {
                console.log('Invalid credentials');
                showFeedback(loginFeedback, 'Invalid username or password', 'error');
            }
        } catch (error) {
            console.error('Login error:', error.message || String(error));
            showFeedback(loginFeedback, `Error: ${error.message || 'Unknown error'}. Please try again.`, 'error');
        }
    });
}

function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminDashboard) adminDashboard.style.display = 'flex';
    loadAllData();
}

// ========================================
// Navigation
// ========================================

function setupNavigation() {
    const navItems = document.querySelectorAll('.admin-nav-item');
    const panels = document.querySelectorAll('.admin-panel');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await auth.signOut();
                    sessionStorage.removeItem('adminLoggedIn');
                    window.location.reload();
                } catch (error) {
                    console.error('Logout error:', error.message || String(error));
                    // Fallback: clear session anyway
                    sessionStorage.removeItem('adminLoggedIn');
                    window.location.reload();
                }
            }
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const panelId = item.dataset.panel + 'Panel';
            
            // Update active states
            navItems.forEach(nav => nav.classList.remove('active'));
            panels.forEach(panel => panel.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(panelId)?.classList.add('active');
        });
    });
}

// ========================================
// Load All Data
// ========================================

async function loadAllData() {
    loadThemeData();
    loadDesignData();
    loadHeroData();
    loadContentData();
    loadServicesData();
    loadContactData();
    loadSermonsList();
    loadEventsList();
    loadTestimoniesList();
    loadQuotesList();
    loadMomentsList();
    loadMessagesList();
}

// ========================================
// Theme Settings
// ========================================

async function loadDesignData() {
    try {
        const doc = await safeGet(db.collection(Collections.SETTINGS).doc('theme'));
        if (doc && doc.exists) {
            const data = doc.data();
            const mode = document.getElementById('designThemeMode');
            const primary = document.getElementById('designPrimaryColor');
            const hover = document.getElementById('designPrimaryHover');
            const radius = document.getElementById('designBorderRadius');
            const spacing = document.getElementById('designSpacing');
            const fontSize = document.getElementById('designFontSize');

            if (mode) mode.value = data.mode || 'light';
            if (primary) primary.value = data.primaryColor || '#2563eb';
            if (hover) hover.value = data.primaryHover || '#1d4ed8';
            if (radius) radius.value = data.borderRadius || 12;
            if (spacing) spacing.value = data.sectionSpacing || 5;
            if (fontSize) fontSize.value = data.fontSizeBase || 16;
            
            updateDesignValues();
        }
    } catch (error) {
        console.error('Error loading design data:', error.message || String(error));
    }
}

function updateDesignValues() {
    const mode = document.getElementById('designThemeMode')?.value;
    const radius = document.getElementById('designBorderRadius')?.value;
    const spacing = document.getElementById('designSpacing')?.value;
    const fontSize = document.getElementById('designFontSize')?.value;
    const primary = document.getElementById('designPrimaryColor')?.value;

    if (document.getElementById('borderRadiusVal')) document.getElementById('borderRadiusVal').textContent = radius + 'px';
    if (document.getElementById('spacingVal')) document.getElementById('spacingVal').textContent = spacing + 'rem';
    if (document.getElementById('fontSizeVal')) document.getElementById('fontSizeVal').textContent = fontSize + 'px';

    // Live sync for admin preview
    if (mode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (mode === 'light') {
        document.body.classList.remove('dark-mode');
    }
    
    document.documentElement.style.setProperty('--radius-md', radius + 'px');
    document.documentElement.style.setProperty('--radius-lg', (radius * 1.5) + 'px');
    document.documentElement.style.setProperty('--section-spacing', spacing + 'rem');
    document.documentElement.style.setProperty('--font-size-base', fontSize + 'px');
    if (primary) document.documentElement.style.setProperty('--primary-color', primary);
}

async function loadThemeData() {
    try {
        const doc = await safeGet(db.collection(Collections.SETTINGS).doc('theme'));
        if (doc && doc.exists) {
            const theme = doc.data();
            const primaryColor = document.getElementById('primaryColor');
            const secondaryColor = document.getElementById('secondaryColor');
            const accentColor = document.getElementById('accentColor');
            const logoUrl = document.getElementById('logoUrl');
            const faviconUrl = document.getElementById('faviconUrl');
            const livestreamUrl = document.getElementById('livestreamUrl');
            const sermonBackgroundInput = document.getElementById('sermonBackgroundInput');
            const testimonyBackgroundInput = document.getElementById('testimonyBackgroundInput');

            if (primaryColor) primaryColor.value = theme.primaryColor || '#2563eb';
            if (secondaryColor) secondaryColor.value = theme.secondaryColor || '#7c3aed';
            if (accentColor) accentColor.value = theme.accentColor || '#f59e0b';
            if (logoUrl) logoUrl.value = theme.logoUrl || '';
            if (faviconUrl) faviconUrl.value = theme.faviconUrl || '';
            if (livestreamUrl) livestreamUrl.value = theme.livestreamUrl || '';
            if (sermonBackgroundInput) sermonBackgroundInput.value = theme.sermonBackground || '';
            if (testimonyBackgroundInput) testimonyBackgroundInput.value = theme.testimonyBackground || '';
        }
    } catch (error) {
        console.error('Error loading theme data:', error.message || String(error));
    }
}

// ========================================
// Hero Settings
// ========================================

async function loadHeroData() {
    try {
        const doc = await safeGet(db.collection(Collections.SETTINGS).doc('theme'));
        if (doc && doc.exists) {
            const theme = doc.data();
            const heroModeSelect = document.getElementById('heroModeSelect');
            const heroTitleInput = document.getElementById('heroTitleInput');
            const heroSubtextInput = document.getElementById('heroSubtextInput');

            if (heroModeSelect) heroModeSelect.value = theme.heroMode || 'single';
            if (heroTitleInput) heroTitleInput.value = theme.heroText || '';
            if (heroSubtextInput) heroSubtextInput.value = theme.heroSubtext || '';

            const container = document.getElementById('heroImagesContainer');
            if (container) {
                container.innerHTML = '';
                // Support both new singular heroImage and old heroImages array for compatibility during transition
                const images = [];
                if (theme.heroImage && (!theme.heroImages || theme.heroImages.length === 0)) {
                    images.push({url: theme.heroImage, link: '#'});
                } else if (theme.heroImages && theme.heroImages.length > 0) {
                    theme.heroImages.forEach(img => images.push(img));
                }
                
                images.forEach(img => addHeroImageRow(img));
                
                // If empty, add one default row
                if (images.length === 0) {
                    addHeroImageRow();
                }

                // Initialize Sortable
                if (typeof Sortable !== 'undefined') {
                    new Sortable(container, {
                        animation: 150,
                        ghostClass: 'sortable-ghost',
                        handle: '.drag-handle'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error loading hero data:', error.message || String(error));
    }
}

function addHeroImageRow(data = {}) {
    const container = document.getElementById('heroImagesContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'hero-image-row admin-card';
    row.style.marginBottom = '1.5rem';
    row.style.background = 'rgba(0,0,0,0.02)';
    row.style.padding = '1.5rem';
    row.style.position = 'relative';

    row.innerHTML = `
        <div class="drag-handle" style="position: absolute; top: 1rem; left: 1rem;">
            <i data-lucide="grip-vertical"></i>
        </div>
        <button type="button" class="remove-hero-img-btn" style="position: absolute; top: 1rem; right: 1rem; background: #fee2e2; color: #ef4444; border: none; padding: 0.5rem; border-radius: 8px; cursor: pointer;">
            <i data-lucide="trash-2"></i>
        </button>
        <div class="form-row" style="padding: 0 2rem;">
            <div class="form-group">
                <label>Image URL</label>
                <input type="url" class="hero-img-url" value="${data.url || ''}" placeholder="https://example.com/image.jpg" required>
            </div>
            <div class="form-group">
                <label>Link URL (Optional)</label>
                <input type="url" class="hero-img-link" value="${data.link || '#'}" placeholder="https://example.com/page">
            </div>
        </div>
    `;

    row.querySelector('.remove-hero-img-btn').addEventListener('click', () => {
        row.remove();
    });

    container.appendChild(row);
    if (window.lucide) lucide.createIcons();
}

// ========================================
// Content Settings
// ========================================

async function loadContentData() {
    try {
        const doc = await safeGet(db.collection(Collections.CONTENT).doc('about'));
        if (doc && doc.exists) {
            const content = doc.data();
            const missionInput = document.getElementById('missionInput');
            const missionImageUrl = document.getElementById('missionImageUrl');
            const visionInput = document.getElementById('visionInput');
            const visionImageUrl = document.getElementById('visionImageUrl');
            const welcomeInput = document.getElementById('welcomeInput');
            const welcomeImageUrl = document.getElementById('welcomeImageUrl');

            if (missionInput) missionInput.value = content.mission || '';
            if (missionImageUrl) missionImageUrl.value = content.missionImage || '';
            if (visionInput) visionInput.value = content.vision || '';
            if (visionImageUrl) visionImageUrl.value = content.visionImage || '';
            if (welcomeInput) welcomeInput.value = content.welcomeMessage || '';
            if (welcomeImageUrl) welcomeImageUrl.value = content.welcomeImage || '';
        }
    } catch (error) {
        console.error('Error loading content data:', error.message || String(error));
    }
}

// ========================================
// Services Settings
// ========================================

async function loadServicesData() {
    try {
        const doc = await safeGet(db.collection(Collections.SERVICES).doc('schedule'));
        if (doc && doc.exists) {
            const schedule = doc.data();
            
            for (let i = 1; i <= 4; i++) {
                const key = `sunday${i}`;
                if (schedule[key]) {
                    const title = document.getElementById(`sunday${i}Title`);
                    const time = document.getElementById(`sunday${i}Time`);
                    const desc = document.getElementById(`sunday${i}Description`);
                    if (title) title.value = schedule[key].title || '';
                    if (time) time.value = schedule[key].time || '';
                    if (desc) desc.value = schedule[key].description || '';
                }
            }
            
            if (schedule.midweek) {
                const midweekTitle = document.getElementById('midweekTitle');
                const midweekTime = document.getElementById('midweekTime');
                const midweekDescription = document.getElementById('midweekDescription');
                if (midweekTitle) midweekTitle.value = schedule.midweek.title || '';
                if (midweekTime) midweekTime.value = schedule.midweek.time || '';
                if (midweekDescription) midweekDescription.value = schedule.midweek.description || '';
            }
            
            if (schedule.special) {
                const specialTitle = document.getElementById('specialTitle');
                const specialTime = document.getElementById('specialTime');
                const specialDescription = document.getElementById('specialDescription');
                if (specialTitle) specialTitle.value = schedule.special.title || '';
                if (specialTime) specialTime.value = schedule.special.time || '';
                if (specialDescription) specialDescription.value = schedule.special.description || '';
            }
        }
    } catch (error) {
        console.error('Error loading services data:', error.message || String(error));
    }
}

// ========================================
// Contact Settings
// ========================================

async function loadContactData() {
    try {
        const doc = await safeGet(db.collection(Collections.CONTENT).doc('contact'));
        if (doc && doc.exists) {
            const contact = doc.data();
            
            const contactEmailAdmin = document.getElementById('contactEmailAdmin');
            const contactPhoneAdmin = document.getElementById('contactPhoneAdmin');
            const contactAddressAdmin = document.getElementById('contactAddressAdmin');

            if (contactEmailAdmin) contactEmailAdmin.value = contact.email || '';
            if (contactPhoneAdmin) contactPhoneAdmin.value = contact.phone || '';
            if (contactAddressAdmin) contactAddressAdmin.value = contact.address || '';
            
            const container = document.getElementById('bankAccountsList');
            if (container) {
                container.innerHTML = '';
                const accounts = contact.offeringAccounts || (contact.offeringAccount ? [contact.offeringAccount] : []);
                accounts.forEach(account => addBankAccountRow(account));

                // Initialize Sortable for bank accounts
                if (typeof Sortable !== 'undefined') {
                    new Sortable(container, {
                        animation: 150,
                        ghostClass: 'sortable-ghost',
                        handle: '.drag-handle'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error loading contact data:', error.message || String(error));
    }
}

function addBankAccountRow(data = {}) {
    const container = document.getElementById('bankAccountsList');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'bank-account-row admin-card';
    row.style.marginBottom = '1.5rem';
    row.style.background = 'rgba(0,0,0,0.02)';
    row.style.padding = '1.5rem';
    row.style.position = 'relative';

    row.innerHTML = `
        <div class="drag-handle" style="position: absolute; top: 1rem; left: 1rem;">
            <i data-lucide="grip-vertical"></i>
        </div>
        <button type="button" class="remove-bank-btn" style="position: absolute; top: 1rem; right: 1rem; background: #fee2e2; color: #ef4444; border: none; padding: 0.5rem; border-radius: 8px; cursor: pointer;">
            <i data-lucide="trash-2"></i>
        </button>
        <div style="padding: 0 2rem;">
            <div class="form-group">
                <label>Account Title (Optional - e.g. General Offering, Tithe)</label>
                <input type="text" class="bank-title" value="${data.title || ''}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Bank Name</label>
                    <input type="text" class="bank-name" value="${data.bank || ''}" required>
                </div>
                <div class="form-group">
                    <label>Account Number</label>
                    <input type="text" class="bank-number" value="${data.accountNumber || ''}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Account Name</label>
                <input type="text" class="bank-acc-name" value="${data.accountName || ''}" required>
            </div>
        </div>
    `;

    row.querySelector('.remove-bank-btn').addEventListener('click', () => {
        row.remove();
    });

    container.appendChild(row);
    if (window.lucide) lucide.createIcons();
}

// ========================================
// Sermons Management
// ========================================

async function loadSermonsList() {
    try {
        const sermonsList = document.getElementById('sermonsList');
        if (!sermonsList) return;
        sermonsList.innerHTML = '';
        
        const snapshot = await safeList(db.collection(Collections.SERMONS)
            .orderBy('date', 'desc'));
        
        if (!snapshot || snapshot.empty) {
            sermonsList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No sermons yet</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const sermon = doc.data();
            const card = createSermonAdminCard(doc.id, sermon);
            sermonsList.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading sermons list:', error.message || String(error));
    }
}

function createSermonAdminCard(id, sermon) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const date = sermon.date.toDate ? sermon.date.toDate() : new Date(sermon.date);
    
    card.innerHTML = `
        <div class="item-info">
            <h3>${sermon.title}</h3>
            <p style="color: var(--secondary-color); margin: 0.5rem 0;">${date.toLocaleDateString()}</p>
            ${sermon.description ? `<p style="opacity: 0.7;">${sermon.description}</p>` : ''}
        </div>
        <div class="item-actions">
            <button class="btn-admin" style="background: #ef4444;" onclick="deleteSermon('${id}')">Delete</button>
        </div>
    `;
    
    return card;
}

async function deleteSermon(id) {
    if (confirm('Are you sure you want to delete this sermon?')) {
        try {
            await db.collection(Collections.SERMONS).doc(id).delete();
            loadSermonsList();
        } catch (error) {
            console.error('Error deleting sermon:', error.message || String(error));
            alert('Error deleting sermon');
        }
    }
}

// ========================================
// Events Management
// ========================================

async function loadEventsList() {
    try {
        const eventsList = document.getElementById('eventsList');
        if (!eventsList) return;
        eventsList.innerHTML = '';
        
        const snapshot = await safeList(db.collection(Collections.EVENTS)
            .orderBy('date', 'desc'));
        
        if (!snapshot || snapshot.empty) {
            eventsList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No events yet</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const event = doc.data();
            const card = createEventAdminCard(doc.id, event);
            eventsList.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading events list:', error.message || String(error));
    }
}

function createEventAdminCard(id, event) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const date = event.date.toDate ? event.date.toDate() : new Date(event.date);
    
    card.innerHTML = `
        <div class="item-info">
            <h3>${event.title}</h3>
            <p style="color: var(--secondary-color); margin: 0.5rem 0;">${date.toLocaleDateString()}</p>
            <p style="opacity: 0.7;">${event.description}</p>
        </div>
        <div class="item-actions">
            <button class="btn-admin" style="background: #ef4444;" onclick="deleteEvent('${id}')">Delete</button>
        </div>
    `;
    
    return card;
}

async function deleteEvent(id) {
    if (confirm('Are you sure you want to delete this event?')) {
        try {
            await db.collection(Collections.EVENTS).doc(id).delete();
            loadEventsList();
        } catch (error) {
            console.error('Error deleting event:', error.message || String(error));
            alert('Error deleting event');
        }
    }
}

// ========================================
// Testimonies Management
// ========================================

async function loadTestimoniesList() {
    loadPendingTestimonies();
    loadApprovedTestimonies();
}

async function loadPendingTestimonies() {
    try {
        const pendingList = document.getElementById('pendingTestimoniesList');
        pendingList.innerHTML = '';
        
        // Fetch all testimonies ordered by date to avoid composite index requirement
        const snapshot = await safeList(db.collection(Collections.TESTIMONIES)
            .orderBy('submittedAt', 'desc'));
        
        const pendingTestimonies = [];
        if (snapshot) {
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.approved === false) {
                    pendingTestimonies.push({ id: doc.id, ...data });
                }
            });
        }

        if (pendingTestimonies.length > 0) {
            pendingTestimonies.forEach(testimony => {
                const card = createTestimonyPendingCard(testimony.id, testimony);
                pendingList.appendChild(card);
            });
        } else {
            pendingList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No pending testimonies</p>';
        }
    } catch (error) {
        console.error('Error loading pending testimonies:', error.message || String(error));
    }
}

async function loadApprovedTestimonies() {
    try {
        const approvedList = document.getElementById('approvedTestimoniesList');
        approvedList.innerHTML = '';
        
        // Fetch all testimonies ordered by date to avoid composite index requirement
        const snapshot = await safeList(db.collection(Collections.TESTIMONIES)
            .orderBy('submittedAt', 'desc'));
        
        const approvedTestimonies = [];
        if (snapshot) {
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.approved === true) {
                    approvedTestimonies.push({ id: doc.id, ...data });
                }
            });
        }

        if (approvedTestimonies.length > 0) {
            approvedTestimonies.forEach(testimony => {
                const card = createTestimonyApprovedCard(testimony.id, testimony);
                approvedList.appendChild(card);
            });
        } else {
            approvedList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No approved testimonies</p>';
        }
    } catch (error) {
        console.error('Error loading approved testimonies:', error.message || String(error));
    }
}

function createTestimonyPendingCard(id, testimony) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const date = testimony.submittedAt.toDate ? testimony.submittedAt.toDate() : new Date(testimony.submittedAt);
    
    card.innerHTML = `
        <div class="item-info">
            <h3>${testimony.name}</h3>
            <p style="color: var(--secondary-color); margin: 0.5rem 0;">${date.toLocaleDateString()}</p>
            <p style="opacity: 0.7; font-style: italic;">"${testimony.message}"</p>
        </div>
        <div class="item-actions">
            <button class="btn-admin" style="background: #10b981; margin-right: 0.5rem;" onclick="approveTestimony('${id}')">Approve</button>
            <button class="btn-admin" style="background: #ef4444;" onclick="rejectTestimony('${id}')">Reject</button>
        </div>
    `;
    
    return card;
}

function createTestimonyApprovedCard(id, testimony) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const date = testimony.submittedAt.toDate ? testimony.submittedAt.toDate() : new Date(testimony.submittedAt);
    
    card.innerHTML = `
        <div class="item-info">
            <h3>${testimony.name}</h3>
            <p style="color: var(--secondary-color); margin: 0.5rem 0;">${date.toLocaleDateString()}</p>
            <p style="opacity: 0.7; font-style: italic;">"${testimony.message}"</p>
        </div>
        <div class="item-actions">
            <button class="btn-admin" style="background: #ef4444;" onclick="deleteTestimony('${id}')">Delete</button>
        </div>
    `;
    
    return card;
}

async function approveTestimony(id) {
    try {
        await db.collection(Collections.TESTIMONIES).doc(id).update({
            approved: true
        });
        loadTestimoniesList();
    } catch (error) {
        console.error('Error approving testimony:', error.message || String(error));
        alert('Error approving testimony');
    }
}

async function rejectTestimony(id) {
    if (confirm('Are you sure you want to reject this testimony?')) {
        try {
            await db.collection(Collections.TESTIMONIES).doc(id).delete();
            loadTestimoniesList();
        } catch (error) {
            console.error('Error rejecting testimony:', error.message || String(error));
            alert('Error rejecting testimony');
        }
    }
}

async function deleteTestimony(id) {
    if (confirm('Are you sure you want to delete this testimony?')) {
        try {
            await db.collection(Collections.TESTIMONIES).doc(id).delete();
            loadTestimoniesList();
        } catch (error) {
            console.error('Error deleting testimony:', error.message || String(error));
            alert('Error deleting testimony');
        }
    }
}

// ========================================
// Quotes Management
// ========================================

async function loadQuotesList() {
    try {
        const list = document.getElementById('quotesList');
        if (!list) return;
        list.innerHTML = '';
 
        const snapshot = await safeList(db.collection(Collections.QUOTES)
            .orderBy('createdAt', 'desc'));
 
        if (!snapshot || snapshot.empty) {
            list.innerHTML = '<p class="empty-msg">No quotes added yet</p>';
            return;
        }

        snapshot.forEach(doc => {
            const quote = doc.data();
            const card = document.createElement('div');
            card.className = 'item-card';
            
            let contentHtml = '';
            if (quote.type === 'image') {
                contentHtml = `<img src="${quote.imageUrl}" style="max-width: 100px; max-height: 100px; border-radius: 8px;">`;
            } else if (quote.type === 'both') {
                contentHtml = `
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <img src="${quote.imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                        <div>
                            <p style="font-style: italic; font-size: 1rem;">"${quote.text}"</p>
                            <p style="opacity: 0.7; font-size: 0.8rem;">— ${quote.author || 'Unknown'}</p>
                        </div>
                    </div>
                `;
            } else {
                contentHtml = `
                    <div>
                        <p style="font-style: italic; font-size: 1.1rem;">"${quote.text}"</p>
                        <p style="opacity: 0.7; margin-top: 0.5rem;">— ${quote.author || 'Unknown'}</p>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="item-info">
                    <span style="font-size: 0.7rem; background: var(--bg-card); padding: 2px 8px; border-radius: 10px; margin-bottom: 5px; display: inline-block;">${(quote.type || 'text').toUpperCase()}</span>
                    ${contentHtml}
                </div>
                <div class="item-actions">
                    <button class="btn-admin" style="background: #ef4444;" onclick="deleteQuote('${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading quotes:', error.message || String(error));
    }
}

async function deleteQuote(id) {
    if (confirm('Are you sure you want to delete this quote?')) {
        try {
            await db.collection(Collections.QUOTES).doc(id).delete();
            loadQuotesList();
        } catch (error) {
            console.error('Error deleting quote:', error.message || String(error));
            alert('Error deleting quote');
        }
    }
}

// ========================================
// Moments Management
// ========================================

async function loadMomentsList() {
    try {
        const list = document.getElementById('momentsList');
        if (!list) return;
        list.innerHTML = '';
 
        const snapshot = await safeList(db.collection(Collections.MOMENTS)
            .orderBy('createdAt', 'desc'));
 
        if (!snapshot || snapshot.empty) {
            list.innerHTML = '<p class="empty-msg">No moments added yet</p>';
            return;
        }

        snapshot.forEach(doc => {
            const moment = doc.data();
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-info">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        ${moment.type === 'photo' ? 
                            `<img src="${moment.url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` :
                            `<div style="width: 60px; height: 60px; background: #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;"><i data-lucide="play"></i></div>`
                        }
                        <div>
                            <h3>${moment.title || (moment.type === 'photo' ? 'Photo Moment' : 'Video Moment')}</h3>
                            <p style="opacity: 0.7; font-size: 0.9rem;">${moment.type.toUpperCase()}</p>
                        </div>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-admin" style="background: #ef4444;" onclick="deleteMoment('${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
        if (window.lucide) lucide.createIcons();
    } catch (error) {
        console.error('Error loading moments:', error.message || String(error));
    }
}

async function deleteMoment(id) {
    if (confirm('Are you sure you want to delete this moment?')) {
        try {
            await db.collection(Collections.MOMENTS).doc(id).delete();
            loadMomentsList();
        } catch (error) {
            console.error('Error deleting moment:', error.message || String(error));
            alert('Error deleting moment');
        }
    }
}

function setupMomentsAdminTabs() {
    const tabs = document.querySelectorAll('#momentsPanel .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.dataset.tab;
            document.querySelectorAll('#momentsPanel .tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
}

function setupForms() {
    // Design System Form
    const designForm = document.getElementById('designForm');
    ['designBorderRadius', 'designSpacing', 'designFontSize', 'designPrimaryColor', 'designThemeMode'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateDesignValues);
    });

    designForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const updates = {
                mode: document.getElementById('designThemeMode').value,
                primaryColor: document.getElementById('designPrimaryColor').value,
                primaryHover: document.getElementById('designPrimaryHover').value,
                borderRadius: parseInt(document.getElementById('designBorderRadius').value),
                sectionSpacing: parseFloat(document.getElementById('designSpacing').value),
                fontSizeBase: parseInt(document.getElementById('designFontSize').value),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(Collections.SETTINGS).doc('theme').update(updates);
            alert('Design system updated successfully!');
            // Apply immediately to current view
            if (updates.mode === 'dark') document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
        } catch (error) {
            console.error('Error saving design:', error.message || String(error));
            alert('Error saving design system');
        }
    });

    // Theme Form
    document.getElementById('themeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const updates = {
                mode: document.getElementById('themeMode').value,
                primaryColor: document.getElementById('primaryColor').value,
                secondaryColor: document.getElementById('secondaryColor').value,
                accentColor: document.getElementById('accentColor').value
            };
            
            const logoUrl = document.getElementById('logoUrl').value.trim();
            const faviconUrl = document.getElementById('faviconUrl').value.trim();
            const livestreamUrl = document.getElementById('livestreamUrl').value.trim();
            const sermonBackground = document.getElementById('sermonBackgroundInput').value.trim();
            const testimonyBackground = document.getElementById('testimonyBackgroundInput').value.trim();
            
            if (logoUrl) updates.logoUrl = logoUrl;
            if (faviconUrl) updates.faviconUrl = faviconUrl;
            if (livestreamUrl) updates.livestreamUrl = livestreamUrl;
            if (sermonBackground) updates.sermonBackground = sermonBackground;
            if (testimonyBackground) updates.testimonyBackground = testimonyBackground;
            
            await db.collection(Collections.SETTINGS).doc('theme').update(updates);
            
            // Re-apply theme to dashboard immediately
            loadThemeSettings();
            
            alert('Theme settings saved successfully!');
        } catch (error) {
            console.error('Error saving theme:', error.message || String(error));
            alert('Error saving theme settings: ' + error.message);
        }
    });
    
    // Hero Form
    document.getElementById('heroForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const heroMode = document.getElementById('heroModeSelect').value;
        const heroTitle = document.getElementById('heroTitleInput').value;
        const heroSubtext = document.getElementById('heroSubtextInput').value;
        
        const imageRows = document.querySelectorAll('.hero-image-row');
        const heroImages = Array.from(imageRows).map(row => ({
            url: row.querySelector('.hero-img-url').value.trim(),
            link: row.querySelector('.hero-img-link').value.trim() || '#'
        }));

        try {
            await db.collection(Collections.SETTINGS).doc('theme').update({
                heroImage: heroImages.length > 0 ? heroImages[0].url : '',
                heroText: heroTitle,
                heroSubtext: heroSubtext,
                // Keep these for backward compatibility if needed, but primary focus is heroImage
                heroMode: heroMode,
                heroImages: heroImages
            });
            alert('Hero settings saved successfully!');
        } catch (error) {
            console.error('Error saving hero:', error.message || String(error));
            alert('Error saving hero settings');
        }
    });

    // Add Hero Image Button
    document.getElementById('addHeroImageBtn')?.addEventListener('click', () => addHeroImageRow());
    
    // Content Form
    document.getElementById('contentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            await db.collection(Collections.CONTENT).doc('about').update({
                mission: document.getElementById('missionInput').value,
                missionImage: document.getElementById('missionImageUrl').value,
                vision: document.getElementById('visionInput').value,
                visionImage: document.getElementById('visionImageUrl').value,
                welcomeMessage: document.getElementById('welcomeInput').value,
                welcomeImage: document.getElementById('welcomeImageUrl').value
            });
            alert('Content saved successfully!');
        } catch (error) {
            console.error('Error saving content:', error.message || String(error));
            alert('Error saving content');
        }
    });

    // Quote Type Toggle
    document.getElementById('quoteType')?.addEventListener('change', (e) => {
        const type = e.target.value;
        const textInput = document.getElementById('quoteTextInput');
        const authorInput = document.getElementById('quoteAuthorInput');
        const imageInput = document.getElementById('quoteImageInput');

        if (type === 'text') {
            textInput.style.display = 'block';
            authorInput.style.display = 'block';
            imageInput.style.display = 'none';
        } else if (type === 'image') {
            textInput.style.display = 'none';
            authorInput.style.display = 'none';
            imageInput.style.display = 'block';
        } else {
            textInput.style.display = 'block';
            authorInput.style.display = 'block';
            imageInput.style.display = 'block';
        }
    });

    // Quote Form
    document.getElementById('quoteForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const quoteData = {
                type: document.getElementById('quoteType').value,
                text: document.getElementById('quoteText').value,
                author: document.getElementById('quoteAuthor').value,
                imageUrl: document.getElementById('quoteImageUrl').value,
                active: true,
                createdAt: firebase.firestore.Timestamp.now()
            };
            await db.collection(Collections.QUOTES).add(quoteData);
            e.target.reset();
            // Reset visibility
            document.getElementById('quoteTextInput').style.display = 'block';
            document.getElementById('quoteAuthorInput').style.display = 'block';
            document.getElementById('quoteImageInput').style.display = 'none';
            
            loadQuotesList();
            alert('Quote added successfully!');
        } catch (error) {
            console.error('Error adding quote:', error.message || String(error));
            alert('Error adding quote');
        }
    });

    // Moment Photo Form
    document.getElementById('momentPhotoForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await db.collection(Collections.MOMENTS).add({
                type: 'photo',
                url: document.getElementById('momentPhotoUrl').value,
                title: document.getElementById('momentPhotoTitle').value,
                description: document.getElementById('momentPhotoDesc').value,
                createdAt: firebase.firestore.Timestamp.now()
            });
            e.target.reset();
            loadMomentsList();
            alert('Photo moment added successfully!');
        } catch (error) {
            console.error('Error adding photo moment:', error.message || String(error));
            alert('Error adding photo moment');
        }
    });

    // Moment Video Form
    document.getElementById('momentVideoForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await db.collection(Collections.MOMENTS).add({
                type: 'video',
                url: document.getElementById('momentVideoUrl').value,
                title: document.getElementById('momentVideoTitle').value,
                createdAt: firebase.firestore.Timestamp.now()
            });
            e.target.reset();
            loadMomentsList();
            alert('Video moment added successfully!');
        } catch (error) {
            console.error('Error adding video moment:', error.message || String(error));
            alert('Error adding video moment');
        }
    });

    setupMomentsAdminTabs();
    
    // Services Form
    document.getElementById('servicesForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const updates = {};
            for (let i = 1; i <= 4; i++) {
                updates[`sunday${i}`] = {
                    title: document.getElementById(`sunday${i}Title`).value,
                    time: document.getElementById(`sunday${i}Time`).value,
                    description: document.getElementById(`sunday${i}Description`).value
                };
            }
            
            updates.midweek = {
                title: document.getElementById('midweekTitle').value,
                time: document.getElementById('midweekTime').value,
                description: document.getElementById('midweekDescription').value
            };
            
            updates.special = {
                title: document.getElementById('specialTitle').value,
                time: document.getElementById('specialTime').value,
                description: document.getElementById('specialDescription').value
            };

            await db.collection(Collections.SERVICES).doc('schedule').update(updates);
            alert('Service times saved successfully!');
        } catch (error) {
            console.error('Error saving services:', error.message || String(error));
            alert('Error saving service times');
        }
    });
    
    // Sermon Form
    document.getElementById('sermonForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('sermonTitle').value;
        const videoUrl = document.getElementById('sermonVideoUrl').value;
        const dateStr = document.getElementById('sermonDate').value;
        const description = document.getElementById('sermonDescription').value;
        
        try {
            await db.collection(Collections.SERMONS).add({
                title: title,
                videoUrl: videoUrl,
                date: firebase.firestore.Timestamp.fromDate(new Date(dateStr)),
                description: description
            });
            
            e.target.reset();
            loadSermonsList();
            alert('Sermon added successfully!');
        } catch (error) {
            console.error('Error adding sermon:', error.message || String(error));
            alert('Error adding sermon');
        }
    });
    
    // Event Form
    document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('eventTitle').value;
        const imageUrl = document.getElementById('eventImageUrl').value;
        const dateStr = document.getElementById('eventDate').value;
        const description = document.getElementById('eventDescription').value;
        
        try {
            await db.collection(Collections.EVENTS).add({
                title: title,
                imageUrl: imageUrl,
                date: firebase.firestore.Timestamp.fromDate(new Date(dateStr)),
                description: description
            });
            
            e.target.reset();
            loadEventsList();
            alert('Event added successfully!');
        } catch (error) {
            console.error('Error adding event:', error.message || String(error));
            alert('Error adding event');
        }
    });
    
    // Manual Testimony Form
    document.getElementById('testimonyManualForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('testimonyManualName').value;
        const message = document.getElementById('testimonyManualMessage').value;
        
        try {
            await db.collection(Collections.TESTIMONIES).add({
                name: name,
                message: message,
                approved: true,
                submittedAt: firebase.firestore.Timestamp.now()
            });
            
            e.target.reset();
            loadTestimoniesList();
            alert('Testimony added successfully!');
        } catch (error) {
            console.error('Error adding testimony:', error.message || String(error));
            alert('Error adding testimony');
        }
    });
    
    // Contact Form
    document.getElementById('contactForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const bankRows = document.querySelectorAll('.bank-account-row');
        const offeringAccounts = Array.from(bankRows).map(row => ({
            title: row.querySelector('.bank-title').value.trim(),
            bank: row.querySelector('.bank-name').value.trim(),
            accountNumber: row.querySelector('.bank-number').value.trim(),
            accountName: row.querySelector('.bank-acc-name').value.trim()
        }));

        try {
            await db.collection(Collections.CONTENT).doc('contact').update({
                email: document.getElementById('contactEmailAdmin').value,
                phone: document.getElementById('contactPhoneAdmin').value,
                address: document.getElementById('contactAddressAdmin').value,
                offeringAccounts: offeringAccounts
            });
            alert('Contact information saved successfully!');
        } catch (error) {
            console.error('Error saving contact info:', error.message || String(error));
            alert('Error saving contact information');
        }
    });

    // Add Bank Button
    document.getElementById('addBankBtn')?.addEventListener('click', () => addBankAccountRow());
}

async function loadMessagesList() {
    const list = document.getElementById('messagesList');
    if (!list) return;
 
    try {
        const snapshot = await safeList(db.collection(Collections.MESSAGES)
            .orderBy('submittedAt', 'desc'));
 
        if (!snapshot || snapshot.empty) {
            list.innerHTML = '<p class="empty-msg">No messages yet.</p>';
            return;
        }

        list.innerHTML = snapshot.docs.map(doc => {
            const msg = doc.data();
            const date = msg.submittedAt ? msg.submittedAt.toDate().toLocaleString() : 'N/A';
            return `
                <div class="item-card">
                    <div class="item-info">
                        <h3>${msg.name}</h3>
                        <p style="color: var(--secondary-color); margin: 0.5rem 0;">${msg.email}</p>
                        <p style="opacity: 0.7;">${msg.message}</p>
                        <small style="display: block; margin-top: 1rem; opacity: 0.5;">${date}</small>
                    </div>
                    <div class="item-actions">
                        <button class="btn-admin" style="background: #ef4444;" onclick="deleteMessage('${doc.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading messages:', error.message || String(error));
        list.innerHTML = '<p class="error-msg">Error loading messages.</p>';
    }
}

async function deleteMessage(id) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
        await db.collection(Collections.MESSAGES).doc(id).delete();
        loadMessagesList();
    } catch (error) {
        console.error('Error deleting message:', error.message || String(error));
        alert('Error deleting message');
    }
}

// ========================================
// Utility Functions
// ========================================

function showFeedback(element, message, type) {
    element.textContent = message;
    element.className = `form-feedback ${type}`;
    
    setTimeout(() => {
        element.className = 'form-feedback';
    }, 5000);
}

// Make functions globally accessible
window.deleteSermon = deleteSermon;
window.deleteEvent = deleteEvent;
window.approveTestimony = approveTestimony;
window.rejectTestimony = rejectTestimony;
window.deleteTestimony = deleteTestimony;
window.deleteMessage = deleteMessage;
window.deleteQuote = deleteQuote;
window.deleteMoment = deleteMoment;
