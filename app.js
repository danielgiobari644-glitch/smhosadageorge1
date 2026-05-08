// Public Site JavaScript - Salvation Ministries Ada George
// Handles dynamic content loading, form submissions, and real-time updates

// Wait for Firebase to initialize
document.addEventListener('DOMContentLoaded', () => {
    waitForFirebase().then(() => {
        initializeSite();
    });
});

function initializeSite() {
    // Load all dynamic content
    loadThemeSettings();
    loadAboutContent();
    loadQuotes();
    loadServiceTimes();
    loadSermons();
    loadEvents();
    loadMoments();
    loadTestimonies();
    loadContactInfo();
    loadOfferingDetails();
    
    // Setup navigation
    setupNavigation();
    
    // Setup form handlers
    setupTestimonyForm();
    setupContactForm();

    // Setup moments tabs
    setupMomentsTabs();

    // Initialize icons
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Listen for real-time updates
    setupRealtimeListeners();
}

// ========================================
// Navigation
// ========================================

function setupNavigation() {
    const navToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Mobile menu toggle
    navToggle?.addEventListener('click', () => {
        const isActive = navMenu.classList.toggle('active');
        const icon = navToggle.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isActive ? 'x' : 'menu');
            if (window.lucide) lucide.createIcons();
        }
    });
    
    // Smooth scroll and close menu
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    navMenu.classList.remove('active');
                    const icon = navToggle?.querySelector('i');
                    if (icon) {
                        icon.setAttribute('data-lucide', 'menu');
                        if (window.lucide) lucide.createIcons();
                    }
                }
            }
        });
    });
}

// ========================================
// Theme Settings
// ========================================

let heroInterval = null;

