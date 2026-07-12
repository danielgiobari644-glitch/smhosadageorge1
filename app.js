// Public Site JavaScript - Salvation Ministries Ada George
// Handles dynamic content loading, form submissions, and real-time updates

// Wait for Firebase to initialize
document.addEventListener('DOMContentLoaded', () => {
    waitForFirebase().then(() => {
        initializeSite();
    });
});

function initializeSite() {
    // Boost image load speed and transitions globally
    setupImagePerformanceBooster();

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
    loadCustomSections();
    
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
        const doc = await safeGet(db.collection(Collections.SETTINGS).doc('theme'));
        if (doc && doc.exists) {
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
            if (sermonSections.length > 0) {
                sermonSections.forEach(sec => {
                    const bgType = theme.sermonBgType || 'image';
                    if (bgType === 'color' && theme.sermonBgColor) {
                        sec.style.cssText += `; background: ${theme.sermonBgColor} !important; background-image: none !important;`;
                    } else if (bgType === 'gradient' && theme.sermonBgGradient) {
                        sec.style.cssText += `; background: ${theme.sermonBgGradient} !important; background-image: none !important;`;
                    } else {
                        const bgUrl = theme.sermonBackground || theme.sermonBgImage || 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1600&q=80';
                        sec.style.cssText += `; background-image: url('${bgUrl}') !important; background-repeat: no-repeat !important; background-size: cover !important; background-position: center !important;`;
                    }
                });
            }

            const testimoniesSection = document.querySelector('.testimonies-section');
            if (testimoniesSection && theme.testimonyBackground) {
                testimoniesSection.style.cssText += `; background-image: url('${theme.testimonyBackground}') !important;`;
            }

            // Update Join Family section styling and links
            const joinFamilySection = document.getElementById('join-family-section');
            if (joinFamilySection) {
                const bgType = theme.joinFamilyBgType || 'color';
                if (bgType === 'color' && theme.joinFamilyBgColor) {
                    joinFamilySection.style.cssText += `; background: ${theme.joinFamilyBgColor} !important; background-image: none !important;`;
                } else if (bgType === 'gradient' && theme.joinFamilyBgGradient) {
                    joinFamilySection.style.cssText += `; background: ${theme.joinFamilyBgGradient} !important; background-image: none !important;`;
                } else if (bgType === 'image' && theme.joinFamilyBgImage) {
                    joinFamilySection.style.cssText += `; background-image: url('${theme.joinFamilyBgImage}') !important; background-repeat: no-repeat !important; background-size: cover !important; background-position: center !important; background-color: transparent !important;`;
                } else {
                    // Default fallback
                    joinFamilySection.style.cssText += `; background: #0b1329 !important; background-image: none !important;`;
                }
            }

            const joinFellowshipBtn = document.getElementById('joinFellowshipBtn');
            const joinNextStepsBtn = document.getElementById('joinNextStepsBtn');
            const joinServeBtn = document.getElementById('joinServeBtn');

            if (joinFellowshipBtn) {
                joinFellowshipBtn.href = theme.joinFamilyFellowshipLink || '#contact';
            }
            if (joinNextStepsBtn) {
                joinNextStepsBtn.href = theme.joinFamilyNextStepsLink || '#contact';
            }
            if (joinServeBtn) {
                joinServeBtn.href = theme.joinFamilyServeLink || '#ministries-serve';
            }

            // Update social media links
            const socials = [
                { id: 'facebook', url: theme.socialFacebook, icon: 'facebook' },
                { id: 'instagram', url: theme.socialInstagram, icon: 'instagram' },
                { id: 'twitter', url: theme.socialTwitter, icon: 'twitter' },
                { id: 'youtube', url: theme.socialYoutube, icon: 'youtube' }
            ].filter(s => s.url);

            const renderSocials = (container) => {
                if (!container) return;
                container.innerHTML = '';
                if (socials.length === 0) {
                    container.style.display = 'none';
                    return;
                }
                container.style.display = 'flex';
                
                socials.forEach(s => {
                    const a = document.createElement('a');
                    a.href = s.url;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.className = 'nav-social-link';
                    a.style.cssText = 'color: var(--text-muted); transition: var(--transition); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.03);';
                    a.innerHTML = `<i data-lucide="${s.icon}" style="width: 18px; height: 18px;"></i>`;
                    
                    // Add hover interactions
                    a.addEventListener('mouseenter', () => {
                        a.style.color = 'var(--primary-color)';
                        a.style.background = 'rgba(var(--primary-rgb), 0.08)';
                        a.style.transform = 'translateY(-2px)';
                    });
                    a.addEventListener('mouseleave', () => {
                        a.style.color = 'var(--text-muted)';
                        a.style.background = 'rgba(0,0,0,0.03)';
                        a.style.transform = 'none';
                    });
                    
                    container.appendChild(a);
                });
            };

            const desktopContainer = document.getElementById('navSocialsDesktop');
            const mobileContainer = document.getElementById('navSocialsMobile');
            const mobileItem = document.getElementById('navSocialsMobileItem');

            if (desktopContainer) renderSocials(desktopContainer);
            if (mobileContainer) renderSocials(mobileContainer);

            if (mobileItem) {
                if (socials.length > 0) {
                    mobileItem.style.display = 'flex';
                } else {
                    mobileItem.style.display = 'none';
                }
            }
            
            // Update hero buttons
            const heroLivestreamBtn = document.getElementById('heroLivestreamBtn');
            if (heroLivestreamBtn && theme.livestreamUrl) {
                heroLivestreamBtn.href = theme.livestreamUrl;
            }
            
            // Apply design variables
            if (theme.primaryColor) document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
            if (theme.primaryHover) document.documentElement.style.setProperty('--primary-hover', theme.primaryHover);
            if (theme.borderRadius) {
                document.documentElement.style.setProperty('--radius-md', theme.borderRadius + 'px');
                document.documentElement.style.setProperty('--radius-lg', (theme.borderRadius * 1.5) + 'px');
            }
            if (theme.sectionSpacing) document.documentElement.style.setProperty('--section-spacing', theme.sectionSpacing + 'rem');
            if (theme.fontSizeBase) document.documentElement.style.setProperty('--font-size-base', theme.fontSizeBase + 'px');

            // Apply dark mode if set (strictly controlled by admin settings)
            if (theme.mode === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }

            // Trigger Hero entrance animation
            setTimeout(() => {
                const heroSec = document.getElementById('home') || document.querySelector('.hero');
                heroSec?.classList.add('hero-ready');
            }, 100);
            
            // Initialize Reveal Animations
            setupRevealAnimations();
        }
    } catch (error) {
        console.error('Error loading theme settings:', error.message || String(error));
    }
}

