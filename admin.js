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
    setupCustomSectionsAdmin();
    
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
    loadCustomSectionsAdmin();
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

            // New fields
            const sermonBgType = document.getElementById('sermonBgType');
            const sermonBgColor = document.getElementById('sermonBgColor');
            const sermonBgGradient = document.getElementById('sermonBgGradient');
            const socialFacebook = document.getElementById('socialFacebook');
            const socialInstagram = document.getElementById('socialInstagram');
            const socialTwitter = document.getElementById('socialTwitter');
            const socialYoutube = document.getElementById('socialYoutube');
            const joinFamilyBgType = document.getElementById('joinFamilyBgType');
            const joinFamilyBgImage = document.getElementById('joinFamilyBgImage');
            const joinFamilyBgColor = document.getElementById('joinFamilyBgColor');
            const joinFamilyBgGradient = document.getElementById('joinFamilyBgGradient');
            const joinFamilyFellowshipLink = document.getElementById('joinFamilyFellowshipLink');
            const joinFamilyNextStepsLink = document.getElementById('joinFamilyNextStepsLink');
            const joinFamilyServeLink = document.getElementById('joinFamilyServeLink');

            if (sermonBgType) sermonBgType.value = theme.sermonBgType || 'image';
            if (sermonBgColor) sermonBgColor.value = theme.sermonBgColor || '#0f172a';
            if (sermonBgGradient) sermonBgGradient.value = theme.sermonBgGradient || 'linear-gradient(135deg, #0f172a, #1e293b)';
            if (socialFacebook) socialFacebook.value = theme.socialFacebook || '';
            if (socialInstagram) socialInstagram.value = theme.socialInstagram || '';
            if (socialTwitter) socialTwitter.value = theme.socialTwitter || '';
            if (socialYoutube) socialYoutube.value = theme.socialYoutube || '';
            if (joinFamilyBgType) joinFamilyBgType.value = theme.joinFamilyBgType || 'color';
            if (joinFamilyBgImage) joinFamilyBgImage.value = theme.joinFamilyBgImage || '';
            if (joinFamilyBgColor) joinFamilyBgColor.value = theme.joinFamilyBgColor || '#0b1329';
            if (joinFamilyBgGradient) joinFamilyBgGradient.value = theme.joinFamilyBgGradient || 'linear-gradient(135deg, #090d16, #111827)';
            if (joinFamilyFellowshipLink) joinFamilyFellowshipLink.value = theme.joinFamilyFellowshipLink || '#contact';
            if (joinFamilyNextStepsLink) joinFamilyNextStepsLink.value = theme.joinFamilyNextStepsLink || '#contact';
            if (joinFamilyServeLink) joinFamilyServeLink.value = theme.joinFamilyServeLink || '#ministries-serve';
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
                <input type="url" class="hero-img-url" value="${data.url || ''}" required>
            </div>
            <div class="form-group">
                <label>Link URL (Optional)</label>
                <input type="url" class="hero-img-link" value="${data.link || '#'}">
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
                primaryColor: document.getElementById('primaryColor').value,
                secondaryColor: document.getElementById('secondaryColor').value,
                accentColor: document.getElementById('accentColor').value,
                sermonBgType: document.getElementById('sermonBgType').value,
                sermonBgColor: document.getElementById('sermonBgColor').value,
                sermonBgGradient: document.getElementById('sermonBgGradient').value.trim(),
                socialFacebook: document.getElementById('socialFacebook').value.trim(),
                socialInstagram: document.getElementById('socialInstagram').value.trim(),
                socialTwitter: document.getElementById('socialTwitter').value.trim(),
                socialYoutube: document.getElementById('socialYoutube').value.trim(),
                joinFamilyBgType: document.getElementById('joinFamilyBgType').value,
                joinFamilyBgImage: document.getElementById('joinFamilyBgImage').value.trim(),
                joinFamilyBgColor: document.getElementById('joinFamilyBgColor').value,
                joinFamilyBgGradient: document.getElementById('joinFamilyBgGradient').value.trim(),
                joinFamilyFellowshipLink: document.getElementById('joinFamilyFellowshipLink').value.trim(),
                joinFamilyNextStepsLink: document.getElementById('joinFamilyNextStepsLink').value.trim(),
                joinFamilyServeLink: document.getElementById('joinFamilyServeLink').value.trim()
            };
            
            const themeModeEl = document.getElementById('themeMode');
            if (themeModeEl) {
                updates.mode = themeModeEl.value;
            }
            
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
window.deleteSection = deleteSection;
window.editSection = editSection;
window.moveSection = moveSection;
window.toggleCustomIconInput = toggleCustomIconInput;
window.updateSectionLivePreview = updateSectionLivePreview;