async function loadThemeSettings() {
    try {
        const doc = await db.collection(Collections.SETTINGS).doc('theme').get();
        if (doc.exists) {
            const theme = doc.data();
            
            if (heroInterval) {
                clearInterval(heroInterval);
                heroInterval = null;
            }
            
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
                const logos = document.querySelectorAll('.nav-logo img, .footer-logo img');
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
            
            // Update hero section
            const heroBackground = document.getElementById('heroBackground');
            const heroTitle = document.getElementById('heroTitle');
            const heroSubtext = document.getElementById('heroSubtext');
            
            if (heroBackground) {
                const mode = theme.heroMode || 'collage';
                const items = (theme.heroImages || []).filter(img => img && img.url);
                
                if (items.length > 0) {
                    heroBackground.innerHTML = '';
                    if (mode === 'single') {
                        const img = items[0];
                        heroBackground.innerHTML = `
                            <div class="hero-single" style="background-image: url('${img.url}')"></div>
                        `;
                    } else if (mode === 'collage') {
                        const collage = document.createElement('div');
                        collage.className = 'hero-collage';
                        items.slice(0, 8).forEach(img => {
                            const item = document.createElement('a');
                            item.href = img.link || '#';
                            item.className = 'hero-collage-item';
                            item.style.backgroundImage = `url('${img.url}')`;
                            collage.appendChild(item);
                        });
                        heroBackground.appendChild(collage);
                    } else if (mode === 'slideshow') {
                        const slideshow = document.createElement('div');
                        slideshow.className = 'hero-slideshow';
                        items.forEach((img, index) => {
                            const slide = document.createElement('a');
                            slide.href = img.link || '#';
                            slide.className = `hero-slide ${index === 0 ? 'active' : ''}`;
                            slide.style.backgroundImage = `url('${img.url}')`;
                            slideshow.appendChild(slide);
                        });
                        heroBackground.appendChild(slideshow);
                        
                        if (items.length > 1) {
                            let currentSlide = 0;
                            heroInterval = setInterval(() => {
                                const slides = slideshow.querySelectorAll('.hero-slide');
                                if (slides.length > 0) {
                                    slides[currentSlide].classList.remove('active');
                                    currentSlide = (currentSlide + 1) % slides.length;
                                    slides[currentSlide].classList.add('active');
                                }
                            }, 5000);
                        }
                    }
                } else if (theme.heroImage) {
                    heroBackground.innerHTML = `
                        <div class="hero-single" style="background-image: url('${theme.heroImage}')"></div>
                    `;
                }
                // If everything is empty, heroBackground remains as it is in HTML (empty), 
                // letting the CSS background of .hero show through.
            }
            
            if (heroTitle && theme.heroText) heroTitle.textContent = theme.heroText;
            if (heroSubtext && theme.heroSubtext) heroSubtext.textContent = theme.heroSubtext;
            
            // Update section backgrounds
            const sermonSections = document.querySelectorAll('.sermon-teaser, #sermonHeader');
            if (sermonSections.length > 0 && theme.sermonBackground) {
                sermonSections.forEach(sec => {
                    sec.style.cssText += `; background-image: url('${theme.sermonBackground}') !important;`;
                });
            }

            const testimoniesSection = document.querySelector('.testimonies-section');
            if (testimoniesSection && theme.testimonyBackground) {
                testimoniesSection.style.cssText += `; background-image: url('${theme.testimonyBackground}') !important;`;
            }
            
            // Update hero buttons
            const heroLivestreamBtn = document.getElementById('heroLivestreamBtn');
            if (heroLivestreamBtn && theme.livestreamUrl) {
                heroLivestreamBtn.href = theme.livestreamUrl;
            }
            
            // Apply dark mode if set
            if (theme.mode === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }
    } catch (error) {
        console.error('Error loading theme settings:', error.message || error);
    }
}

// ========================================
// About Content
// ========================================

async function loadAboutContent() {
    try {
        const doc = await db.collection(Collections.CONTENT).doc('about').get();
        if (doc.exists) {
            const content = doc.data();
            
            const missionText = document.getElementById('missionText');
            const visionText = document.getElementById('visionText');
            const welcomeText = document.getElementById('welcomeText');
            
            const missionImg = document.getElementById('missionImage');
            const visionImg = document.getElementById('visionImage');
            const welcomeImg = document.getElementById('welcomeImage');
            
            const DEFAULT_CHURCH_IMG = 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?w=1200&q=80';

            if (missionText && content.mission) missionText.textContent = content.mission;
            if (visionText && content.vision) visionText.textContent = content.vision;
            if (welcomeText && content.welcomeMessage) welcomeText.textContent = content.welcomeMessage;
            
            if (missionImg) missionImg.src = content.missionImage || DEFAULT_CHURCH_IMG;
            if (visionImg) visionImg.src = content.visionImage || DEFAULT_CHURCH_IMG;
            if (welcomeImg) welcomeImg.src = content.welcomeImage || DEFAULT_CHURCH_IMG;
        }
    } catch (error) {
        console.error('Error loading about content:', error.message || error);
    }
}

// ========================================
// Daily Quotes
// ========================================

async function loadQuotes() {
    try {
        const container = document.getElementById('quoteContainer');
        if (!container) return;

        // Fetch all quotes ordered by date to avoid composite index requirement
        const snapshot = await db.collection(Collections.QUOTES)
            .orderBy('createdAt', 'desc')
            .get();

        const activeQuote = snapshot.docs.find(doc => doc.data().active === true);

        if (activeQuote) {
            const quote = activeQuote.data();
            if (quote.type === 'image') {
                container.innerHTML = `
                    <div class="quote-slide">
                        <img src="${quote.imageUrl}" class="quote-item-image" alt="Daily Quote">
                    </div>
                `;
            } else if (quote.type === 'both') {
                container.innerHTML = `
                    <div class="quote-slide">
                        <img src="${quote.imageUrl}" class="quote-item-image" alt="Daily Quote" style="margin-bottom: 2rem;">
                        <blockquote>"${quote.text}"</blockquote>
                        ${quote.author ? `<cite>— ${quote.author}</cite>` : ''}
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <blockquote>"${quote.text}"</blockquote>
                    ${quote.author ? `<cite>— ${quote.author}</cite>` : ''}
                `;
            }
        } else {
            container.innerHTML = '<p>The word of God is a lamp unto my feet and a light unto my path.</p><cite>— Psalm 119:105</cite>';
        }
    } catch (error) {
        console.error('Error loading quotes:', error.message || error);
    }
}

// ========================================
// Service Times
// ========================================

async function loadServiceTimes() {
    try {
        const doc = await db.collection(Collections.SERVICES).doc('schedule').get();
        if (doc.exists) {
            const schedule = doc.data();
            
            // Update Sunday services
            for (let i = 1; i <= 4; i++) {
                const key = `sunday${i}`;
                if (schedule[key]) {
                    const card = document.getElementById(`sundayService${i}`);
                    if (card) {
                        card.querySelector('.service-title').textContent = schedule[key].title;
                        card.querySelector('.service-time').textContent = schedule[key].time;
                        card.querySelector('.service-description').textContent = schedule[key].description;
                    }
                }
            }
            
            // Update midweek service
            if (schedule.midweek) {
                const midweekCard = document.getElementById('midweekService');
                if (midweekCard) {
                    midweekCard.querySelector('.service-title').textContent = schedule.midweek.title;
                    midweekCard.querySelector('.service-time').textContent = schedule.midweek.time;
                    midweekCard.querySelector('.service-description').textContent = schedule.midweek.description;
                }
            }
            
            // Update special service
            if (schedule.special) {
                const specialCard = document.getElementById('specialService');
                if (specialCard) {
                    specialCard.querySelector('.service-title').textContent = schedule.special.title;
                    specialCard.querySelector('.service-time').textContent = schedule.special.time;
                    specialCard.querySelector('.service-description').textContent = schedule.special.description;
                }
            }
        }
    } catch (error) {
        console.error('Error loading service times:', error.message || error);
    }
}

// ========================================
// Sermons
// ========================================

async function loadSermons() {
    try {
        const sermonsGrid = document.getElementById('sermonsGrid');
        const sermonsEmpty = document.getElementById('sermonsEmpty');
        const searchBox = document.getElementById('sermonsSearch');
        
        if (!sermonsGrid || !sermonsEmpty) return;

        // On sermons.html page, load all. On index.html, it's a teaser anyway.
        const isFullPage = window.location.pathname.includes('sermons.html');
        
        let query = db.collection(Collections.SERMONS).orderBy('date', 'desc');
        if (!isFullPage) {
            query = query.limit(6);
        } else {
            if (searchBox) searchBox.style.display = 'block';
        }

        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            sermonsEmpty.style.display = 'none';
            sermonsGrid.innerHTML = '';
            
            snapshot.forEach(doc => {
                const sermon = doc.data();
                const card = createSermonCard(sermon);
                sermonsGrid.appendChild(card);
            });

            if (isFullPage) {
                setupSermonSearch(snapshot.docs.map(doc => doc.data()));
            }
        } else {
            sermonsEmpty.style.display = 'block';
            sermonsGrid.innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading sermons:', error.message || error);
    }
}

function setupSermonSearch(sermons) {
    const input = document.getElementById('sermonSearchInput');
    if (!input) return;

    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const grid = document.getElementById('sermonsGrid');
        if (!grid) return;

        grid.innerHTML = '';
        const filtered = sermons.filter(s => 
            s.title.toLowerCase().includes(term) || 
            (s.description && s.description.toLowerCase().includes(term))
        );

        if (filtered.length > 0) {
            filtered.forEach(s => grid.appendChild(createSermonCard(s)));
        } else {
            // Show empty state or message
        }
    });
}

