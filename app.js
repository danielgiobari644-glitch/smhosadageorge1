/* ═══════════════════════════════════════════════════════════════
   Ada George Church — Public Site Application Logic
   Pure Vanilla JavaScript · Firebase v8 · Local-First Architecture
   ═══════════════════════════════════════════════════════════════ */

// ── 1. Constants & Local Storage Helpers ──────────────────────

const LS_PREFIX = 'church_';
const SYNC_EVENT = 'localstorage_data_changed';

function lsKey(collection, id) {
  return id ? LS_PREFIX + collection + '_' + id : LS_PREFIX + collection + '_all';
}

function lsGet(key) {
  try {
    var r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  } catch (e) {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { key: key } }));
  } catch (e) { /* storage full or private mode */ }
}

// ── 2. Theme Application ─────────────────────────────────────

var DEFAULT_THEME = {
  primaryColor: '#8B5E3C',
  secondaryColor: '#F5E6D3',
  accentColor: '#C4956A',
  darkMode: false,
  borderRadius: 12,
  fontScale: 1,
  sectionSpacing: 80,
  logoUrl: '',
  faviconUrl: ''
};

function darkenHex(hex, amount) {
  amount = amount || 0.15;
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var r = Math.max(0, Math.round(parseInt(hex.substring(0,2), 16) * (1 - amount)));
  var g = Math.max(0, Math.round(parseInt(hex.substring(2,4), 16) * (1 - amount)));
  var b = Math.max(0, Math.round(parseInt(hex.substring(4,6), 16) * (1 - amount)));
  return '#' + [r, g, b].map(function(c) { return c.toString(16).padStart(2, '0'); }).join('');
}

function applyTheme(settings) {
  if (!settings || typeof settings !== 'object') settings = {};
  var s = {};
  for (var k in DEFAULT_THEME) {
    s[k] = settings[k] !== undefined ? settings[k] : DEFAULT_THEME[k];
  }

  var root = document.documentElement;
  root.style.setProperty('--primary', s.primaryColor);
  root.style.setProperty('--primary-hover', darkenHex(s.primaryColor, 0.15));
  root.style.setProperty('--secondary', s.secondaryColor);
  root.style.setProperty('--accent', s.accentColor);
  root.style.setProperty('--radius', s.borderRadius + 'px');
  root.style.setProperty('--font-scale', String(s.fontScale));
  root.style.setProperty('--section-spacing', s.sectionSpacing + 'px');

  // Derive smaller radius tokens
  root.style.setProperty('--radius-sm', Math.round(s.borderRadius * 0.67) + 'px');
  root.style.setProperty('--radius-lg', Math.round(s.borderRadius * 1.67) + 'px');

  // Dark mode
  if (s.darkMode) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }

  // Favicon
  if (s.faviconUrl) {
    var favicon = document.querySelector("link[rel*='icon']");
    if (favicon) {
      favicon.href = s.faviconUrl;
    } else {
      var link = document.createElement('link');
      link.rel = 'icon';
      link.href = s.faviconUrl;
      document.head.appendChild(link);
    }
  }

  // Logo image
  if (s.logoUrl) {
    var logoImg = document.querySelector('.logo img');
    if (logoImg) logoImg.src = s.logoUrl;
  }
}

// ── 3. Data Fetching (Local-First) ───────────────────────────

function safeGet(collectionName, docId) {
  var key = lsKey(collectionName, docId);
  var cached = lsGet(key);
  var p = new Promise(function(resolve) {
    if (cached) resolve(cached);
  });

  var fetchPromise = db.collection(collectionName).doc(docId).get()
    .then(function(doc) {
      if (doc.exists) {
        var data = Object.assign({ _id: doc.id }, doc.data());
        lsSet(key, data);
        return data;
      }
      return cached;
    })
    .catch(function(err) {
      console.warn('safeGet failed for', collectionName + '/' + docId, err);
      return cached;
    });

  return cached ? fetchPromise : fetchPromise.then(function(data) {
    return data || cached;
  });
}