// ========================================
// Dynamic Custom Sections Admin Management
// ========================================

async function loadCustomSectionsAdmin() {
    try {
        const listContainer = document.getElementById('sectionsAdminList');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        const snapshot = await safeList(db.collection(Collections.SECTIONS).orderBy('order', 'asc'));

        if (!snapshot || snapshot.empty) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; margin-top: 1rem;">
                    <i data-lucide="layout" style="width: 48px; height: 48px; color: #94a3b8; margin-bottom: 1rem;"></i>
                    <p style="color: #64748b; font-size: 1.1rem; font-weight: 500; margin: 0 0 0.5rem 0;">No dynamic custom sections added yet</p>
                    <p style="color: #94a3b8; font-size: 0.9rem; margin: 0;">Add custom sections to dynamically spotlight ministries, missions, or special services!</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            const card = document.createElement('div');
            card.className = 'item-card';
            card.style = 'display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';

            const countText = data.contentType === 'cards' ? `${data.cards ? data.cards.length : 0} Cards` : 'Text Block';
            const bgText = data.bgType === 'color' ? `Color (${data.bgColor})` : data.bgType === 'gradient' ? 'Gradients' : 'Image';

            card.innerHTML = `
                <div class="item-info" style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <h4 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e293b;">${data.title || 'Untitled'}</h4>
                    <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem;">
                        <span style="font-size: 0.75rem; background: #eff6ff; color: #2563eb; font-weight: 600; padding: 2px 8px; border-radius: 6px;">Order: ${data.order || 0}</span>
                        <span style="font-size: 0.75rem; background: #f0fdf4; color: #16a34a; font-weight: 600; padding: 2px 8px; border-radius: 6px;">Format: ${countText}</span>
                        <span style="font-size: 0.75rem; background: #faf5ff; color: #7c3aed; font-weight: 600; padding: 2px 8px; border-radius: 6px;">Bg: ${bgText}</span>
                    </div>
                </div>
                <div class="item-actions" style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn-admin" style="background: #f1f5f9; color: #334155; padding: 0.4rem; min-width: auto; box-shadow: none;" onclick="moveSection('${id}', -1)" title="Move Up"><i data-lucide="chevron-up"></i></button>
                    <button class="btn-admin" style="background: #f1f5f9; color: #334155; padding: 0.4rem; min-width: auto; box-shadow: none;" onclick="moveSection('${id}', 1)" title="Move Down"><i data-lucide="chevron-down"></i></button>
                    <button class="btn-admin" style="background: var(--primary-color); padding: 0.5rem 1rem;" onclick="editSection('${id}')">Edit</button>
                    <button class="btn-admin" style="background: #ef4444; padding: 0.5rem 1rem;" onclick="deleteSection('${id}')">Delete</button>
                </div>
            `;
            listContainer.appendChild(card);
        });

        if (window.lucide) {
            lucide.createIcons();
        }
    } catch (error) {
        console.error('Error loading custom sections admin list:', error.message || String(error));
    }
}