function createSermonCard(sermon) {
    const card = document.createElement('div');
    card.className = 'card sermon-card';
    
    const videoId = extractYouTubeId(sermon.videoUrl);
    
    card.innerHTML = `
        <div class="sermon-video">
            <iframe 
                src="https://www.youtube.com/embed/${videoId}" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        </div>
        <div class="sermon-info">
            <h3 class="sermon-title">${sermon.title}</h3>
            <div class="sermon-date">${formatDate(sermon.date)}</div>
            ${sermon.description ? `<p class="sermon-description">${sermon.description}</p>` : ''}
        </div>
    `;
    
    return card;
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
}

// ========================================
// Events
// ========================================

let currentEventSlide = 0;
let eventSlidesCount = 0;
let eventSliderInterval = null;

async function loadEvents() {
    try {
        const eventsGrid = document.getElementById('eventsGrid');
        const eventsSlider = document.getElementById('eventsPosterSlider');
        
        if (!eventsGrid || !eventsSlider) return;

        const snapshot = await db.collection(Collections.EVENTS)
            .orderBy('date', 'asc')
            .get();
        
        if (!snapshot.empty) {
            eventsGrid.innerHTML = '';
            
            const events = [];
            snapshot.forEach(doc => events.push(doc.data()));
            eventSlidesCount = events.length;
            
            events.forEach((event) => {
                const card = createEventCard(event);
                eventsGrid.appendChild(card);
            });

            setupEventSlider();
            if (window.lucide) {
                lucide.createIcons();
            }
        } else {
            eventsGrid.innerHTML = '<div class="event-poster-item"><img src="https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80" alt="No Events"></div>';
        }
    } catch (error) {
        console.error('Error loading events:', error.message || error);
    }
}