function safeList(collectionName, orderField, limitCount) {
  var key = lsKey(collectionName);
  var cached = lsGet(key);

  var query = db.collection(collectionName).orderBy(orderField || 'createdAt', 'desc');
  if (limitCount) query = query.limit(limitCount);

  return query.get()
    .then(function(snapshot) {
      var items = [];
      snapshot.forEach(function(doc) {
        items.push(Object.assign({ _id: doc.id }, doc.data()));
      });
      lsSet(key, items);
      return items;
    })
    .catch(function(err) {
      console.warn('safeList failed for', collectionName, err);
      return cached || [];
    });
}

function safeQuery(collectionName, field, op, value) {
  var key = lsKey(collectionName) + '_query_' + field + '_' + op + '_' + String(value);
  var cached = lsGet(key);

  return db.collection(collectionName).where(field, op, value).get()
    .then(function(snapshot) {
      var items = [];
      snapshot.forEach(function(doc) {
        items.push(Object.assign({ _id: doc.id }, doc.data()));
      });
      lsSet(key, items);
      return items;
    })
    .catch(function(err) {
      console.warn('safeQuery failed for', collectionName, err);
      return cached || [];
    });
}

// ── 4. Cross-Tab Sync Listener ───────────────────────────────

function setupCrossTabSync() {
  // Other tabs making changes via storage event
  window.addEventListener('storage', function(e) {
    if (e.key && e.key.indexOf(LS_PREFIX) === 0) {
      handleDataChange(e.key);
    }
  });

  // Same tab dispatches custom event after lsSet
  window.addEventListener(SYNC_EVENT, function(e) {
    if (e.detail && e.detail.key) {
      handleDataChange(e.detail.key);
    }
  });
}

function handleDataChange(key) {
  // Map localStorage keys to section reloaders
  if (key.indexOf('settings') !== -1) loadTheme();
  if (key.indexOf('content_hero') !== -1) loadHero();
  if (key.indexOf('services') !== -1) loadServices();
  if (key.indexOf('sermons') !== -1) loadSermons();
  if (key.indexOf('quotes') !== -1) loadQuotes();
  if (key.indexOf('moments') !== -1) loadMoments();
  if (key.indexOf('testimonies') !== -1) loadTestimonies();
  if (key.indexOf('sections') !== -1) loadDynamicSections();
}

// ── 5. Scroll Progress Bar ───────────────────────────────────