function setupCustomSectionsAdmin() {
    const addNewBtn = document.getElementById('addNewSectionBtn');
    const cancelBtn = document.getElementById('cancelSectionBtn');
    const formContainer = document.getElementById('sectionFormContainer');
    const form = document.getElementById('customSectionForm');
    
    // Background selection toggles
    const bgTypeSelect = document.getElementById('sectionBgType');
    const bgColGroup = document.getElementById('bgTypeColorGroup');
    const bgGradGroup = document.getElementById('bgTypeGradientGroup');
    const bgImgGroup = document.getElementById('bgTypeImageGroup');
    
    // Title selection toggles
    const titleColorMode = document.getElementById('sectionTitleColorMode');
    const titleColorGroup = document.getElementById('titleColorFormGroup');
    const titleGradGroup = document.getElementById('titleGradientFormGroup');
    const titleGradientSelect = document.getElementById('sectionTitleGradientSelect');
    const titleGradientCustom = document.getElementById('sectionTitleGradientCustom');

    // Layout content selectors
    const bgGradientSelect = document.getElementById('sectionBgGradientSelect');
    const bgGradientCustom = document.getElementById('sectionBgGradientCustom');
    const contentTypeSelect = document.getElementById('sectionContentType');
    const contentTypeTextDiv = document.getElementById('sectionContentTypeText');
    const contentTypeCardsDiv = document.getElementById('sectionContentTypeCards');
    const addCardBtn = document.getElementById('addNewCardBtn');

    if (addNewBtn) {
        addNewBtn.onclick = () => {
            resetSectionForm();
            document.getElementById('sectionFormTitle').textContent = 'Create New Custom Section';
            formContainer.style.display = 'block';
            formContainer.scrollIntoView({ behavior: 'smooth' });
            updateSectionLivePreview();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            formContainer.style.display = 'none';
            resetSectionForm();
        };
    }

    // Toggle Title color modes
    if (titleColorMode) {
        titleColorMode.onchange = () => {
            if (titleColorMode.value === 'gradient') {
                titleColorGroup.style.display = 'none';
                titleGradGroup.style.display = 'block';
            } else {
                titleColorGroup.style.display = 'block';
                titleGradGroup.style.display = 'none';
            }
            updateSectionLivePreview();
        };
    }

    if (titleGradientSelect) {
        titleGradientSelect.onchange = () => {
            if (titleGradientSelect.value === 'custom') {
                titleGradientCustom.style.display = 'block';
            } else {
                titleGradientCustom.style.display = 'none';
            }
            updateSectionLivePreview();
        };
    }

    // Toggle background inputs
    if (bgTypeSelect) {
        bgTypeSelect.onchange = () => {
            bgColGroup.style.display = 'none';
            bgGradGroup.style.display = 'none';
            bgImgGroup.style.display = 'none';

            if (bgTypeSelect.value === 'color') {
                bgColGroup.style.display = 'block';
            } else if (bgTypeSelect.value === 'gradient') {
                bgGradGroup.style.display = 'block';
            } else if (bgTypeSelect.value === 'image') {
                bgImgGroup.style.display = 'block';
            }
            updateSectionLivePreview();
        };
    }

    if (bgGradientSelect) {
        bgGradientSelect.onchange = () => {
            if (bgGradientSelect.value === 'custom') {
                bgGradientCustom.style.display = 'block';
            } else {
                bgGradientCustom.style.display = 'none';
            }
            updateSectionLivePreview();
        };
    }

    // Toggle Content types
    if (contentTypeSelect) {
        contentTypeSelect.onchange = () => {
            if (contentTypeSelect.value === 'text') {
                contentTypeTextDiv.style.display = 'block';
                contentTypeCardsDiv.style.display = 'none';
            } else {
                contentTypeTextDiv.style.display = 'none';
                contentTypeCardsDiv.style.display = 'block';
            }
            updateSectionLivePreview();
        };
    }

    // Dynamic Card Row Addition
    if (addCardBtn) {
        addCardBtn.onclick = () => {
            addCardEditorRow();
            updateSectionLivePreview();
        };
    }

    // Hook up real-time live preview update using robust event delegation
    if (form) {
        form.addEventListener('input', () => {
            updateSectionLivePreview();
        });
        form.addEventListener('change', () => {
            updateSectionLivePreview();
        });
    }

    // Form Submission
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            try {
                const docId = document.getElementById('sectionDocId').value;
                const title = document.getElementById('sectionTitleVal').value.trim();
                const order = parseInt(document.getElementById('sectionOrderVal').value || '0');
                
                // Title styles
                const isGradientTitle = titleColorMode.value === 'gradient';
                let finalTitleColor = document.getElementById('sectionTitleColor').value;
                let finalTitleGradient = '';
                if (isGradientTitle) {
                    finalTitleGradient = titleGradientSelect.value === 'custom' 
                        ? titleGradientCustom.value.trim() 
                        : titleGradientSelect.value;
                }

                // Background settings
                const bgType = bgTypeSelect.value;
                const bgColor = document.getElementById('sectionBgColor').value;
                let bgGradient = '';
                if (bgType === 'gradient') {
                    bgGradient = bgGradientSelect.value === 'custom'
                        ? bgGradientCustom.value.trim()
                        : bgGradientSelect.value;
                }
                const bgImage = document.getElementById('sectionBgImageUrl').value.trim();

                // Content compilation
                const contentType = contentTypeSelect.value;
                const textHTML = document.getElementById('sectionTextHTMLVal').value;
                
                let cardsArray = [];
                if (contentType === 'cards') {
                    const rowNodes = document.querySelectorAll('.card-editor-row');
                    rowNodes.forEach(row => {
                        const titleInp = row.querySelector('.card-row-title').value.trim();
                        const descInp = row.querySelector('.card-row-desc').value.trim();
                        const iconSelect = row.querySelector('.card-row-icon-select').value;
                        const iconCustom = row.querySelector('.card-row-icon-custom').value.trim();
                        const iconSize = row.querySelector('.card-row-icon-size').value;
                        const iconColor = row.querySelector('.card-row-icon-color').value;
                        const iconPosition = row.querySelector('.card-row-icon-pos').value;

                        const finalIcon = iconSelect === 'custom' ? iconCustom : iconSelect;

                        cardsArray.push({
                            title: titleInp,
                            description: descInp,
                            icon: finalIcon,
                            iconSize: iconSize,
                            iconColor: iconColor,
                            iconPosition: iconPosition
                        });
                    });
                }

                const payload = {
                    title,
                    order,
                    useGradient: isGradientTitle,
                    titleColor: finalTitleColor,
                    titleGradient: finalTitleGradient,
                    bgType,
                    bgColor,
                    bgGradient,
                    bgImage,
                    contentType,
                    textHTML,
                    cards: cardsArray,
                    createdAt: docId ? undefined : firebase.firestore.FieldValue.serverTimestamp()
                };

                // Clean undefined fields to avoid Firestore error
                Object.keys(payload).forEach(key => {
                    if (payload[key] === undefined) {
                        delete payload[key];
                    }
                });

                if (docId) {
                    await db.collection(Collections.SECTIONS).doc(docId).update(payload);
                    alert('Section updated successfully!');
                } else {
                    await db.collection(Collections.SECTIONS).add(payload);
                    alert('Section created successfully!');
                }

                formContainer.style.display = 'none';
                resetSectionForm();
                loadCustomSectionsAdmin();
            } catch (error) {
                console.error('Error saving custom section:', error.message || String(error));
                alert('Error saving custom section: ' + (error.message || String(error)));
            }
        };
    }
}