function setupEventSlider() {
    const prevBtn = document.getElementById('eventPrev');
    const nextBtn = document.getElementById('eventNext');
    
    if (prevBtn) prevBtn.onclick = () => {
        moveEventSlide(-1);
        resetEventInterval();
    };
    if (nextBtn) nextBtn.onclick = () => {
        moveEventSlide(1);
        resetEventInterval();
    };
    
    resetEventInterval();
}

function resetEventInterval() {
    if (eventSliderInterval) clearInterval(eventSliderInterval);
    eventSliderInterval = setInterval(() => moveEventSlide(1), 5000);
}

function moveEventSlide(direction) {
    currentEventSlide = (currentEventSlide + direction + eventSlidesCount) % eventSlidesCount;
    updateEventSlider();
}

function goToEventSlide(index) {
    currentEventSlide = index;
    updateEventSlider();
}

function updateEventSlider() {
    const track = document.getElementById('eventsGrid');
    
    if (track) {
        track.style.transform = `translateX(-${currentEventSlide * 100}%)`;
    }
}

function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-poster-item';
    
    card.innerHTML = `
        <img src="${event.imageUrl}" alt="${event.title}" referrerPolicy="no-referrer">
    `;
    
    return card;
}

// ========================================
// Moments
// ========================================

let currentMomentSlide = 0;
let momentSlidesCount = 0;
let momentSliderInterval = null;

async function loadMoments() {
    try {
        const photosTrack = document.getElementById('photosTrack');
        const videosTrack = document.getElementById('videosTrack');
        const momentDots = document.getElementById('momentDots');
        
        if (!photosTrack || !videosTrack) return;

        const snapshot = await db.collection(Collections.MOMENTS)
            .orderBy('createdAt', 'desc')
            .get();
        
        const photos = [];
        const videos = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'photo') photos.push(data);
            else if (data.type === 'video') videos.push(data);
        });

        // Load Photos
        if (photos.length > 0) {
            photosTrack.innerHTML = '';
            momentDots.innerHTML = '';
            momentSlidesCount = photos.length;
            
            photos.forEach((photo, index) => {
                const slide = document.createElement('div');
                slide.className = 'moment-slide';
                slide.innerHTML = `
                    <img src="${photo.url}" alt="${photo.title || ''}" referrerPolicy="no-referrer">
                    ${(photo.title || photo.description) ? `
                        <div class="moment-info">
                            ${photo.title ? `<h3>${photo.title}</h3>` : ''}
                            ${photo.description ? `<p>${photo.description}</p>` : ''}
                        </div>
                    ` : ''}
                `;
                photosTrack.appendChild(slide);
                
                const dot = document.createElement('button');
                dot.className = `slider-dot ${index === 0 ? 'active' : ''}`;
                dot.onclick = () => goToMomentSlide(index);
                momentDots.appendChild(dot);
            });
            setupMomentSlider();
        }

        // Load Videos
        if (videos.length > 0) {
            videosTrack.innerHTML = '';
            videos.forEach(video => {
                const card = document.createElement('div');
                card.className = 'video-card';
                card.innerHTML = `
                    <a href="${video.url}" target="_blank" class="video-thumb">
                        <i data-lucide="play-circle"></i>
                    </a>
                    <div class="video-content">
                        <h3>${video.title || 'Church Moment'}</h3>
                    </div>
                `;
                videosTrack.appendChild(card);
            });
            if (window.lucide) lucide.createIcons();
        }
    } catch (error) {
        console.error('Error loading moments:', error.message || error);
    }
}