function setupScrollProgress() {
  var bar = document.getElementById('scrollProgress');
  if (!bar) return;

  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        var percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = Math.min(percent, 100) + '%';
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ── 6. Header Scroll Effect ──────────────────────────────────

function setupHeaderScroll() {
  var header = document.getElementById('siteHeader');
  if (!header) return;

  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        if (window.pageYOffset > 50) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ── 7. Mobile Navigation ────────────────────────────────────

function setupMobileNav() {
  var toggle = document.getElementById('mobileToggle');
  var drawer = document.getElementById('mobileDrawer');
  var overlay = document.getElementById('mobileOverlay');

  if (!toggle || !drawer || !overlay) return;

  function openDrawer() {
    toggle.classList.add('active');
    drawer.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    toggle.classList.remove('active');
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', function(e) {
    e.stopPropagation();
    if (drawer.classList.contains('active')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  overlay.addEventListener('click', closeDrawer);

  // Close on drawer link click
  var drawerLinks = drawer.querySelectorAll('a');
  drawerLinks.forEach(function(link) {
    link.addEventListener('click', closeDrawer);
  });

  // ESC key closes drawer
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && drawer.classList.contains('active')) {
      closeDrawer();
    }
  });
}

// ── 8. Intersection Observer Reveal System ───────────────────

function setupRevealObserver() {
  var revealSelector = '[data-reveal], [data-reveal="fade-up"], [data-reveal="fade-left"], [data-reveal="fade-right"], [data-reveal="zoom"]';

  var revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll(revealSelector).forEach(function(el) {
    revealObserver.observe(el);
  });

  // Stagger containers
  var staggerSelector = '[data-reveal-stagger]';
  var staggerObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        staggerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll(staggerSelector).forEach(function(el) {
    staggerObserver.observe(el);
  });
}

// ── 9. Image Pop-In Observer ────────────────────────────────

function setupImagePopIn() {
  function markLoaded(img) {
    if (img.complete && img.naturalHeight > 0) {
      img.classList.add('img-loaded');
    }
  }

  // Handle all existing images
  document.querySelectorAll('img').forEach(function(img) {
    if (img.complete) {
      markLoaded(img);
    } else {
      img.addEventListener('load', function() { this.classList.add('img-loaded'); });
      img.addEventListener('error', function() {
        // Still show broken images so layout doesn't break
        this.classList.add('img-loaded');
      });
    }
  });

  // MutationObserver for dynamically added images
  var imageObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // If the node itself is an img
          if (node.tagName === 'IMG') {
            if (node.complete) {
              markLoaded(node);
            } else {
              node.addEventListener('load', function() { this.classList.add('img-loaded'); });
              node.addEventListener('error', function() { this.classList.add('img-loaded'); });
            }
          }
          // Check children for images
          var imgs = node.querySelectorAll ? node.querySelectorAll('img') : [];
          imgs.forEach(function(img) {
            if (img.complete) {
              markLoaded(img);
            } else {
              img.addEventListener('load', function() { this.classList.add('img-loaded'); });
              img.addEventListener('error', function() { this.classList.add('img-loaded'); });
            }
          });
        }
      });
    });
  });

  imageObserver.observe(document.body, { childList: true, subtree: true });
}

// ── 10. Hero Section Loader ──────────────────────────────────

function loadHero() {
  safeGet('content', 'hero').then(function(data) {
    if (!data) return;

    // Background image
    if (data.backgroundImage) {
      var heroBg = document.querySelector('.hero-bg');
      if (heroBg) {
        heroBg.style.backgroundImage = 'url(' + data.backgroundImage + ')';
      }
    }

    // Headline
    if (data.headline) {
      var headline = document.querySelector('.hero-content h1');
      if (headline) headline.textContent = data.headline;
    }

    // Subtitle
    if (data.subtitle) {
      var subtitle = document.querySelector('.hero-content .subtitle');
      if (subtitle) subtitle.textContent = data.subtitle;
    }

    // Service time badge
    if (data.serviceTime) {
      var badge = document.querySelector('.hero-badge span');
      if (badge) badge.textContent = data.serviceTime;
    }

    // Watch live URL
    if (data.watchLiveUrl) {
      var liveBtn = document.querySelector('.hero-actions .live-btn, .hero-actions a[href*="watch"]');
      if (liveBtn) liveBtn.href = data.watchLiveUrl;
    }
  }).catch(function() {});
}

// ── 11. Services Loader ───────────────────────────────────────

function loadServices() {
  safeGet('services', 'schedule').then(function(data) {
    if (!data || !data.items || !data.items.length) return;

    var grid = document.getElementById('servicesGrid');
    if (!grid) return;

    var html = '';
    data.items.forEach(function(item) {
      html += '<div class="service-card">' +
        '<div class="service-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>' +
        '<h3>' + escapeHtml(item.title || 'Service') + '</h3>' +
        (item.time ? '<p class="time">' + escapeHtml(item.time) + '</p>' : '') +
        (item.location ? '<p class="location">' + escapeHtml(item.location) + '</p>' : '') +
        (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : '') +
        '</div>';
    });

    grid.innerHTML = html;
    // Re-observe newly added elements for reveal
    setupImagePopIn();
  }).catch(function() {});
}

// ── 12. Sermons Section ──────────────────────────────────────

var currentSermonFilter = 'all';
var allSermons = [];