function resetSectionForm() {
    document.getElementById('sectionDocId').value = '';
    document.getElementById('sectionTitleVal').value = '';
    document.getElementById('sectionOrderVal').value = '0';
    
    // Reset title formatting
    document.getElementById('sectionTitleColorMode').value = 'color';
    document.getElementById('sectionTitleColor').value = '#1e293b';
    const titleColorGroup = document.getElementById('titleColorFormGroup');
    const titleGradGroup = document.getElementById('titleGradientFormGroup');
    if (titleColorGroup) titleColorGroup.style.display = 'block';
    if (titleGradGroup) titleGradGroup.style.display = 'none';

    document.getElementById('sectionTitleGradientSelect').value = 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';
    document.getElementById('sectionTitleGradientCustom').value = '';
    document.getElementById('sectionTitleGradientCustom').style.display = 'none';

    // Reset backgrounds
    document.getElementById('sectionBgType').value = 'color';
    document.getElementById('bgTypeColorGroup').style.display = 'block';
    document.getElementById('bgTypeGradientGroup').style.display = 'none';
    document.getElementById('bgTypeImageGroup').style.display = 'none';
    
    document.getElementById('sectionBgColor').value = '#ffffff';
    document.getElementById('sectionBgGradientSelect').value = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
    document.getElementById('sectionBgGradientCustom').value = '';
    document.getElementById('sectionBgGradientCustom').style.display = 'none';
    document.getElementById('sectionBgImageUrl').value = '';

    // Reset content type
    document.getElementById('sectionContentType').value = 'text';
    document.getElementById('sectionContentTypeText').style.display = 'block';
    document.getElementById('sectionContentTypeCards').style.display = 'none';
    
    document.getElementById('sectionTextHTMLVal').value = '';
    document.getElementById('cardsListAdminContainer').innerHTML = '';
}