function setupMomentsTabs() {
    const tabs = document.querySelectorAll('.moment-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const type = tab.dataset.type;
            document.querySelectorAll('.moments-gallery').forEach(g => g.classList.remove('active'));
            document.getElementById(`${type}Gallery`).classList.add('active');
        });
    });
}

function setupMomentSlider() {
    const prevBtn = document.getElementById('momentPrev');
    const nextBtn = document.getElementById('momentNext');
    
    if (prevBtn) prevBtn.onclick = () => {
        moveMomentSlide(-1);
        resetMomentInterval();
    };
    if (nextBtn) nextBtn.onclick = () => {
        moveMomentSlide(1);
        resetMomentInterval();
    };
    
    resetMomentInterval();
}

function resetMomentInterval() {
    if (momentSliderInterval) clearInterval(momentSliderInterval);
    momentSliderInterval = setInterval(() => moveMomentSlide(1), 6000);
}

function moveMomentSlide(direction) {
    if (momentSlidesCount === 0) return;
    currentMomentSlide = (currentMomentSlide + direction + momentSlidesCount) % momentSlidesCount;
    updateMomentSlider();
}

function goToMomentSlide(index) {
    currentMomentSlide = index;
    updateMomentSlider();
    resetMomentInterval();
}

function updateMomentSlider() {
    const track = document.getElementById('photosTrack');
    const dots = document.querySelectorAll('#momentDots .slider-dot');
    
    if (track) {
        track.style.transform = `translateX(-${currentMomentSlide * 100}%)`;
    }
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentMomentSlide);
    });
}

// ========================================
// Testimonies
// ========================================

let currentTestimonySlide = 0;
let testimonySlidesCount = 0;

async function loadTestimonies() {
    try {
        const testimoniesGrid = document.getElementById('testimoniesGrid');
        const testimoniesEmpty = document.getElementById('testimoniesEmpty');
        
        if (!testimoniesGrid || !testimoniesEmpty) return;

        // Fetch all testimonies ordered by date to avoid composite index requirement
        const snapshot = await db.collection(Collections.TESTIMONIES)
            .orderBy('submittedAt', 'desc')
            .get();
        
        const approvedTestimonies = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.approved === true) {
                approvedTestimonies.push(data);
            }
        });

        if (approvedTestimonies.length > 0) {
            testimoniesEmpty.style.display = 'none';
            testimoniesGrid.innerHTML = '';
            testimonySlidesCount = approvedTestimonies.length;
            
            approvedTestimonies.forEach(testimony => {
                const slide = document.createElement('div');
                slide.className = 'testimony-slide';
                slide.innerHTML = `
                    <div class="testimony-quote-icon">
                        <i data-lucide="quote"></i>
                    </div>
                    <p class="testimony-text">${testimony.message}</p>
                    <div class="testimony-author">${testimony.name}</div>
                `;
                testimoniesGrid.appendChild(slide);
            });
            
            // Re-initialize Lucide icons for the new content
            if (window.lucide) {
                window.lucide.createIcons();
            }
            
            setupTestimonySlider();
        } else {
            testimoniesEmpty.style.display = 'block';
            testimoniesGrid.innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading testimonies:', error.message || error);
    }
}