function loadSermons() {
  safeList('sermons', 'date', 12).then(function(sermons) {
    if (!sermons || !sermons.length) return;
    allSermons = sermons;
    renderSermons('all');

    // Set up filter buttons
    var filterBtns = document.querySelectorAll('.sermon-filters .filter-btn');
    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var filter = this.getAttribute('data-filter') || 'all';
        currentSermonFilter = filter;
        filterBtns.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        renderSermons(filter);
      });
    });
  }).catch(function() {});
}

function renderSermons(filter) {
  var grid = document.getElementById('sermonsGrid');
  if (!grid) return;

  var filtered = filter === 'all'
    ? allSermons
    : allSermons.filter(function(s) { return s.type === filter; });

  if (!filtered.length) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;">No sermons found.</p>';
    return;
  }

  var html = '';
  filtered.forEach(function(sermon) {
    var thumbnail = sermon.thumbnail || sermon.imageUrl || '';
    var typeLabel = sermon.type || 'video';
    var typeIcon = typeLabel === 'audio' ? '&#9835;' : typeLabel === 'notes' ? '&#128196;' : '&#9654;';

    html += '<div class="sermon-card" data-type="' + escapeHtml(typeLabel) + '">' +
      (thumbnail
        ? '<div class="sermon-thumb"><img src="' + escapeHtml(thumbnail) + '" alt="' + escapeHtml(sermon.title || 'Sermon') + '" loading="lazy"><div class="play-btn">' + typeIcon + '</div></div>'
        : '<div class="sermon-thumb sermons-placeholder"><div class="play-btn">' + typeIcon + '</div></div>'
      ) +
      '<div class="sermon-info">' +
        '<h3>' + escapeHtml(sermon.title || 'Untitled Sermon') + '</h3>' +
        '<div class="sermon-meta">' +
          '<span>' + escapeHtml(sermon.speaker || '') + '</span>' +
          '<span>' + formatDate(sermon.date) + '</span>' +
        '</div>' +
        '<div class="sermon-actions">' +
          (sermon.videoUrl ? '<button class="btn btn-sm play-sermon-btn" data-video="' + escapeHtml(sermon.videoUrl) + '">Watch</button>' : '') +
          (sermon.audioUrl ? '<button class="btn btn-sm play-sermon-btn" data-audio="' + escapeHtml(sermon.audioUrl) + '">Listen</button>' : '') +
          (sermon.notesUrl ? '<a href="' + escapeHtml(sermon.notesUrl) + '" class="btn btn-sm" target="_blank" rel="noopener">Notes</a>' : '') +
        '</div>' +
      '</div>' +
      '</div>';
  });

  grid.innerHTML = html;
  setupImagePopIn();

  // Wire sermon play buttons to video modal
  grid.querySelectorAll('.play-sermon-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var videoUrl = this.getAttribute('data-video');
      var audioUrl = this.getAttribute('data-audio');
      openVideoModal(videoUrl || null, audioUrl || null);
    });
  });
}

function openVideoModal(videoUrl, audioUrl) {
  var modal = document.getElementById('videoModal');
  if (!modal) return;

  var embed = modal.querySelector('.video-embed');
  if (embed) {
    embed.innerHTML = '';
    if (videoUrl) {
      // Convert YouTube watch URL to embed
      var embedUrl = videoUrl;
      var ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        embedUrl = 'https://www.youtube.com/embed/' + ytMatch[1] + '?autoplay=1&rel=0';
      }
      embed.innerHTML = '<iframe src="' + escapeHtml(embedUrl) + '" allow="autoplay; encrypted-media" allowfullscreen title="Video"></iframe>';
    } else if (audioUrl) {
      embed.innerHTML = '<audio controls autoplay style="width:100%;margin-top:40px;"><source src="' + escapeHtml(audioUrl) + '">Your browser does not support audio.</audio>';
    }
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Close handlers
  var closeBtn = modal.querySelector('.modal-close');
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    // Stop video/audio
    if (embed) embed.innerHTML = '';
  }
  if (closeBtn) {
    // Clone to remove any previous listeners
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
  }
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