function addCardEditorRow(cardData = null) {
    const list = document.getElementById('cardsListAdminContainer');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'card-editor-row';
    row.style = 'background: #fafafa; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.5rem; position: relative; margin-bottom: 0.5rem;';

    const count = list.children.length + 1;

    // Preset icons
    const iconPresets = [
        { val: 'heart', text: 'Heart (Hospitality/Care)' },
        { val: 'users', text: 'Users (Community/Fellowship)' },
        { val: 'book-open', text: 'Open Book (Scriptures/Sermons)' },
        { val: 'sparkles', text: 'Sparkles (Grace/Miracles)' },
        { val: 'flame', text: 'Flame (Holy Spirit/Fire)' },
        { val: 'calendar', text: 'Calendar (Weeks/Schedules)' },
        { val: 'music', text: 'Music (Worship/Choir)' },
        { val: 'gift', text: 'Gift (Donations/Charity)' },
        { val: 'mail', text: 'Mail (Contact/Connect)' },
        { val: 'phone', text: 'Phone (Hotlines/Call)' },
        { val: 'compass', text: 'Compass (Discipleship/Evangelism)' },
        { val: 'star', text: 'Star (Faith/Blessing)' },
        { val: 'custom', text: '— Use custom Lucide Icon name —' }
    ];

    const currentIcon = cardData?.icon || 'heart';
    const isPreset = iconPresets.some(preset => preset.val === currentIcon);

    const titleVal = cardData?.title || '';
    const descVal = cardData?.description || '';
    const iconSelectSelected = isPreset ? currentIcon : 'custom';
    const iconCustomVal = isPreset ? '' : currentIcon;
    const iconSizeVal = cardData?.iconSize || '28px';
    const iconColorVal = cardData?.iconColor || '#2563eb';
    const iconPositionVal = cardData?.iconPosition || 'top';

    row.innerHTML = `
        <button type="button" class="btn-delete-card" style="position: absolute; top: 1rem; right: 1rem; background: #fee2e2; color: #ef4444; border: none; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;" onclick="this.closest('.card-editor-row').remove(); if(window.updateSectionLivePreview) window.updateSectionLivePreview();">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Remove
        </button>
        <h5 style="margin-top: 0; margin-bottom: 1rem; font-size: 0.95rem; color: var(--primary-color);">Card #${count}</h5>
        
        <div class="form-row">
            <div class="form-group">
                <label>Card Title</label>
                <input type="text" class="card-row-title" value="${titleVal}" placeholder="e.g. Prayer Group" required>
            </div>
            <div class="form-group">
                <label>Icon Selection</label>
                <select class="card-row-icon-select" onchange="toggleCustomIconInput(this)">
                    ${iconPresets.map(preset => `<option value="${preset.val}" ${preset.val === iconSelectSelected ? 'selected' : ''}>${preset.text}</option>`).join('')}
                </select>
                <input type="text" class="card-row-icon-custom" value="${iconCustomVal}" placeholder="Lucide icon name (e.g. cross, flame)" style="display: ${iconSelectSelected === 'custom' ? 'block' : 'none'}; margin-top: 0.5rem;">
            </div>
        </div>

        <div class="form-group">
            <label>Card Description</label>
            <textarea class="card-row-desc" rows="2" placeholder="Brief card details..." required>${descVal}</textarea>
        </div>

        <div class="form-row" style="margin-bottom: 0;">
            <div class="form-group">
                <label>Icon Position</label>
                <select class="card-row-icon-pos">
                    <option value="top" ${iconPositionVal === 'top' ? 'selected' : ''}>Top alignment</option>
                    <option value="left" ${iconPositionVal === 'left' ? 'selected' : ''}>Left alignment</option>
                </select>
            </div>
            <div class="form-group">
                <label>Icon Size</label>
                <select class="card-row-icon-size">
                    <option value="20px" ${iconSizeVal === '20px' ? 'selected' : ''}>Small (20px)</option>
                    <option value="24px" ${iconSizeVal === '24px' ? 'selected' : ''}>Medium (24px)</option>
                    <option value="28px" ${iconSizeVal === '28px' ? 'selected' : ''}>Large (28px - Default)</option>
                    <option value="36px" ${iconSizeVal === '36px' ? 'selected' : ''}>Extra Large (36px)</option>
                    <option value="48px" ${iconSizeVal === '48px' ? 'selected' : ''}>Giant (48px)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Icon Highlight Color</label>
                <input type="color" class="card-row-icon-color" value="${iconColorVal}">
            </div>
        </div>
    `;

    list.appendChild(row);

    if (window.lucide) {
        lucide.createIcons();
    }
}

function toggleCustomIconInput(selectElem) {
    const customInput = selectElem.nextElementSibling;
    if (customInput) {
        customInput.style.display = selectElem.value === 'custom' ? 'block' : 'none';
    }
}

