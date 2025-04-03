(function() {
    const container = document.querySelector('.gallery-page-container');
    // Early exit if the main container isn't found
    if (!container) {
        console.error("Gallery container '.gallery-page-container' not found! Script cannot run.");
        return;
    }

    // ==================================================
    // ===== ALL ELEMENT DECLARATIONS MOVED HERE ======
    // ==================================================
    const filterButtons = container.querySelectorAll('.filter-nav .filter-btn');
    const contentSections = {
        home: container.querySelector('#home-content'),
        wall: container.querySelector('#gallery-grid'),
        distracted: container.querySelector('#distracted-content'),
        organized: container.querySelector('#organized-content'),
        blog: container.querySelector('#blog-content'),
        post: container.querySelector('#full-blog-post-view') // Container for single post view
    };
    const cartoonCards = contentSections.wall ? contentSections.wall.querySelectorAll('.cartoon-card') : [];
    const blogCardLinks = container.querySelectorAll('.blog-card-link-wrapper');
    const readMoreButtons = container.querySelectorAll('.read-more-btn'); // Includes those inside previews
    const searchWidget = container.querySelector('#search-widget');
    const searchToggleBtn = container.querySelector('#searchToggle');
    const pageSearchInput = container.querySelector('#pageSearchInput'); // <<< Now declared BEFORE initial updateDisplay call
    const searchResultsContainer = container.querySelector('#searchResults');
    const yearSpan = container.querySelector('#copyright-year'); // Moved yearSpan declaration up too
    // ==================================================
    // === END OF MOVED ELEMENT DECLARATIONS ==========
    // ==================================================


    // Check if all essential content sections exist
    let essentialSectionsFound = true;
    for (const key in contentSections) {
        if (!contentSections[key]) {
            console.warn(`Content section for '#${key}' not found in the HTML.`);
            if (key !== 'post') { // Post view container is less critical if no blog posts exist
                essentialSectionsFound = false;
            }
        }
    }
    // Optional: Prevent script from running further if critical sections are missing
    // if (!essentialSectionsFound) {
    //     console.error("Essential content sections missing. Aborting script setup.");
    //     return;
    // }


    // --- GitHub Pages 404 Redirect Logic ---
    const ghPagesPath = sessionStorage.getItem('ghPagesPath');
    let initialPathToLoad = window.location.pathname; // Default to current path

    if (ghPagesPath) {
        initialPathToLoad = ghPagesPath;
        sessionStorage.removeItem('ghPagesPath');
        // Use replaceState so the 404->redirect->correct path isn't two history entries
        window.history.replaceState(null, '', initialPathToLoad);
    }
    // --- End Redirect Logic ---


    // --- Determine Initial View Based on Path ---
    let initialFilter = 'home';
    let initialPostId = null;
    let foundMatch = false;

    const blogPostMatch = initialPathToLoad.match(/^\/blog\/(post-\d+)$/);
    if (blogPostMatch && contentSections.post) {
        const tempPostId = blogPostMatch[1];
        // Check if the corresponding hidden content exists
        if (document.getElementById(tempPostId + '-content')) {
            initialFilter = 'blog';
            initialPostId = tempPostId;
            foundMatch = true;
        } else {
             console.warn(`Blog post content for ${tempPostId} not found, loading blog list instead.`);
             initialFilter = 'blog'; // Fallback to blog list if post content div missing
             foundMatch = true; // Still consider it a match for /blog/ base
        }
    }

    if (!foundMatch) {
        filterButtons.forEach(btn => {
            const btnUrl = btn.getAttribute('data-url');
            const btnFilter = btn.getAttribute('data-filter');
            // Match exact path or root path '/' to '/home'
            if (btnUrl === initialPathToLoad || (initialPathToLoad === '/' && btnFilter === 'home')) {
                if (contentSections[btnFilter]) { // Ensure the section element exists
                    initialFilter = btnFilter;
                    foundMatch = true;
                }
            }
        });
    }

    // If still no match after checking buttons and blog posts, default to 'home'
    if (!foundMatch) {
        initialFilter = 'home';
    }
    // --- End Initial View Determination ---


    /* =========================================== */
    /* === FUNCTION DEFINITIONS (No changes inside these) === */
    /* =========================================== */

    // --- Fullscreen Image Functionality ---
    function setupFullscreenImages() {
        const clickableImages = container.querySelectorAll('.card-image-placeholder img, .blog-image-placeholder img, #full-blog-post-view img.placeholder-image, #home-content .image-container img.home-main-image');
        clickableImages.forEach(img => {
            if (!img.dataset.fullscreenListenerAdded) {
                if (window.getComputedStyle(img).cursor !== 'pointer' && window.getComputedStyle(img).cursor !== 'url("assets/cursors/glove-pointer.png") 0 0, pointer') {
                     img.style.cursor = 'pointer';
                }
                img.addEventListener('click', handleImageClick);
                img.dataset.fullscreenListenerAdded = 'true';
            }
        });
    }

    function handleImageClick(e) {
        e.stopPropagation();
        showFullscreenImage(this.src, this.alt);
    }

    function showFullscreenImage(src, alt) {
        const existingOverlay = document.querySelector('.fullscreen-overlay');
        if (existingOverlay && existingOverlay.parentNode) {
            existingOverlay.parentNode.removeChild(existingOverlay);
        }
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay';
        const fullscreenImg = document.createElement('img');
        fullscreenImg.className = 'fullscreen-image';
        fullscreenImg.src = src;
        fullscreenImg.alt = alt || "Fullscreen Image";
        overlay.appendChild(fullscreenImg);
        overlay.addEventListener('click', () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
        document.body.appendChild(overlay);
    }

    // --- Text Highlighting Functions ---
    function highlightTextInElement(element, searchTerm) {
        if (!element || !element.textContent || typeof element.textContent !== 'string' || searchTerm.length < 1) return;
        if (!element.dataset.originalHtml) {
            element.dataset.originalHtml = element.innerHTML;
        } else {
            element.innerHTML = element.dataset.originalHtml;
        }
        const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToReplace = [];
        while(node = walker.nextNode()) {
             let parent = node.parentNode;
             let allowHighlight = true;
             while(parent && parent !== element) {
                 if(['SCRIPT', 'STYLE', 'BUTTON', 'A'].includes(parent.tagName)) {
                     allowHighlight = false;
                     break;
                 }
                 parent = parent.parentNode;
             }
             if (allowHighlight) {
                 const nodeValue = node.nodeValue;
                 const localRegex = new RegExp(regex.source, regex.flags);
                 if (localRegex.test(nodeValue)) {
                     nodesToReplace.push({node: node, value: nodeValue});
                 }
             }
        }
        nodesToReplace.forEach(item => {
            const localRegex = new RegExp(regex.source, regex.flags);
            const newNodeValue = item.value.replace(localRegex, '<span class="search-highlight">$1</span>');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newNodeValue;
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
             if (item.node.parentNode) {
                item.node.parentNode.replaceChild(fragment, item.node);
            }
        });
    }

    function removeHighlights() {
        const highlightedElements = container.querySelectorAll('[data-original-html]');
        highlightedElements.forEach(element => {
            if (typeof element.dataset.originalHtml === 'string') {
                element.innerHTML = element.dataset.originalHtml;
            }
            delete element.dataset.originalHtml;
        });
        document.removeEventListener('click', clickAwayListenerForHighlights);
    }

    function clickAwayListenerForHighlights(event) {
         if (searchWidget && !searchWidget.contains(event.target)) {
             removeHighlights();
         }
    }

    function highlightTextOnDisplay(searchTerm) {
        setTimeout(() => {
            removeHighlights();
            if (!searchTerm || searchTerm.trim().length === 0) return;
            const currentSection = container.querySelector('.page-content:not(.hidden), .gallery-grid:not(.hidden)');
            if (currentSection) {
                const elementsToSearch = currentSection.querySelectorAll(
                    'h1, h2, h3, p, .card-details h3, .card-details p, .blog-card-details h3, .blog-card-details p'
                );
                let foundHighlight = false; // Corrected variable name here
                elementsToSearch.forEach(el => {
                    if (el.offsetParent !== null) {
                        highlightTextInElement(el, searchTerm);
                        if (el.querySelector('.search-highlight')) {
                             foundHighlight = true; // Corrected variable name here
                         }
                    }
                });
                 if (foundHighlight) { // Corrected variable name here
                     document.removeEventListener('click', clickAwayListenerForHighlights);
                     document.addEventListener('click', clickAwayListenerForHighlights);
                 }
            }
        }, 100);
    }

    // --- Main Display Function (SPA Logic) ---
    function updateDisplay(targetFilter = null, postId = null, searchTermToHighlight = null, updateHistory = true) {
        let currentFilter = targetFilter;
        let sectionToShowId = null;
        let isBlogPostView = false;
        let targetUrl = null;

        // Determine section to show
        if (postId && contentSections.post) {
            currentFilter = 'blog';
            const postContentElement = document.getElementById(postId + '-content');
            if (postContentElement) {
                contentSections.post.innerHTML = '';
                const clonedContent = postContentElement.cloneNode(true);
                const backButton = clonedContent.querySelector('.back-to-blog-btn');
                if (backButton) {
                    backButton.style.display = 'inline-block';
                    backButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        updateDisplay('blog', null, null, true);
                    });
                }
                while (clonedContent.firstChild) { contentSections.post.appendChild(clonedContent.firstChild); }
                sectionToShowId = 'post';
                isBlogPostView = true;
                targetUrl = `/blog/${postId}`;
                setTimeout(setupFullscreenImages, 50);
            } else {
                console.error(`Content for post ID '${postId}' not found.`);
                currentFilter = 'blog';
                sectionToShowId = 'blog';
                targetUrl = container.querySelector(`.filter-btn[data-filter="blog"]`)?.getAttribute('data-url') || '/blog';
            }
        } else if (targetFilter && contentSections[targetFilter]) {
            sectionToShowId = targetFilter;
            targetUrl = container.querySelector(`.filter-btn[data-filter="${targetFilter}"]`)?.getAttribute('data-url') || `/${targetFilter}`;
        } else {
            // This case should only happen if initial logic failed, fallback handled there.
            // Re-assign based on initialFilter determined earlier as a safeguard.
            currentFilter = initialFilter;
            sectionToShowId = initialFilter;
            postId = initialPostId; // Make sure postId is reset if falling back
            targetUrl = container.querySelector(`.filter-btn[data-filter="${currentFilter}"]`)?.getAttribute('data-url') || `/${currentFilter}`;
             if(postId) { // If initial load was a specific blog post that exists
                 sectionToShowId = 'post';
                 isBlogPostView = true;
                 targetUrl = `/blog/${postId}`;
                 // Content was already loaded during initial check
             } else if (!contentSections[sectionToShowId]){
                  // Ultimate fallback if section determined initially doesn't exist
                  console.error(`Fallback section element '#${sectionToShowId}' not found. Defaulting to 'home'.`);
                  currentFilter = 'home';
                  sectionToShowId = 'home';
                  targetUrl = '/home';
             }
        }

        // Update Nav Buttons
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === currentFilter);
        });

        // Hide all sections
        Object.keys(contentSections).forEach(key => {
            if (contentSections[key]) {
                contentSections[key].classList.add('hidden');
                contentSections[key].style.display = 'none';
            }
        });

        // Show target section
        const sectionToShow = contentSections[sectionToShowId];
        if (sectionToShow) {
            sectionToShow.classList.remove('hidden');
            if (sectionToShowId === 'wall') {
                sectionToShow.style.display = 'grid';
                filterCards(); // Filter cards if wall is shown
            } else if (sectionToShowId === 'blog' && !isBlogPostView) {
                 sectionToShow.style.display = 'block';
                 const blogGrid = sectionToShow.querySelector('.blog-grid');
                 if(blogGrid) blogGrid.style.display = 'grid';
            } else {
                sectionToShow.style.display = 'block';
            }
            if (sectionToShowId === 'wall' || sectionToShowId === 'home' || isBlogPostView) { // Add isBlogPostView here
                setTimeout(setupFullscreenImages, 50); // Ensure images setup on post view too
            }
        } else {
            console.error(`Target section element for ID '${sectionToShowId}' not found.`);
            // If even the ultimate fallback 'home' is missing, log error.
            if(contentSections.home) { // Try showing home if target is missing
                 contentSections.home.classList.remove('hidden');
                 contentSections.home.style.display = 'block';
                 filterButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-filter') === 'home'));
            }
        }

        // Update History
        if (updateHistory && targetUrl && window.location.pathname !== targetUrl) {
            const state = { filter: currentFilter, postId: isBlogPostView ? postId : null }; // Ensure postId null if not blog view
            window.history.pushState(state, '', targetUrl);
        }

        // Highlighting
        if (searchTermToHighlight) {
            highlightTextOnDisplay(searchTermToHighlight);
        } else {
             removeHighlights();
        }

        // Search Placeholder - **CRITICAL: Ensure pageSearchInput is declared before this function runs**
        if (pageSearchInput) { // Add check just in case
             pageSearchInput.placeholder = (currentFilter === 'wall') ? 'Search Wallpapers...' : 'Search Site...';
        } else {
             console.warn('pageSearchInput element not found when trying to set placeholder.');
        }

        // Close search results dropdown
        if (!isBlogPostView && !searchTermToHighlight && searchResultsContainer) {
             searchResultsContainer.innerHTML = '';
             searchResultsContainer.classList.remove('visible');
        }

        // Scroll
        if (!isBlogPostView) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (sectionToShow) {
            const headerHeight = container.querySelector('header')?.offsetHeight || 0;
            const navHeight = container.querySelector('.filter-nav')?.offsetHeight || 0;
            const offset = Math.max(0, headerHeight + navHeight - 20);
            window.scrollTo({ top: offset, behavior: 'smooth' });
        }
    }

    // --- Filter Cards Function ---
    function filterCards() {
        if (!pageSearchInput || !contentSections.wall || !cartoonCards.length) return;
        const searchTerm = pageSearchInput.value.toLowerCase().trim();
        removeHighlights();
        let foundHighlight = false;
        cartoonCards.forEach(card => {
            const cardTags = card.getAttribute('data-tags')?.toLowerCase() || '';
            const cardTitle = card.querySelector('.card-details h3')?.textContent.toLowerCase() || '';
            const cardDesc = card.querySelector('.card-details p')?.textContent.toLowerCase() || '';
            const cardTextContent = `${cardTags} ${cardTitle} ${cardDesc}`;
            const shouldShow = searchTerm === '' || cardTextContent.includes(searchTerm);
            card.style.display = shouldShow ? 'flex' : 'none';
             if (shouldShow && searchTerm !== '') {
                 const titleEl = card.querySelector('.card-details h3');
                 const descEl = card.querySelector('.card-details p');
                 if(titleEl) highlightTextInElement(titleEl, searchTerm);
                 if(descEl) highlightTextInElement(descEl, searchTerm);
                  if ((titleEl && titleEl.querySelector('.search-highlight')) || (descEl && descEl.querySelector('.search-highlight'))) {
                      foundHighlight = true;
                  }
             }
        });
         if (foundHighlight) {
             document.removeEventListener('click', clickAwayListenerForHighlights);
             document.addEventListener('click', clickAwayListenerForHighlights);
         }
    }

    // --- Site Search Function ---
    function executeSiteSearch(term) {
        if (!searchResultsContainer) return;
        searchResultsContainer.innerHTML = '';
        if (!term || term.length < 2) {
            searchResultsContainer.classList.remove('visible');
            return;
        }
        const results = [];
        const searchTerm = term.toLowerCase();
        const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const searchableConfig = [
            { filter: 'home', name: 'home', selectors: ['#home-content h1', '#home-content h2', '#home-content h3', '#home-content p:not(.post-meta)', '.preview-section h3', '.preview-section p'] },
            { filter: 'distracted', name: 'Distracted World', selectors: ['#distracted-content h1', '#distracted-content h2', '#distracted-content p:not(.post-meta)'] },
            { filter: 'organized', name: 'Organized World', selectors: ['#organized-content h1', '#organized-content h2', '#organized-content p:not(.post-meta)'] },
            { filter: 'blog', name: 'Blog List', selectors: ['#blog-content h1', '#blog-content .blog-post-card h3', '#blog-content .blog-post-card p'], isBlogList: true },
            { filter: 'wall', name: 'Wallpapers', selectors: ['.gallery-grid .cartoon-card'], isWallCard: true }
        ];
        const addResult = (config, element, textContent, primaryText = '') => {
            searchRegex.lastIndex = 0;
            if (searchRegex.test(textContent)) {
                searchRegex.lastIndex = 0;
                const match = searchRegex.exec(textContent);
                if (match) {
                    const index = match.index;
                    const start = Math.max(0, index - 30);
                    const end = Math.min(textContent.length, index + term.length + 50);
                    let snippet = textContent.substring(start, end).trim();
                    if (start > 0) snippet = '...' + snippet;
                    if (end < textContent.length) snippet = snippet + '...';
                    snippet = snippet.replace(searchRegex, match => `<strong>${match}</strong>`);
                    let displayText = primaryText ? `<em>${primaryText}:</em> ${snippet}` : snippet;
                    let targetPostId = null;
                    let targetFilter = config.filter;
                    if (config.isBlogList) {
                         const blogCard = element.closest('.blog-post-card');
                         targetPostId = blogCard?.querySelector('.blog-card-link-wrapper')?.getAttribute('data-post-id');
                         if (!targetPostId) return;
                         primaryText = blogCard?.querySelector('h3')?.textContent || 'Blog Item';
                          if(element.tagName === 'H3') primaryText = element.textContent;
                          displayText = `<em>${primaryText}:</em> ${snippet}`;
                    }
                     if (!results.some(r => r.text.substring(0, 40) === displayText.substring(0, 40) && r.postId === targetPostId && r.filter === targetFilter)) {
                        results.push({
                            section: config.name, filter: targetFilter, text: displayText, postId: targetPostId,
                            action: () => { updateDisplay(targetPostId ? null : targetFilter, targetPostId, term, true); }
                        });
                    }
                }
            }
        };
        searchableConfig.forEach(config => {
            if (!contentSections[config.filter]) return;
            config.selectors.forEach(selector => {
                container.querySelectorAll(selector).forEach(el => {
                    if (config.isWallCard) {
                        const title = el.querySelector('h3')?.textContent || '';
                        const desc = el.querySelector('p')?.textContent || '';
                        const tags = el.getAttribute('data-tags') || '';
                        addResult(config, el, `${title} ${desc} ${tags}`, title || 'Wallpaper');
                    } else {
                        let primary = (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') ? el.textContent : '';
                        addResult(config, el, el.textContent || '', primary);
                    }
                });
            });
        });
        const hiddenBlogPosts = container.querySelectorAll('div[id^="post-"][id$="-content"]');
        hiddenBlogPosts.forEach(postDiv => {
            const postIdMatch = postDiv.id.match(/^(post-\d+)-content$/);
            if (postIdMatch) {
                const postId = postIdMatch[1];
                const postTitle = postDiv.querySelector('h1')?.textContent || `Post ${postId.split('-')[1]}`;
                const postElements = postDiv.querySelectorAll('h1, h2, p');
                postElements.forEach(el => {
                    const elementText = el.textContent || '';
                    searchRegex.lastIndex = 0;
                    if (searchRegex.test(elementText)) {
                        searchRegex.lastIndex = 0;
                        const match = searchRegex.exec(elementText);
                        if (match) {
                            const index = match.index;
                            const start = Math.max(0, index - 30);
                            const end = Math.min(elementText.length, index + term.length + 50);
                            let snippet = elementText.substring(start, end).trim();
                            if (start > 0) snippet = '...' + snippet;
                            if (end < elementText.length) snippet = snippet + '...';
                            snippet = snippet.replace(searchRegex, match => `<strong>${match}</strong>`);
                            const sectionIdentifier = `Blog: ${postTitle}`;
                            if (!results.some(r => r.postId === postId && r.text.substring(0, 40) === snippet.substring(0, 40))) {
                                results.push({
                                    section: sectionIdentifier, filter: 'blog', text: snippet, postId: postId,
                                    action: () => { updateDisplay(null, postId, term, true); }
                                });
                            }
                        }
                    }
                });
            }
        });
        if (results.length > 0) {
            const groupedResults = {};
            results.forEach(result => {
                if (!groupedResults[result.section]) groupedResults[result.section] = [];
                 if (groupedResults[result.section].length < 5) { groupedResults[result.section].push(result); }
            });
            Object.entries(groupedResults).forEach(([sectionName, sectionResults]) => {
                const sectionHeader = document.createElement('div');
                sectionHeader.className = 'search-result-section';
                sectionHeader.textContent = sectionName;
                searchResultsContainer.appendChild(sectionHeader);
                sectionResults.forEach(result => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = result.text;
                    item.addEventListener('click', () => {
                        result.action();
                        if (searchWidget) searchWidget.classList.remove('expanded');
                        if (pageSearchInput) pageSearchInput.value = '';
                        searchResultsContainer.classList.remove('visible');
                    });
                    searchResultsContainer.appendChild(item);
                });
            });
            searchResultsContainer.classList.add('visible');
        } else {
            const noResults = document.createElement('div');
            noResults.className = 'search-result-item';
            noResults.textContent = 'No results found for "' + term + '"';
            searchResultsContainer.appendChild(noResults);
            searchResultsContainer.classList.add('visible');
        }
    }

    // --- Organized World Easter Egg ---
    function triggerOrganizedEasterEgg() {
        if (document.querySelector('.easter-egg-bounce')) return;
        const diMindImg = document.createElement('img');
        diMindImg.src = 'assets/images/di-mind-bounce.gif'; // Ensure this path is correct
        diMindImg.alt = 'Di-Mind Bouncing';
        diMindImg.className = 'easter-egg-bounce';
        document.body.appendChild(diMindImg);
        setTimeout(() => {
            if (diMindImg && diMindImg.parentNode) {
                 diMindImg.parentNode.removeChild(diMindImg);
            }
        }, 3000);
    }

     // --- Vintage Safe Easter Egg Logic ---
    function setupSafeEasterEgg() {
        const triggerImage = document.getElementById('easter-egg-trigger-image');
        const safeContainer = document.getElementById('secret-safe-container');
        const safeElement = document.getElementById('vintage-safe');
        const safeDoor = document.getElementById('safe-door');
        const dialDisplaySpans = document.querySelectorAll('#dial-display-area .dial-digit');
        const dialNumbers = document.querySelectorAll('#safe-dial .dial-number.enabled');
        const clearButton = document.getElementById('safe-clear-button');
        const openButton = document.getElementById('safe-open-button');
        const prizeContainer = document.getElementById('safe-prize');
        const safeMessage = document.getElementById('safe-message');
        const closeSafeButton = document.getElementById('close-safe-button');
        const dialTurnSound = document.getElementById('audio-dial-turn');
        const safeCreakSound = document.getElementById('audio-safe-creak');
        const safeUnlockSound = document.getElementById('audio-safe-unlock');
        const safeErrorSound = document.getElementById('audio-safe-error');
        const victorySound = document.getElementById('audio-victory');

        if (!triggerImage || !safeContainer || !safeElement || !safeDoor || dialDisplaySpans.length !== 3 || dialNumbers.length === 0 || !clearButton || !openButton || !prizeContainer || !safeMessage || !closeSafeButton || !dialTurnSound || !safeCreakSound || !safeUnlockSound || !safeErrorSound || !victorySound) {
            console.warn("Not all Easter egg safe elements found. Safe functionality disabled.");
            return;
        }

        const CLICK_INTERVAL_MAX = 500;
        const PAUSE_INTERVAL_MIN = 2000;
        const CORRECT_CODE = "369";
        const MAX_WRONG_ATTEMPTS = 3;

        let clickTimestamps = [];
        let currentStage = 0;
        let stageStartTime = 0;
        let currentCode = "";
        let wrongAttempts = 0;
        let easterEggActive = false;
        let patternCheckInterval;

        function resetPatternDetection() {
            clickTimestamps = []; currentStage = 0; stageStartTime = 0;
            if (patternCheckInterval) clearInterval(patternCheckInterval); patternCheckInterval = null; // Clear interval reference
        }

        function triggerHapticFeedback(type = 'light') {
            if ('vibrate' in navigator && navigator.vibrate) {
                try {
                    if (type === 'success') navigator.vibrate(200);
                    else if (type === 'error') navigator.vibrate([100, 50, 100]);
                    else navigator.vibrate(10);
                } catch (e) { /* Optional logging */ }
            }
        }

        function playSound(audioElement) {
            if (audioElement) {
                audioElement.currentTime = 0;
                audioElement.play().catch(e => console.warn("Audio playback failed:", e));
            }
        }

        function activateEasterEgg() {
            if (easterEggActive) return; easterEggActive = true; resetPatternDetection();
            triggerImage.classList.add('shake-and-fade'); playSound(safeCreakSound); triggerHapticFeedback('success');
            triggerImage.addEventListener('animationend', () => {
                triggerImage.classList.add('hidden'); triggerImage.style.pointerEvents = 'none';
                safeContainer.classList.remove('hidden'); safeContainer.classList.add('visible');
                safeElement.classList.add('creak-in'); resetSafeState();
            }, { once: true });
        }

        function checkPatternState() {
             if (easterEggActive || currentStage === 0 || currentStage === 2 || currentStage === 4) return; // Only check during click sequence stages (1, 3) or pause detection (implicitly handled by click timing)
            const now = Date.now();
            const timeSinceStageStart = now - stageStartTime;

            if (currentStage === 1 && timeSinceStageStart >= PAUSE_INTERVAL_MIN) {
                currentStage = 2; clickTimestamps = []; stageStartTime = 0; // Ready for next sequence
            } else if (currentStage === 3 && timeSinceStageStart >= PAUSE_INTERVAL_MIN) {
                currentStage = 4; clickTimestamps = []; stageStartTime = 0; // Ready for final sequence
            }
        }

        triggerImage.addEventListener('click', (e) => {
            if (easterEggActive) return;
            triggerImage.classList.add('light-up'); setTimeout(() => triggerImage.classList.remove('light-up'), 500);
            const now = Date.now();
            const timeSinceLastClick = clickTimestamps.length > 0 ? now - clickTimestamps[clickTimestamps.length - 1] : Infinity;

            if (!patternCheckInterval) { // Start interval only once
                 patternCheckInterval = setInterval(checkPatternState, 200); // Check more frequently for pauses
             }

             // --- Simplified Pattern Logic ---
             // Stage 0: Expecting 1st of 3 clicks
             if (currentStage === 0) {
                 if (timeSinceLastClick > CLICK_INTERVAL_MAX * 2) { // Allow slightly longer first interval
                     resetPatternDetection(); // Reset if too long between clicks (start of sequence)
                 }
                 clickTimestamps.push(now);
                 stageStartTime = now; // Track start of this potential sequence
                 if (clickTimestamps.length === 3) {
                     currentStage = 1; // Move to pause detection after 3 clicks
                 }
             }
             // Stage 1: Pause detected after 3 clicks, Expecting 1st of 6 clicks
             else if (currentStage === 2) {
                 if (timeSinceLastClick > CLICK_INTERVAL_MAX * 2) { resetPatternDetection(); clickTimestamps.push(now); stageStartTime = now; return; } // Reset if pause too long or start new if first click
                 clickTimestamps.push(now);
                 if (clickTimestamps.length === 6) {
                     currentStage = 3; // Move to pause detection after 6 clicks
                     stageStartTime = now; // Track start of this 6-click sequence
                 }
             }
              // Stage 3: Pause detected after 6 clicks, Expecting 1st of 9 clicks
              else if (currentStage === 4) {
                 if (timeSinceLastClick > CLICK_INTERVAL_MAX * 2) { resetPatternDetection(); clickTimestamps.push(now); stageStartTime = now; return; }
                 clickTimestamps.push(now);
                 if (clickTimestamps.length === 9) {
                     activateEasterEgg(); // SUCCESS
                 }
             }
             // Click during pause stages (1 or 3) or invalid timing
             else {
                 resetPatternDetection();
                 clickTimestamps.push(now); // Start a new sequence attempt
                 stageStartTime = now;
             }
             // --- End Simplified Pattern Logic ---
        });

        function updateDisplaySafe() {
            for (let i = 0; i < 3; i++) { if(dialDisplaySpans[i]) { dialDisplaySpans[i].textContent = currentCode[i] || '-'; } }
        }
        function resetSafeState() {
            currentCode = ""; wrongAttempts = 0; updateDisplaySafe(); safeMessage.textContent = "Enter Code: 3-6-9";
            safeMessage.classList.remove('error', 'success'); safeDoor.classList.remove('hidden');
            prizeContainer.classList.add('hidden'); prizeContainer.classList.remove('visible');
            openButton.disabled = false; clearButton.disabled = false; // Ensure clear button enabled too
            dialNumbers.forEach(btn => btn.disabled = false);
        }
        function handleSafeUnlock() {
            playSound(safeUnlockSound); playSound(victorySound); triggerHapticFeedback('success');
            safeMessage.textContent = "UNLOCKED!"; safeMessage.classList.add('success');
            safeDoor.classList.add('hidden'); prizeContainer.classList.remove('hidden'); prizeContainer.classList.add('visible');
            openButton.disabled = true; clearButton.disabled = true; dialNumbers.forEach(btn => btn.disabled = true);
        }
        function handleSafeError() {
            wrongAttempts++; playSound(safeErrorSound); triggerHapticFeedback('error');
            safeMessage.textContent = `WRONG CODE (${wrongAttempts}/${MAX_WRONG_ATTEMPTS})`; safeMessage.classList.add('error');
            currentCode = ""; updateDisplaySafe();
            if (wrongAttempts >= MAX_WRONG_ATTEMPTS) {
                safeMessage.textContent = `LOCKED OUT!`; openButton.disabled = true; clearButton.disabled = true;
                dialNumbers.forEach(btn => btn.disabled = true); setTimeout(closeSafe, 2500);
            } else {
                setTimeout(() => { if (wrongAttempts < MAX_WRONG_ATTEMPTS && !openButton.disabled) { safeMessage.textContent = "Enter Code: 3-6-9"; safeMessage.classList.remove('error'); } }, 1500);
            }
        }
        function closeSafe() {
            safeContainer.classList.remove('visible'); safeContainer.classList.add('hidden'); safeElement.classList.remove('creak-in');
            easterEggActive = false; resetPatternDetection(); resetSafeState();
            triggerImage.classList.remove('hidden', 'shake-and-fade'); triggerImage.style.pointerEvents = 'auto';
             openButton.disabled = false; clearButton.disabled = false; dialNumbers.forEach(btn => btn.disabled = false);
        }
        dialNumbers.forEach(button => { button.addEventListener('click', () => { if (currentCode.length < 3 && !openButton.disabled) { currentCode += button.dataset.value; updateDisplaySafe(); playSound(dialTurnSound); triggerHapticFeedback(); if (safeMessage.classList.contains('error') || safeMessage.textContent !== "Enter Code: 3-6-9") { safeMessage.textContent = "Enter Code: 3-6-9"; safeMessage.classList.remove('error', 'success'); } } }); });
        clearButton.addEventListener('click', () => { if (!openButton.disabled) { currentCode = ""; updateDisplaySafe(); playSound(dialTurnSound); triggerHapticFeedback(); safeMessage.textContent = "Enter Code: 3-6-9"; safeMessage.classList.remove('error', 'success'); } });
        openButton.addEventListener('click', () => { if (currentCode === CORRECT_CODE) { handleSafeUnlock(); } else if (currentCode.length === 3) { handleSafeError(); } else { safeMessage.textContent = "Enter 3 digits"; safeMessage.classList.add('error'); setTimeout(() => { if (!openButton.disabled) { safeMessage.textContent = "Enter Code: 3-6-9"; safeMessage.classList.remove('error'); } }, 1500); } });
        closeSafeButton.addEventListener('click', closeSafe);
    } // --- End setupSafeEasterEgg ---


    /* =========================================== */
    /* === EVENT LISTENERS & INITIAL SETUP ==== */
    /* =========================================== */

    // Main Navigation Button Clicks
    if (filterButtons.length > 0) {
        console.log('ATTACHING listeners to filterButtons...'); // DIAGNOSTIC
        filterButtons.forEach(button => {
            button.addEventListener('click', e => {
                console.log('NAV BUTTON CLICKED:', button.dataset.filter); // DIAGNOSTIC
                e.preventDefault();
                updateDisplay(button.getAttribute('data-filter'), null, null, true);
            });
        });
    } else {
         console.error("Could not find any filter buttons to attach listeners to!");
    }

    // "Read More" Button Clicks
    readMoreButtons.forEach(button => {
        button.addEventListener('click', e => {
            e.preventDefault();
            const filterTarget = button.getAttribute('data-target-filter');
            const linkTarget = button.getAttribute('data-post-id');
            if (filterTarget) { updateDisplay(filterTarget, null, null, true); }
            else if (linkTarget) { updateDisplay(null, linkTarget, null, true); }
            else if (button.classList.contains('page-link') && button.getAttribute('href') === '#') { console.warn("Read more button clicked with no target:", button); }
        });
    });

    // Blog Card Link Clicks
    blogCardLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const postId = link.getAttribute('data-post-id');
            if (postId) { updateDisplay(null, postId, null, true); }
        });
    });

    // Handle Browser Back/Forward Navigation
    window.addEventListener('popstate', (e) => {
        const state = e.state;
        const path = window.location.pathname;
        let filter = 'home'; // Default filter
        let postId = null;
        let needsUpdate = true; // Flag to prevent unnecessary updates if state is null but path matches current filter

        if (state && state.filter) {
            filter = state.filter;
            postId = state.postId;
        } else {
            // No state, determine from path
            const blogPostMatch = path.match(/^\/blog\/(post-\d+)$/);
             let foundMatch = false;
            if (blogPostMatch) {
                 const tempPostId = blogPostMatch[1];
                 // Check if post content exists before setting state
                 if (document.getElementById(tempPostId + '-content')) {
                     filter = 'blog';
                     postId = tempPostId;
                     foundMatch = true;
                 } else {
                      filter = 'blog'; // Go to blog list if post invalid
                      foundMatch = true;
                 }
            } else {
                filterButtons.forEach(btn => {
                    if (btn.getAttribute('data-url') === path) {
                        filter = btn.getAttribute('data-filter');
                        foundMatch = true;
                    }
                });
            }
            if (!foundMatch && path !== '/') { // If path isn't root and no match, default to home
                 filter = 'home';
            } else if (!foundMatch && path === '/') { // If root path and no explicit match, default to home
                 filter = 'home';
            }
             // Check if the determined state matches what's already displayed
             const currentActiveButton = container.querySelector('.filter-btn.active');
             const currentFilterDisplayed = currentActiveButton ? currentActiveButton.dataset.filter : 'home';
             const currentPostDisplayed = !contentSections.post.classList.contains('hidden');

             if (filter === currentFilterDisplayed && postId === null && !currentPostDisplayed) {
                 needsUpdate = false; // Already showing the correct main section
             }
             // More complex check needed if comparing post views
        }

        if (needsUpdate) {
            updateDisplay(filter, postId, null, false);
        }
    });

    // Search Widget Interactions
    if (searchToggleBtn && pageSearchInput && searchWidget && searchResultsContainer) {
        searchToggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            const isNowExpanded = searchWidget.classList.toggle('expanded');
            if (isNowExpanded) {
                pageSearchInput.focus();
                let activeFilter = container.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'home';
                pageSearchInput.placeholder = (activeFilter === 'wall') ? 'Search Wallpapers...' : 'Search Site...';
            } else {
                pageSearchInput.value = ''; searchResultsContainer.innerHTML = '';
                searchResultsContainer.classList.remove('visible'); removeHighlights();
                 if (container.querySelector('.filter-btn[data-filter="wall"].active')) { filterCards(); }
            }
        });
        let searchTimeout;
        pageSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const currentTerm = pageSearchInput.value;
            const isOnWallView = container.querySelector('.filter-btn[data-filter="wall"].active') !== null;
            if (currentTerm.toLowerCase().trim() === 'organized' && searchWidget.classList.contains('expanded')) { triggerOrganizedEasterEgg(); }
            if (searchWidget.classList.contains('expanded')) { searchTimeout = setTimeout(() => executeSiteSearch(currentTerm), 300); }
            else if (isOnWallView) { filterCards(); searchResultsContainer.classList.remove('visible'); }
            else { searchResultsContainer.classList.remove('visible'); }
        });
        searchResultsContainer.addEventListener('mousedown', e => e.preventDefault());
        document.addEventListener('click', event => {
            if (searchWidget && !searchWidget.contains(event.target) && searchWidget.classList.contains('expanded')) {
                searchWidget.classList.remove('expanded'); searchResultsContainer.classList.remove('visible');
            }
        });
        pageSearchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && searchWidget.classList.contains('expanded')) {
                e.preventDefault();
                const firstResult = searchResultsContainer.querySelector('.search-result-item');
                if (firstResult && !firstResult.textContent.startsWith('No results')) { firstResult.click(); }
                else { searchResultsContainer.classList.remove('visible'); }
            } else if (e.key === 'Escape' && searchWidget.classList.contains('expanded')) { searchToggleBtn.click(); }
        });
    } else {
        console.warn("Search widget elements not fully found. Search functionality may be limited.");
    }

    // --- Initial Setup Calls ---
    if (yearSpan) yearSpan.textContent = new Date().getFullYear(); // Set copyright year

    // Initial display call (now happens EARLIER, using initialFilter/initialPostId)
    // updateDisplay(initialFilter, initialPostId, null, false); // THIS CALL MOVED HIGHER

    // Setup Easter Egg
    setupSafeEasterEgg();

})(); // End IIFE