// ── 13. Daily Quote Loader ──────────────────────────────────

var quoteRotationTimer = null;
var activeQuotes = [];
var currentQuoteIndex = 0;

function loadQuotes() {
  safeQuery('quotes', 'active', '==', true).then(function(quotes) {
    if (!quotes || !quotes.length) return;
    activeQuotes = quotes;
    currentQuoteIndex = 0;
    displayQuote(0);

    // Rotate quotes every 30 seconds
    if (quotes.length > 1) {
      if (quoteRotationTimer) clearInterval(quoteRotationTimer);
      quoteRotationTimer = setInterval(function() {
        currentQuoteIndex = (currentQuoteIndex + 1) % activeQuotes.length;
        displayQuote(currentQuoteIndex);
      }, 30000);
    }
  }).catch(function() {});
}

function displayQuote(index) {
  var card = document.getElementById('quoteCard');
  if (!card || !activeQuotes.length) return;

  var q = activeQuotes[index];
  var html = '';

  if (q.type === 'image' || q.type === 'both') {
    if (q.imageUrl) {
      html += '<img class="quote-image" src="' + escapeHtml(q.imageUrl) + '" alt="Quote image" loading="lazy">';
    }
  }

  if (q.type === 'text' || q.type === 'both' || !q.type) {
    html += '<p class="quote-text">' + escapeHtml(q.text || q.quote || '') + '</p>';
    html += '<span class="quote-author">' + escapeHtml(q.author || '') + '</span>';
  }

  card.innerHTML = html;
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px)';
  requestAnimationFrame(function() {
    card.style.transition = 'opacity 0.5s, transform 0.5s';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  setupImagePopIn();
}

// ── 14. Moments/Gallery Loader ─────────────────────────────

var allMoments = [];
var currentLightboxIndex = 0;

function loadMoments() {
  safeList('moments', 'order', 50).then(function(moments) {
    if (!moments || !moments.length) return;
    allMoments = moments.filter(function(m) { return m.imageUrl; });

    var grid = document.getElementById('momentsGrid');
    if (!grid) return;

    var html = '';
    allMoments.forEach(function(moment, i) {
      html += '<div class="masonry-item" data-index="' + i + '">' +
        '<img src="' + escapeHtml(moment.imageUrl) + '" alt="' + escapeHtml(moment.caption || moment.title || 'Moment') + '" loading="lazy">' +
        (moment.caption || moment.title ? '<div class="caption">' + escapeHtml(moment.caption || moment.title) + '</div>' : '') +
        '</div>';
    });

    grid.innerHTML = html;
    setupImagePopIn();

    // Lightbox click handlers
    grid.querySelectorAll('.masonry-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        openLightbox(idx);
      });
    });
  }).catch(function() {});
}

function openLightbox(index) {
  currentLightboxIndex = index;
  var lightbox = document.getElementById('lightbox');
  if (!lightbox || !allMoments.length) return;

  renderLightboxImage();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Close on backdrop click
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox || e.target.tagName !== 'BUTTON') {
      closeLightbox();
    }
  });

  // ESC to close
  document.addEventListener('keydown', lightboxKeyHandler);
}

function renderLightboxImage() {
  var lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  var img = lightbox.querySelector('img');
  if (!img) return;

  var moment = allMoments[currentLightboxIndex];
  if (moment) {
    img.src = moment.imageUrl;
    img.alt = moment.caption || moment.title || 'Moment';
  }
}

function lightboxKeyHandler(e) {
  if (e.key === 'Escape') {
    closeLightbox();
  } else if (e.key === 'ArrowLeft') {
    navigateLightbox(-1);
  } else if (e.key === 'ArrowRight') {
    navigateLightbox(1);
  }
}