async function editSection(id) {
    try {
        const doc = await db.collection(Collections.SECTIONS).doc(id).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        resetSectionForm();

        // Populate basic values
        document.getElementById('sectionDocId').value = id;
        document.getElementById('sectionTitleVal').value = data.title || '';
        document.getElementById('sectionOrderVal').value = data.order || '0';

        // Title styling
        const titleModeSelect = document.getElementById('sectionTitleColorMode');
        const isGradient = data.useGradient || false;
        titleModeSelect.value = isGradient ? 'gradient' : 'color';

        const titleColorGroup = document.getElementById('titleColorFormGroup');
        const titleGradGroup = document.getElementById('titleGradientFormGroup');
        const titleGradientSelect = document.getElementById('sectionTitleGradientSelect');
        const titleGradientCustom = document.getElementById('sectionTitleGradientCustom');

        if (isGradient) {
            titleColorGroup.style.display = 'none';
            titleGradGroup.style.display = 'block';

            const presetOption = Array.from(titleGradientSelect.options).find(opt => opt.value === data.titleGradient);
            if (presetOption) {
                titleGradientSelect.value = data.titleGradient;
                titleGradientCustom.style.display = 'none';
            } else {
                titleGradientSelect.value = 'custom';
                titleGradientCustom.value = data.titleGradient || '';
                titleGradientCustom.style.display = 'block';
            }
        } else {
            titleColorGroup.style.display = 'block';
            titleGradGroup.style.display = 'none';
            document.getElementById('sectionTitleColor').value = data.titleColor || '#1e293b';
        }

        // Background settings
        const bgTypeSelect = document.getElementById('sectionBgType');
        bgTypeSelect.value = data.bgType || 'color';

        const bgColGroup = document.getElementById('bgTypeColorGroup');
        const bgGradGroup = document.getElementById('bgTypeGradientGroup');
        const bgImgGroup = document.getElementById('bgTypeImageGroup');

        bgColGroup.style.display = 'none';
        bgGradGroup.style.display = 'none';
        bgImgGroup.style.display = 'none';

        if (data.bgType === 'color') {
            bgColGroup.style.display = 'block';
            document.getElementById('sectionBgColor').value = data.bgColor || '#ffffff';
        } else if (data.bgType === 'gradient') {
            bgGradGroup.style.display = 'block';
            const bgGradSelect = document.getElementById('sectionBgGradientSelect');
            const bgGradCustom = document.getElementById('sectionBgGradientCustom');

            const bgPresetOption = Array.from(bgGradSelect.options).find(opt => opt.value === data.bgGradient);
            if (bgPresetOption) {
                bgGradSelect.value = data.bgGradient;
                bgGradCustom.style.display = 'none';
            } else {
                bgGradSelect.value = 'custom';
                bgGradCustom.value = data.bgGradient || '';
                bgGradCustom.style.display = 'block';
            }
        } else if (data.bgType === 'image') {
            bgImgGroup.style.display = 'block';
            document.getElementById('sectionBgImageUrl').value = data.bgImage || '';
        }

        // Layout settings
        const layoutSelect = document.getElementById('sectionContentType');
        layoutSelect.value = data.contentType || 'text';

        const layoutTextDiv = document.getElementById('sectionContentTypeText');
        const layoutCardsDiv = document.getElementById('sectionContentTypeCards');

        if (data.contentType === 'cards') {
            layoutTextDiv.style.display = 'none';
            layoutCardsDiv.style.display = 'block';

            if (data.cards && data.cards.length > 0) {
                data.cards.forEach(card => {
                    addCardEditorRow(card);
                });
            }
        } else {
            layoutTextDiv.style.display = 'block';
            layoutCardsDiv.style.display = 'none';
            document.getElementById('sectionTextHTMLVal').value = data.textHTML || '';
        }

        // Display compiler window
        const formContainer = document.getElementById('sectionFormContainer');
        document.getElementById('sectionFormTitle').textContent = `Edit Section: ${data.title || 'Untitled'}`;
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
        updateSectionLivePreview();
    } catch (error) {
        console.error('Error fetching section for edit:', error.message || String(error));
        alert('Could not edit this section.');
    }
}

async function deleteSection(id) {
    if (confirm('Are you sure you want to delete this custom section? This will remove it from the home page completely!')) {
        try {
            await db.collection(Collections.SECTIONS).doc(id).delete();
            loadCustomSectionsAdmin();
        } catch (error) {
            console.error('Error deleting section:', error.message || String(error));
            alert('Error deleting section');
        }
    }
}

async function moveSection(id, direction) {
    try {
        const sectionsRef = db.collection(Collections.SECTIONS);
        const snapshot = await safeList(sectionsRef.orderBy('order', 'asc'));
        
        if (!snapshot || snapshot.empty) return;

        const list = [];
        snapshot.forEach(doc => {
            list.push({ id: doc.id, ...doc.data() });
        });

        const index = list.findIndex(item => item.id === id);
        if (index === -1) return;

        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) {
            return; // Can't move past boundaries
        }

        // Swap orders
        const tempOrder = list[index].order || 0;
        const potentialCollidingOrder = list[targetIndex].order || 0;

        // If they have identical orders, fix the whole sequence first
        let currentOrder = tempOrder;
        let swapOrder = potentialCollidingOrder;

        if (currentOrder === swapOrder) {
            // Assign sequential orders
            for (let i = 0; i < list.length; i++) {
                await sectionsRef.doc(list[i].id).update({ order: i });
                list[i].order = i;
            }
            // Re-fetch index and swap
            currentOrder = index;
            swapOrder = targetIndex;
        }

        await sectionsRef.doc(list[index].id).update({ order: swapOrder });
        await sectionsRef.doc(list[targetIndex].id).update({ order: currentOrder });

        loadCustomSectionsAdmin();
    } catch (error) {
        console.error('Error reordering sections:', error.message || String(error));
        alert('Could not update sequence. Please try again.');
    }
}

// ========================================
// Live Preview Renderer Routine
// ========================================