function setupRevealAnimations() {
    // If we've already set up the dual observers, just run a fresh scan
    if (window.revealObserverInstance) {
        scanAndObserve();
        return;
    }

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    window.revealObserverInstance = revealObserver;

    // Perform initial scan
    scanAndObserve();

    // Setup Mutation Observer to auto-observe any newly appended dynamic content from Firestore
    const mutationObserver = new MutationObserver((mutations) => {
        let hasNewElements = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute('data-reveal') || 
                            node.hasAttribute('data-reveal-stagger') || 
                            node.querySelector('[data-reveal], [data-reveal-stagger]')) {
                            hasNewElements = true;
                        }
                    }
                });
            }
        });

        if (hasNewElements) {
            scanAndObserve();
        }
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function scanAndObserve() {
    const observer = window.revealObserverInstance;
    if (!observer) return;

    // Enable dynamic child staggering automatically for stagger groups
    document.querySelectorAll('[data-reveal-stagger]').forEach(parent => {
        const targets = parent.querySelectorAll('.card, .about-item, .offering-card, .service-card, .sermon-card, .event-poster-item, .moment-slide, .testimony-slide, .video-card, .pillar-card');
        targets.forEach((child, index) => {
            if (!child.hasAttribute('data-reveal')) {
                child.setAttribute('data-reveal', 'fade-up');
            }
            child.style.transitionDelay = `${index * 80}ms`;
        });
    });

    // Register all elements with the IntersectionObserver
    document.querySelectorAll('[data-reveal], [data-reveal-stagger]').forEach(el => {
        if (!el.classList.contains('revealed')) {
            observer.observe(el);
        }
    });
}