function navigateLightbox(direction) {
  if (!allMoments.length) return;
  currentLightboxIndex = (currentLightboxIndex + direction + allMoments.length) % allMoments.length;
  renderLightboxImage();
}

function closeLightbox() {
  var lightbox = document.getElementById('lightbox');
  if (lightbox) lightbox.classList.remove('open');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', lightboxKeyHandler);
}

// Wire lightbox nav buttons (set up after DOM ready)
function setupLightboxNav() {
  var prevBtn = document.querySelector('.lightbox-nav.prev');
  var nextBtn = document.querySelector('.lightbox-nav.next');
  if (prevBtn) prevBtn.addEventListener('click', function(e) { e.stopPropagation(); navigateLightbox(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function(e) { e.stopPropagation(); navigateLightbox(1); });
}

// ── 15. Testimonies Loader ──────────────────────────────────

function loadTestimonies() {
  safeQuery('testimonies', 'approved', '==', true).then(function(testimonies) {
    // Also filter isPublic
    var publicOnes = testimonies.filter(function(t) {
      return t.isPublic !== false;
    });

    if (!publicOnes.length) return;

    var slider = document.getElementById('testimonialsSlider');
    if (!slider) return;

    var html = '';
    publicOnes.forEach(function(t) {
      html += '<div class="testimony-card">' +
        '<div class="quote-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg></div>' +
        '<p class="content">' + escapeHtml(t.content || t.testimony || '') + '</p>' +
        '<p class="author">' + escapeHtml(t.name || 'Anonymous') + '</p>' +
        (t.date ? '<p class="date">' + formatDate(t.date) + '</p>' : '') +
        '</div>';
    });

    slider.innerHTML = html;
  }).catch(function() {});
}

function setupTestimonyForm() {
  var submitBtn = document.querySelector('.submit-testimony-btn button, .submit-testimony-btn');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', function() {
    var modal = document.getElementById('testimonyModal');
    if (modal) modal.classList.add('open');
  });

  var form = document.getElementById('testimonyForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var name = form.querySelector('[name="name"]');
    var testimony = form.querySelector('[name="testimony"]');
    var isPublic = form.querySelector('[name="isPublic"]');

    if (!testimony || !testimony.value.trim()) {
      showToast('Please share your testimony.', 'error');
      return;
    }

    var data = {
      name: name ? name.value.trim() : 'Anonymous',
      content: testimony.value.trim(),
      isPublic: isPublic ? isPublic.checked : true,
      approved: false,
      type: 'testimony',
      status: 'new',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    };

    db.collection('testimonies').add(data)
      .then(function() {
        showToast('Thank you! Your testimony has been submitted for review.', 'success');
        form.reset();
        var modal = document.getElementById('testimonyModal');
        if (modal) modal.classList.remove('open');
      })
      .catch(function(err) {
        // Fallback: save to localStorage
        lsSet(lsKey('testimonies', 'pending_' + Date.now()), data);
        showToast('Saved locally. It will sync when connection is restored.', 'info');
      });
  });

  // Close testimony modal
  var modal = document.getElementById('testimonyModal');
  if (modal) {
    var closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { modal.classList.remove('open'); });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('open');
    });
  }
}

// ── 16. Giving Section ────────────────────────────────────────

function loadGiving() {
  safeGet('content', 'giving').then(function(data) {
    if (!data) return;

    // If data has giving details, enhance the static giving section
    if (data.bankName || data.accountNumber || data.ussdCode) {
      var givingGrid = document.querySelector('.giving-grid');
      if (givingGrid) {
        // Update bank details if present
        var bankDetail = givingGrid.querySelector('.bank-detail');
        if (bankDetail && data.accountNumber) {
          bankDetail.textContent = data.accountNumber;
        }
        var bankNameEl = givingGrid.querySelector('.giving-card h3');
        if (bankNameEl && data.bankName) {
          bankNameEl.textContent = data.bankName;
        }
        var ussdEl = givingGrid.querySelector('.ussd-code');
        if (ussdEl && data.ussdCode) {
          ussdEl.textContent = data.ussdCode;
        }
      }
    }
  }).catch(function() {});
}