function setupTestimonySlider() {
    const prevBtn = document.getElementById('testimonyPrev');
    const nextBtn = document.getElementById('testimonyNext');
    let testimonyInterval;

    const startAutoSlide = () => {
        if (testimonyInterval) clearInterval(testimonyInterval);
        testimonyInterval = setInterval(() => moveTestimonySlide(1), 10000);
    };

    if (prevBtn) prevBtn.onclick = () => {
        moveTestimonySlide(-1);
        startAutoSlide();
    };
    if (nextBtn) nextBtn.onclick = () => {
        moveTestimonySlide(1);
        startAutoSlide();
    };

    startAutoSlide();
}

function moveTestimonySlide(direction) {
    if (testimonySlidesCount === 0) return;
    currentTestimonySlide = (currentTestimonySlide + direction + testimonySlidesCount) % testimonySlidesCount;
    const track = document.getElementById('testimoniesGrid');
    if (track) {
        track.style.transform = `translateX(-${currentTestimonySlide * 100}%)`;
    }
}

// ========================================
// Contact Info
// ========================================

async function loadContactInfo() {
    try {
        const doc = await db.collection(Collections.CONTENT).doc('contact').get();
        if (doc.exists) {
            const contact = doc.data();
            
            const emailEl = document.getElementById('contactEmail');
            const phoneEl = document.getElementById('contactPhone');
            const addressEl = document.getElementById('contactAddress');
            
            if (emailEl && contact.email) emailEl.textContent = contact.email;
            if (phoneEl && contact.phone) phoneEl.textContent = contact.phone;
            if (addressEl && contact.address) addressEl.textContent = contact.address;
        }
    } catch (error) {
        console.error('Error loading contact info:', error.message || error);
    }
}

// ========================================
// Mobile Menu
// ========================================

function setupMobileMenu() {
    const toggle = document.getElementById('mobileToggle');
    const menu = document.getElementById('navMenu');
    
    if (!toggle || !menu) return;
    
    toggle.addEventListener('click', () => {
        menu.classList.toggle('active');
        const icon = toggle.querySelector('i');
        if (menu.classList.contains('active')) {
            icon.setAttribute('data-lucide', 'x');
        } else {
            icon.setAttribute('data-lucide', 'menu');
        }
        if (window.lucide) lucide.createIcons();
    });
    
    // Close menu when clicking a link
    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
            const icon = toggle.querySelector('i');
            icon.setAttribute('data-lucide', 'menu');
            if (window.lucide) lucide.createIcons();
        });
    });
}

// ========================================
// Offering Details
// ========================================