// Global Image Fast Loading Fade-In Utility
function setupImagePerformanceBooster() {
    // Hook loaded states for globally generated or static images
    document.addEventListener('load', (e) => {
        if (e.target.tagName === 'IMG') {
            e.target.classList.remove('loading');
            e.target.classList.add('loaded');
        }
    }, true);

    // Bootstrap current state of statically declared icons or logos
    document.querySelectorAll('img').forEach(img => {
        // Tag with standard performance parameters
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }
        if (!img.hasAttribute('decoding')) {
            img.setAttribute('decoding', 'async');
        }

        const hasRealSrc = img.src && !img.src.endsWith('.html') && !img.src.endsWith('/') && img.getAttribute('src') !== "";
        if (hasRealSrc && img.complete) {
            img.classList.add('loaded');
        } else {
            img.classList.add('loading');
        }
    });
}

// ========================================
// About Content
// ========================================

async function loadAboutContent() {
    try {
        const doc = await safeGet(db.collection(Collections.CONTENT).doc('about'));
        if (doc && doc.exists) {
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
            
            if (missionImg) {
                missionImg.classList.remove('loaded');
                missionImg.classList.add('loading');
                missionImg.src = content.missionImage || DEFAULT_CHURCH_IMG;
            }
            if (visionImg) {
                visionImg.classList.remove('loaded');
                visionImg.classList.add('loading');
                visionImg.src = content.visionImage || DEFAULT_CHURCH_IMG;
            }
            if (welcomeImg) {
                welcomeImg.classList.remove('loaded');
                welcomeImg.classList.add('loading');
                welcomeImg.src = content.welcomeImage || DEFAULT_CHURCH_IMG;
            }
        }
    } catch (error) {
        console.error('Error loading about content:', error.message || String(error));
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
        const snapshot = await safeList(db.collection(Collections.QUOTES)
            .orderBy('createdAt', 'desc'));

        const activeQuote = snapshot ? snapshot.docs.find(doc => doc.data().active === true) : null;

        if (activeQuote) {
            const quote = activeQuote.data();
            if (quote.type === 'image') {
                container.innerHTML = `
                    <div class="quote-slide">
                        <img src="${quote.imageUrl}" class="quote-item-image loading" alt="Daily Quote" loading="lazy" decoding="async">
                    </div>
                `;
            } else if (quote.type === 'both') {
                container.innerHTML = `
                    <div class="quote-slide">
                        <img src="${quote.imageUrl}" class="quote-item-image loading" alt="Daily Quote" style="margin-bottom: 2rem;" loading="lazy" decoding="async">
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
        console.error('Error loading quotes:', error.message || String(error));
    }
}

// ========================================
// Service Times
// ========================================

async function loadServiceTimes() {
    try {
        const doc = await safeGet(db.collection(Collections.SERVICES).doc('schedule'));
        if (doc && doc.exists) {
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
        console.error('Error loading service times:', error.message || String(error));
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

        const snapshot = await safeList(query);
        
        if (snapshot && !snapshot.empty) {
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
        console.error('Error loading sermons:', error.message || String(error));
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

        const snapshot = await safeList(db.collection(Collections.EVENTS)
            .orderBy('date', 'asc'));
        
        if (snapshot && !snapshot.empty) {
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
        console.error('Error loading events:', error.message || String(error));
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
        <img class="loading" src="${event.imageUrl}" alt="${event.title}" referrerPolicy="no-referrer" loading="lazy" decoding="async">
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

        const snapshot = await safeList(db.collection(Collections.MOMENTS)
            .orderBy('createdAt', 'desc'));
        
        const photos = [];
        const videos = [];
        
        if (snapshot) {
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === 'photo') photos.push(data);
                else if (data.type === 'video') videos.push(data);
            });
        }

        // Load Photos
        if (photos.length > 0) {
            photosTrack.innerHTML = '';
            momentDots.innerHTML = '';
            momentSlidesCount = photos.length;
            
            photos.forEach((photo, index) => {
                const slide = document.createElement('div');
                slide.className = 'moment-slide';
                slide.innerHTML = `
                    <img class="loading" src="${photo.url}" alt="${photo.title || ''}" referrerPolicy="no-referrer" loading="lazy" decoding="async">
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
        console.error('Error loading moments:', error.message || String(error));
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

        // Fetch testimonies and filter in memory to avoid composite index requirement
        const snapshot = await safeList(db.collection(Collections.TESTIMONIES)
            .orderBy('submittedAt', 'desc'));
        
        const approvedTestimonies = [];
        if (snapshot) {
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.approved === true) {
                    approvedTestimonies.push(data);
                }
            });
        }

        if (approvedTestimonies.length > 0) {
            testimoniesEmpty.style.display = 'none';
            testimoniesGrid.innerHTML = '';
            testimonySlidesCount = approvedTestimonies.length;
            
            // Safe initials picker
            const getNameInitials = (fullName) => {
                if (!fullName) return 'SM';
                const parts = fullName.trim().split(/\s+/);
                if (parts.length >= 2) {
                    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
                }
                return parts[0].slice(0, 2).toUpperCase();
            };

            // Deterministic gradient picker
            const getPremiumGradient = (fullName) => {
                const charCode = fullName && fullName.length > 0 ? fullName.charCodeAt(0) : 65;
                const colors = [
                    'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',   // Primary to Secondary
                    'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',   // Spark Pink to Rose
                    'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',   // Cyan to Indigo
                    'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',   // Amber to Pink
                    'linear-gradient(135deg, #10b981 0%, #059669 100%)'    // Emerald to Forest
                ];
                return colors[charCode % colors.length];
            };

            approvedTestimonies.forEach(testimony => {
                const slide = document.createElement('div');
                slide.className = 'testimony-slide';
                
                const initials = getNameInitials(testimony.name);
                const bgGradient = getPremiumGradient(testimony.name);

                slide.innerHTML = `
                    <div class="testimony-glass-card">
                        <div class="testimony-card-header">
                            <span class="testimony-card-badge">
                                <i data-lucide="sparkles"></i> Praise Report
                            </span>
                            <div class="testimony-card-quote">
                                <i data-lucide="quote"></i>
                            </div>
                        </div>
                        <div class="testimony-card-body">
                            <p class="testimony-text">"${testimony.message}"</p>
                        </div>
                        <div class="testimony-card-footer">
                            <div class="testimony-profile">
                                <div class="testimony-avatar" style="background: ${bgGradient};">
                                    <span>${initials}</span>
                                </div>
                                <div class="testimony-info">
                                    <h4 class="testimony-name">${testimony.name}</h4>
                                    <p class="testimony-meta">
                                        <i data-lucide="badge-check"></i> Verified Blessing
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
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
        console.error('Error loading testimonies:', error.message || String(error));
    }
}

function setupTestimonySlider() {
    const prevBtn = document.getElementById('testimonyPrev');
    const nextBtn = document.getElementById('testimonyNext');
    const dotsContainer = document.getElementById('testimonyDots');
    let testimonyInterval;

    // Create slider indication dots
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        for (let i = 0; i < testimonySlidesCount; i++) {
            const dot = document.createElement('button');
            dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
            dot.setAttribute('aria-label', `Go to testimony stage ${i + 1}`);
            dot.onclick = () => {
                currentTestimonySlide = i;
                updateTestimonySlider();
                startAutoSlide();
            };
            dotsContainer.appendChild(dot);
        }
    }

    const startAutoSlide = () => {
        if (testimonyInterval) clearInterval(testimonyInterval);
        testimonyInterval = setInterval(() => {
            moveTestimonySlide(1);
        }, 12000); // Friendly read time of 12s per testimony
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
    updateTestimonySlider();
}

function updateTestimonySlider() {
    const track = document.getElementById('testimoniesGrid');
    if (track) {
        track.style.transform = `translateX(-${currentTestimonySlide * 100}%)`;
    }
    
    // Update active state on progress dots
    const dots = document.querySelectorAll('#testimonyDots .slider-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentTestimonySlide);
    });
}

// ========================================
// Contact Info
// ========================================

async function loadContactInfo() {
    try {
        const doc = await safeGet(db.collection(Collections.CONTENT).doc('contact'));
        if (doc && doc.exists) {
            const contact = doc.data();
            
            const emailEl = document.getElementById('contactEmail');
            const phoneEl = document.getElementById('contactPhone');
            const addressEl = document.getElementById('contactAddress');
            
            if (emailEl && contact.email) emailEl.textContent = contact.email;
            if (phoneEl && contact.phone) phoneEl.textContent = contact.phone;
            if (addressEl && contact.address) addressEl.textContent = contact.address;
        }
    } catch (error) {
        console.error('Error loading contact info:', error.message || String(error));
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
        const doc = await safeGet(db.collection(Collections.CONTENT).doc('contact'));
        if (doc && doc.exists) {
            const contact = doc.data();
            const container = document.getElementById('offeringAccounts');
            if (!container) return;
            
            if (contact.offeringAccounts && contact.offeringAccounts.length > 0) {
                container.innerHTML = contact.offeringAccounts.map((account, index) => `
                    <div class="offering-card">
                        <h3>${account.title || 'Offering Account'}</h3>
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
                            <div class="account-number-wrapper">
                                <span class="account-num">${account.accountNumber}</span>
                                <button class="btn-copy" onclick="navigator.clipboard.writeText('${account.accountNumber}'); this.classList.add('copied'); this.innerHTML='<i data-lucide=check style=width:14px;height:14px;></i> Copied!'; setTimeout(()=>{this.classList.remove('copied'); this.innerHTML='<i data-lucide=copy style=width:14px;height:14px;></i> Copy'}, 2000); if(window.lucide) lucide.createIcons();">
                                    <i data-lucide="copy" style="width:14px; height:14px;"></i> Copy
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else if (contact.offeringAccount) {
                // Fallback for old data structure
                container.innerHTML = `
                    <div class="offering-card">
                        <h3>Offering Account</h3>
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
                            <div class="account-number-wrapper">
                                <span class="account-num">${contact.offeringAccount.accountNumber}</span>
                                <button class="btn-copy" onclick="navigator.clipboard.writeText('${contact.offeringAccount.accountNumber}'); this.classList.add('copied'); this.innerHTML='<i data-lucide=check style=width:14px;height:14px;></i> Copied!'; setTimeout(()=>{this.classList.remove('copied'); this.innerHTML='<i data-lucide=copy style=width:14px;height:14px;></i> Copy'}, 2000); if(window.lucide) lucide.createIcons();">
                                    <i data-lucide="copy" style="width:14px; height:14px;"></i> Copy
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            if (window.lucide) {
                lucide.createIcons();
            }
        }
    } catch (error) {
        console.error('Error loading offering details:', error.message || String(error));
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
            console.error('Error submitting testimony:', error.message || String(error));
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
            showFeedback(feedback, 'Message logged successfully! Opening your email app to send...', 'success');
            
            // Build and trigger the mailto client to adageorgestudio@gmail.com
            setTimeout(() => {
                const subject = encodeURIComponent(`Message from ${name}`);
                const bodyMsg = encodeURIComponent(`Hi Salvation Ministries Ada George,\n\nI am contacting you from the website.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
                window.location.href = `mailto:adageorgestudio@gmail.com?subject=${subject}&body=${bodyMsg}`;
            }, 800);
        } catch (error) {
            console.error('Error submitting contact form:', error.message || String(error));
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

// ========================================
// Dynamic Custom Sections Loading
// ========================================

async function loadCustomSections() {
    try {
        const container = document.getElementById('dynamic-sections');
        if (!container) return;

        // Fetch custom sections ordered by 'order'
        const snapshot = await safeList(db.collection(Collections.SECTIONS).orderBy('order', 'asc'));
        
        if (!snapshot || snapshot.empty) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const sectionId = doc.id;

            // Gather background inline styling
            let bgStyle = '';
            if (data.bgType === 'image' && data.bgImage) {
                bgStyle = `background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.65)), url('${data.bgImage}'); background-size: cover; background-position: center; background-attachment: fixed;`;
            } else if (data.bgType === 'gradient' && data.bgGradient) {
                bgStyle = `background: ${data.bgGradient};`;
            } else if (data.bgType === 'color' && data.bgColor) {
                bgStyle = `background-color: ${data.bgColor};`;
            } else {
                bgStyle = `background: var(--bg-white);`;
            }

            // Gather title inline styling
            let titleStyle = '';
            let titleClass = '';
            if (data.useGradient && data.titleGradient) {
                titleStyle = `background: ${data.titleGradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;`;
                titleClass = 'gradient-title';
            } else if (data.titleColor) {
                titleStyle = `color: ${data.titleColor};`;
            }

            // Heuristic for dark background
            const isDarkBg = data.bgType === 'image' || (data.bgType === 'color' && isColorDark(data.bgColor)) || (data.bgType === 'gradient' && isGradientDark(data.bgGradient));
            let titleDefaultColor = isDarkBg ? '#ffffff' : 'var(--text-dark)';

            let contentHTML = '';
            if (data.contentType === 'text') {
                contentHTML = `
                    <div class="custom-section-text-content" style="color: ${isDarkBg ? '#f1f5f9' : 'var(--text-dark)'}; max-width: 900px; margin: 0 auto; line-height: 1.8; font-size: 1.125rem;">
                        ${data.textHTML || ''}
                    </div>
                `;
            } else if (data.contentType === 'cards' && data.cards) {
                const cardsHTML = data.cards.map(card => {
                    const iconPos = card.iconPosition || 'top';
                    const iconStyle = `width: ${card.iconSize || '28px'}; height: ${card.iconSize || '28px'}; color: ${card.iconColor || 'var(--primary-color)'}; flex-shrink: 0;`;
                    
                    const cardBg = isDarkBg ? 'rgba(255,255,255,0.05)' : 'var(--card-bg, #ffffff)';
                    const cardBorder = isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
                    const cardColor = isDarkBg ? '#f1f5f9' : 'var(--text-dark)';
                    const cardDescColor = isDarkBg ? '#94a3b8' : 'var(--text-muted)';
                    const shadow = isDarkBg ? '0 10px 30px -10px rgba(0,0,0,0.5)' : 'var(--card-shadow, 0 4px 6px -1px rgba(0,0,0,0.05))';

                    if (iconPos === 'left') {
                        return `
                            <div class="custom-dyn-card left-icon" style="background: ${cardBg}; border: 1px solid ${cardBorder}; box-shadow: ${shadow}; color: ${cardColor}; display: flex; text-align: left; padding: 2rem; border-radius: 16px;">
                                ${card.icon ? `
                                <div class="custom-dyn-icon" style="margin-right: 1.25rem; margin-top: 0.25rem; display: flex;">
                                    <i data-lucide="${card.icon}" style="${iconStyle}"></i>
                                </div>` : ''}
                                <div class="custom-dyn-body">
                                    <h3 style="color: ${cardColor}; font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; line-height: 1.4;">${card.title || ''}</h3>
                                    <p style="color: ${cardDescColor}; margin: 0; font-size: 0.95rem; line-height: 1.6;">${card.description || ''}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="custom-dyn-card top-icon" style="background: ${cardBg}; border: 1px solid ${cardBorder}; box-shadow: ${shadow}; color: ${cardColor}; display: flex; flex-direction: column; text-align: left; padding: 2rem; border-radius: 16px;">
                                ${card.icon ? `
                                <div class="custom-dyn-icon" style="margin-bottom: 1rem; display: flex;">
                                    <i data-lucide="${card.icon}" style="${iconStyle}"></i>
                                </div>` : ''}
                                <div class="custom-dyn-body">
                                    <h3 style="color: ${cardColor}; font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; line-height: 1.4;">${card.title || ''}</h3>
                                    <p style="color: ${cardDescColor}; margin: 0; font-size: 0.95rem; line-height: 1.6;">${card.description || ''}</p>
                                </div>
                            </div>
                        `;
                    }
                }).join('');

                contentHTML = `
                    <div class="custom-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem;">
                        ${cardsHTML}
                    </div>
                `;
            }

            html += `
                <section class="custom-dynamic-section" id="dyn-${sectionId}" style="${bgStyle} position: relative; overflow: hidden;" data-reveal="fade-in">
                    <div class="container" style="position: relative; z-index: 2;">
                        <div class="section-header" style="margin-bottom: 3.5rem; text-align: center;">
                            <h2 class="${titleClass}" style="${titleStyle || `color: ${titleDefaultColor};`}; font-size: clamp(1.8rem, 3.5vw, 2.5rem); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.75rem;">
                                ${data.title || ''}
                            </h2>
                            <div class="section-divider" style="background: ${data.useGradient && data.titleGradient ? 'var(--primary-color)' : (data.titleColor || 'var(--primary-color)')}; margin: 0 auto; width: 60px; height: 4px; border-radius: 4px;"></div>
                        </div>
                        ${contentHTML}
                    </div>
                </section>
            `;
        });

        container.innerHTML = html;

        // Re-initialize Lucide icons for new content
        if (window.lucide) {
            window.lucide.createIcons();
        }
    } catch (error) {
        console.error('Error loading custom sections:', error.message || String(error));
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