// ── 17. Contact Form Handler ──────────────────────────────────

function setupContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var name = form.querySelector('[name="name"]');
    var email = form.querySelector('[name="email"]');
    var subject = form.querySelector('[name="subject"]');
    var message = form.querySelector('[name="message"]');

    // Basic validation
    if (!name || !name.value.trim()) {
      showToast('Please enter your name.', 'error');
      return;
    }
    if (!email || !email.value.trim() || !email.value.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (!message || !message.value.trim()) {
      showToast('Please enter a message.', 'error');
      return;
    }

    // Determine message type from subject
    var subjectValue = subject ? subject.value : '';
    var msgType = 'contact';
    if (subjectValue.toLowerCase().indexOf('prayer') !== -1) {
      msgType = 'prayer';
    }

    var data = {
      name: name.value.trim(),
      email: email.value.trim(),
      subject: subjectValue,
      message: message.value.trim(),
      type: msgType,
      status: 'new',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    };

    db.collection('messages').add(data)
      .then(function() {
        showToast('Message sent successfully! We will get back to you soon.', 'success');
        form.reset();
      })
      .catch(function(err) {
        // Fallback: save locally
        lsSet(lsKey('messages', Date.now()), data);
        showToast('Saved locally. Message will be sent when connection is restored.', 'info');
      });
  });
}

// ── 18. Dynamic Sections Loader ─────────────────────────────

function loadDynamicSections() {
  safeList('sections', 'order', 20).then(function(sections) {
    if (!sections || !sections.length) return;

    var container = document.getElementById('dynamicSections');
    if (!container) return;

    var html = '';
    sections.forEach(function(section) {
      if (!section.visible && section.visible !== undefined) return;

      if (section.type === 'text-image') {
        html += renderTextImageSection(section);
      } else if (section.type === 'video') {
        html += renderVideoSection(section);
      } else if (section.type === 'features') {
        html += renderFeaturesSection(section);
      }
    });

    container.innerHTML = html;
    setupImagePopIn();
    // Re-observe new reveal elements
    var revealEls = container.querySelectorAll('[data-reveal]');
    revealEls.forEach(function(el) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      obs.observe(el);
    });
  }).catch(function() {});
}

function renderTextImageSection(section) {
  var reverseClass = section.reverse ? ' reverse' : '';
  var imageHtml = section.imageUrl
    ? '<img src="' + escapeHtml(section.imageUrl) + '" alt="' + escapeHtml(section.title || '') + '" loading="lazy">'
    : '';

  return '<div class="dynamic-section text-image' + reverseClass + '" data-reveal="fade-up">' +
    (section.reverse
      ? '<div class="rich-text">' + (section.title ? '<h3>' + escapeHtml(section.title) + '</h3>' : '') + (section.body || section.content ? '<p>' + escapeHtml(section.body || section.content) + '</p>' : '') + '</div>' + '<div>' + imageHtml + '</div>'
      : '<div>' + imageHtml + '</div><div class="rich-text">' + (section.title ? '<h3>' + escapeHtml(section.title) + '</h3>' : '') + (section.body || section.content ? '<p>' + escapeHtml(section.body || section.content) + '</p>' : '') + '</div>'
    ) +
    '</div>';
}

function renderVideoSection(section) {
  var embedUrl = section.videoUrl || '';
  // Convert YouTube watch URL to embed
  var ytMatch = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    embedUrl = 'https://www.youtube.com/embed/' + ytMatch[1];
  }

  return '<div class="dynamic-section" data-reveal="fade-up">' +
    (section.title ? '<h2 style="text-align:center;margin-bottom:24px;">' + escapeHtml(section.title) + '</h2>' : '') +
    '<div class="dynamic-video">' +
      '<iframe src="' + escapeHtml(embedUrl) + '" allow="autoplay; encrypted-media" allowfullscreen title="' + escapeHtml(section.title || 'Video') + '"></iframe>' +
    '</div>' +
    '</div>';
}