async function loadOfferingDetails() {
    try {
        const doc = await db.collection(Collections.CONTENT).doc('contact').get();
        if (doc.exists) {
            const contact = doc.data();
            const container = document.getElementById('offeringAccounts');
            if (!container) return;
            
            if (contact.offeringAccounts && contact.offeringAccounts.length > 0) {
                container.innerHTML = contact.offeringAccounts.map(account => `
                    <div class="offering-card">
                        ${account.title ? `<h3>${account.title}</h3>` : ''}
                        <div class="offering-item">
                            <h4>Bank</h4>
                            <p>${account.bank}</p>
                        </div>
                        <div class="offering-item">
                            <h4>Account Name</h4>
                            <p>${account.accountName}</p>
                        </div>
                        <div class="offering-item">
                            <h4>Account Number</h4>
                            <p>${account.accountNumber}</p>
                        </div>
                    </div>
                `).join('');
            } else if (contact.offeringAccount) {
                // Fallback for old data structure
                container.innerHTML = `
                    <div class="offering-card">
                        <div class="offering-item">
                            <h4>Bank</h4>
                            <p>${contact.offeringAccount.bank}</p>
                        </div>
                        <div class="offering-item">
                            <h4>Account Name</h4>
                            <p>${contact.offeringAccount.accountName}</p>
                        </div>
                        <div class="offering-item">
                            <h4>Account Number</h4>
                            <p>${contact.offeringAccount.accountNumber}</p>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading offering details:', error.message || error);
    }
}

// ========================================
// Testimony Form
// ========================================

function setupTestimonyForm() {
    const form = document.getElementById('testimonyForm');
    const feedback = document.getElementById('testimonyFeedback');
    const toggleBtn = document.getElementById('toggleTestimonyBtn');
    const formContainer = document.getElementById('testimonyFormContainer');

    toggleBtn?.addEventListener('click', () => {
        const isActive = formContainer.classList.toggle('active');
        toggleBtn.classList.toggle('active');
        
        if (isActive) {
            toggleBtn.innerHTML = '<i data-lucide="minus-circle"></i> Hide Form';
        } else {
            toggleBtn.innerHTML = '<i data-lucide="plus-circle"></i> Share Your Testimony';
        }
        
        if (window.lucide) {
            lucide.createIcons();
        }
    });
    
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('testimonyName').value.trim();
        const message = document.getElementById('testimonyMessage').value.trim();
        
        if (!name || !message) {
            showFeedback(feedback, 'Please fill in all fields', 'error');
            return;
        }
        
        try {
            await db.collection(Collections.TESTIMONIES).add({
                name: name,
                message: message,
                approved: false,
                submittedAt: firebase.firestore.Timestamp.now()
            });
            
            form.reset();
            showFeedback(feedback, 'Thank you! Your testimony has been submitted and is awaiting approval.', 'success');
        } catch (error) {
            console.error('Error submitting testimony:', error.message || error);
            showFeedback(feedback, 'An error occurred. Please try again later.', 'error');
        }
    });
}

// ========================================
// Contact Form
// ========================================

function setupContactForm() {
    const form = document.getElementById('contactForm');
    const feedback = document.getElementById('contactFeedback');
    
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmailInput').value.trim();
        const message = document.getElementById('contactMessage').value.trim();
        
        if (!name || !email || !message) {
            showFeedback(feedback, 'Please fill in all fields', 'error');
            return;
        }
        
        try {
            await db.collection(Collections.MESSAGES).add({
                name: name,
                email: email,
                message: message,
                submittedAt: firebase.firestore.Timestamp.now()
            });
            
            form.reset();
            showFeedback(feedback, 'Thank you for your message! We will get back to you soon.', 'success');
        } catch (error) {
            console.error('Error submitting contact form:', error.message || error);
            showFeedback(feedback, 'An error occurred. Please try again later.', 'error');
        }
    });
}

// ========================================
// Real-time Listeners
// ========================================

function setupRealtimeListeners() {
    db.collection(Collections.SETTINGS).doc('theme')
        .onSnapshot((doc) => {
            if (doc.exists) {
                loadThemeSettings();
            }
        }, (error) => handleFirestoreError(error, OperationType.GET, Collections.SETTINGS));
    
    db.collection(Collections.SERMONS)
        .onSnapshot(() => {
            loadSermons();
        }, (error) => handleFirestoreError(error, OperationType.LIST, Collections.SERMONS));
    
    db.collection(Collections.EVENTS)
        .onSnapshot(() => {
            loadEvents();
        }, (error) => handleFirestoreError(error, OperationType.LIST, Collections.EVENTS));

    db.collection(Collections.QUOTES)
        .onSnapshot(() => {
            loadQuotes();
        }, (error) => handleFirestoreError(error, OperationType.LIST, Collections.QUOTES));

    db.collection(Collections.MOMENTS)
        .onSnapshot(() => {
            loadMoments();
        }, (error) => handleFirestoreError(error, OperationType.LIST, Collections.MOMENTS));
    
    db.collection(Collections.TESTIMONIES)
        .onSnapshot(() => {
            loadTestimonies();
        }, (error) => handleFirestoreError(error, OperationType.LIST, Collections.TESTIMONIES));
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

function formatDate(timestamp) {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}