function updateSectionLivePreview() {
    try {
        const previewContainer = document.getElementById('liveSectionPreviewRender');
        if (!previewContainer) return;

        const titleVal = document.getElementById('sectionTitleVal').value.trim() || 'Your Section Title';
        const titleMode = document.getElementById('sectionTitleColorMode').value;
        const useGradient = titleMode === 'gradient';
        
        // Extract title coloring settings
        let finalTitleColor = document.getElementById('sectionTitleColor').value;
        let finalTitleGradient = '';
        if (useGradient) {
            const titleGradientSelect = document.getElementById('sectionTitleGradientSelect').value;
            finalTitleGradient = titleGradientSelect === 'custom' 
                ? document.getElementById('sectionTitleGradientCustom').value.trim() 
                : titleGradientSelect;
            if (!finalTitleGradient) {
                finalTitleGradient = 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';
            }
        }

        // Background settings
        const bgType = document.getElementById('sectionBgType').value;
        const bgColor = document.getElementById('sectionBgColor').value;
        
        let bgGradient = '';
        if (bgType === 'gradient') {
            const bgGradientSelect = document.getElementById('sectionBgGradientSelect').value;
            bgGradient = bgGradientSelect === 'custom'
                ? document.getElementById('sectionBgGradientCustom').value.trim()
                : bgGradientSelect;
            if (!bgGradient) {
                bgGradient = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
            }
        }
        const bgImage = document.getElementById('sectionBgImageUrl').value.trim();

        // Gather background inline styling with cozy standard padding
        let bgStyle = '';
        if (bgType === 'image' && bgImage) {
            bgStyle = `background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.65)), url('${bgImage}'); background-size: cover; background-position: center; background-attachment: scroll; padding: 4rem 2rem;`;
        } else if (bgType === 'gradient' && bgGradient) {
            bgStyle = `background: ${bgGradient}; padding: 4rem 2rem;`;
        } else if (bgType === 'color' && bgColor) {
            bgStyle = `background-color: ${bgColor}; padding: 4rem 2rem;`;
        } else {
            bgStyle = `background: var(--bg-white, #ffffff); padding: 4rem 2rem;`;
        }

        // Gather title inline styling
        let titleStyle = '';
        let titleClass = '';
        if (useGradient && finalTitleGradient) {
            titleStyle = `background: ${finalTitleGradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; display: inline-block;`;
            titleClass = 'gradient-title';
        } else if (finalTitleColor) {
            titleStyle = `color: ${finalTitleColor};`;
        }

        // Heuristics for dark background to determine text readability colors
        const isDarkBg = bgType === 'image' || (bgType === 'color' && isColorDark(bgColor)) || (bgType === 'gradient' && isGradientDark(bgGradient));
        let titleDefaultColor = isDarkBg ? '#ffffff' : 'var(--text-dark, #0f172a)';

        const contentType = document.getElementById('sectionContentType').value;
        
        // Avoid undefined on text area
        const textInpElement = document.getElementById('sectionTextHTMLVal');
        const textHTML = textInpElement ? textInpElement.value : '';

        let contentHTML = '';
        if (contentType === 'text') {
            contentHTML = `
                <div class="custom-section-text-content" style="color: ${isDarkBg ? '#f1f5f9' : 'var(--text-dark, #0f172a)'}; max-width: 900px; margin: 0 auto; line-height: 1.8; font-size: 1.1rem; text-align: left;">
                    ${textHTML || '<p style="color: #94a3b8; font-style: italic; text-align: center; margin: 0;">Enter formatted or plain text content in the form field above to see it here...</p>'}
                </div>
            `;
        } else if (contentType === 'cards') {
            const rowNodes = document.querySelectorAll('.card-editor-row');
            const cardsArray = [];
            rowNodes.forEach(row => {
                const titleInp = row.querySelector('.card-row-title').value.trim();
                const descInp = row.querySelector('.card-row-desc').value.trim();
                const iconSelect = row.querySelector('.card-row-icon-select').value;
                const iconCustom = row.querySelector('.card-row-icon-custom').value.trim();
                const iconSize = row.querySelector('.card-row-icon-size').value;
                const iconColor = row.querySelector('.card-row-icon-color').value;
                const iconPosition = row.querySelector('.card-row-icon-pos').value;

                const finalIcon = iconSelect === 'custom' ? iconCustom : iconSelect;

                cardsArray.push({
                    title: titleInp,
                    description: descInp,
                    icon: finalIcon,
                    iconSize: iconSize,
                    iconColor: iconColor,
                    iconPosition: iconPosition
                });
            });

            if (cardsArray.length === 0) {
                contentHTML = `
                    <div style="text-align: center; color: #94a3b8; font-style: italic; padding: 2rem;">
                        No cards added yet. Click 'Add Card' above to start organizing items!
                    </div>
                `;
            } else {
                const cardsHTML = cardsArray.map(card => {
                    const iconPos = card.iconPosition || 'top';
                    const iconStyle = `width: ${card.iconSize || '28px'}; height: ${card.iconSize || '28px'}; color: ${card.iconColor || 'var(--primary-color)'}; flex-shrink: 0;`;
                    
                    const cardBg = isDarkBg ? 'rgba(255,255,255,0.06)' : 'var(--card-bg, #ffffff)';
                    const cardBorder = isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
                    const cardColor = isDarkBg ? '#f8fafc' : 'var(--text-dark)';
                    const cardDescColor = isDarkBg ? '#cbd5e1' : 'var(--text-muted)';
                    const shadow = isDarkBg ? '0 10px 30px -10px rgba(0,0,0,0.5)' : 'var(--card-shadow, 0 4px 6px -1px rgba(0,0,0,0.05))';

                    if (iconPos === 'left') {
                        return `
                            <div class="custom-dyn-card left-icon" style="background: ${cardBg}; border: 1px solid ${cardBorder}; box-shadow: ${shadow}; color: ${cardColor}; display: flex; text-align: left; padding: 1.5rem; border-radius: 12px;">
                                ${card.icon ? `
                                <div class="custom-dyn-icon" style="margin-right: 1.25rem; margin-top: 0.2rem; display: flex;">
                                    <i data-lucide="${card.icon}" style="${iconStyle}"></i>
                                </div>` : ''}
                                <div class="custom-dyn-body">
                                    <h3 style="color: ${cardColor}; font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem 0; line-height: 1.4;">${card.title || 'Untitled Card'}</h3>
                                    <p style="color: ${cardDescColor}; margin: 0; font-size: 0.9rem; line-height: 1.5;">${card.description || 'Enter details...'}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="custom-dyn-card top-icon" style="background: ${cardBg}; border: 1px solid ${cardBorder}; box-shadow: ${shadow}; color: ${cardColor}; display: flex; flex-direction: column; text-align: left; padding: 1.5rem; border-radius: 12px;">
                                ${card.icon ? `
                                <div class="custom-dyn-icon" style="margin-bottom: 1rem; display: flex;">
                                    <i data-lucide="${card.icon}" style="${iconStyle}"></i>
                                </div>` : ''}
                                <div class="custom-dyn-body">
                                    <h3 style="color: ${cardColor}; font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem 0; line-height: 1.4;">${card.title || 'Untitled Card'}</h3>
                                    <p style="color: ${cardDescColor}; margin: 0; font-size: 0.9rem; line-height: 1.5;">${card.description || 'Enter details...'}</p>
                                </div>
                            </div>
                        `;
                    }
                }).join('');

                contentHTML = `
                    <div class="custom-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; width: 100%;">
                        ${cardsHTML}
                    </div>
                `;
            }
        }

        const previewHTML = `
            <div style="${bgStyle} position: relative; overflow: hidden; width: 100%; box-sizing: border-box; text-align: center;">
                <div style="max-width: 1100px; margin: 0 auto; position: relative; z-index: 2; width: 100%; box-sizing: border-box;">
                    <div style="margin-bottom: 2.5rem; text-align: center;">
                        <h2 class="${titleClass}" style="${titleStyle || `color: ${titleDefaultColor};`}; font-size: clamp(1.5rem, 3.2vw, 2.1rem); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.75rem; margin-top: 0;">
                            ${titleVal}
                        </h2>
                        <div style="background: ${useGradient && finalTitleGradient ? 'var(--primary-color)' : (finalTitleColor || 'var(--primary-color)')}; margin: 0 auto; width: 50px; height: 4px; border-radius: 4px;"></div>
                    </div>
                    ${contentHTML}
                </div>
            </div>
        `;

        previewContainer.innerHTML = previewHTML;

        // Re-initialize Lucide icons for new content
        if (window.lucide) {
            window.lucide.createIcons();
        }
    } catch (err) {
        console.error('Error updating live preview:', err);
    }
}

function isColorDark(colorHex) {
    if (!colorHex || colorHex[0] !== '#') return false;
    const cleanHex = colorHex.replace('#', '');
    let r, g, b;
    if (cleanHex.length === 3) {
        r = parseInt(cleanHex[0] + cleanHex[0], 16);
        g = parseInt(cleanHex[1] + cleanHex[1], 16);
        b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
        r = parseInt(cleanHex.slice(0, 2), 16);
        g = parseInt(cleanHex.slice(2, 4), 16);
        b = parseInt(cleanHex.slice(4, 6), 16);
    } else {
        return false;
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.65;
}

function isGradientDark(gradientStr) {
    if (!gradientStr) return false;
    const lower = gradientStr.toLowerCase();
    if (lower.includes('black') || lower.includes('#00') || lower.includes('#0f') || lower.includes('#1') || lower.includes('#2') || lower.includes('rgb(0') || lower.includes('dark')) {
        return true;
    }
    return false;
}