function renderFeaturesSection(section) {
  var features = section.features || section.items || [];
  var cardsHtml = '';

  features.forEach(function(f) {
    var iconSvg = f.icon || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    cardsHtml += '<div class="feature-card">' +
      '<div class="icon">' + iconSvg + '</div>' +
      '<h4>' + escapeHtml(f.title || f.name || '') + '</h4>' +
      '<p>' + escapeHtml(f.description || f.text || '') + '</p>' +
      '</div>';
  });

  return '<div class="dynamic-section" data-reveal="fade-up">' +
    (section.title ? '<h2 style="text-align:center;margin-bottom:32px;">' + escapeHtml(section.title) + '</h2>' : '') +
    '<div class="feature-cards-grid">' + cardsHtml + '</div>' +
    '</div>';
}

// ── 19. Toast Notification System ────────────────────────────

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast ' + type;

  var iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else {
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  toast.innerHTML = '<span class="toast-icon">' + iconSvg + '</span>' +
    '<span class="toast-message">' + escapeHtml(message) + '</span>';

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(function() {
    toast.style.animation = 'slideIn 0.3s ease-out reverse forwards';
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, 4000);
}

// ── 20. Navigation Active State ─────────────────────────────

function setupNavActiveState() {
  var navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  if (!navLinks.length) return;

  var sectionIds = [];
  navLinks.forEach(function(link) {
    var href = link.getAttribute('href');
    if (href && href.length > 1) {
      var sectionId = href.substring(1);
      var section = document.getElementById(sectionId);
      if (section) {
        sectionIds.push({ id: sectionId, el: section, link: link });
      }
    }
  });

  if (!sectionIds.length) return;

  var navObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        // Remove active from all
        navLinks.forEach(function(l) { l.classList.remove('active'); });
        // Find matching link
        var match = sectionIds.find(function(s) { return s.el === entry.target; });
        if (match) match.link.classList.add('active');
      }
    });
  }, {
    threshold: 0.3,
    rootMargin: '-' + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72) + 'px 0px -40% 0px'
  });

  sectionIds.forEach(function(s) { navObserver.observe(s.el); });
}

// ── Helper Utilities ─────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function formatDate(dateVal) {
  if (!dateVal) return '';
  var d;
  if (dateVal && dateVal.toDate) {
    d = dateVal.toDate();
  } else if (typeof dateVal === 'string') {
    d = new Date(dateVal);
  } else if (dateVal instanceof Date) {
    d = dateVal;
  } else {
    return '';
  }
  if (isNaN(d.getTime())) return '';
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

// ── 21. Initialization ───────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  // 1. Apply theme — use localStorage cache first, then fetch from Firestore
  var cachedTheme = lsGet(lsKey('settings', 'theme'));
  if (cachedTheme) applyTheme(cachedTheme);

  safeGet('settings', 'theme').then(function(settings) {
    if (settings) {
      applyTheme(settings);
      lsSet(lsKey('settings', 'theme'), settings);
    }
  }).catch(function() {});

  // 2. Set up all observers
  setupRevealObserver();
  setupImagePopIn();

  // 3. Set up scroll listeners
  setupScrollProgress();
  setupHeaderScroll();

  // 4. Set up mobile navigation
  setupMobileNav();

  // 5. Load all section data (fire-and-forget — each manages its own rendering)
  loadHero();
  loadServices();
  loadSermons();
  loadQuotes();
  loadMoments();
  loadTestimonies();
  loadDynamicSections();
  loadGiving();

  // 6. Set up form handlers
  setupContactForm();
  setupTestimonyForm();

  // 7. Set up cross-tab sync listener
  setupCrossTabSync();

  // 8. Navigation active state tracking
  setupNavActiveState();

  // 9. Lightbox navigation buttons
  setupLightboxNav();
});
