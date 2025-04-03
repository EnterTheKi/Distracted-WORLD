(function() {
    const container = document.querySelector('.gallery-page-container');
    // Early exit if the main container isn't found
    if (!container) {
        console.error("Gallery container '.gallery-page-container' not found! Script cannot run.");
        return;
    }

    // Elements
    const filterButtons = container.querySelectorAll('.filter-nav .filter-btn');
    const contentSections = {
        about: container.querySelector('#about-content'),
        wall: container.querySelector('#gallery-grid'),
        distracted: container.querySelector('#distracted-content'),
        organized: container.querySelector('#organized-content'),
        blog: container.querySelector('#blog-content'),
        post: container.querySelector('#full-blog-post-view') // Container for single post view
    };

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
// Add this block near the top of your script.js, inside the IIFE

// Check for redirect path from 404 page
const ghPagesPath = sessionStorage.getItem('ghPagesPath');
let initialPathToLoad = window.location.pathname; // Default to current path

if (ghPagesPath) {
    // If path found in storage, use it as the intended path
    initialPathToLoad = ghPagesPath;
    // Clear the stored path so it doesn't interfere on subsequent loads
    sessionStorage.removeItem('ghPagesPath');
    // Silently update the browser history to reflect the intended path
    // Use replaceState so the 404->redirect->correct path isn't two history entries
    window.history.replaceState(null, '', initialPathToLoad);
}

// NOW, use 'initialPathToLoad' instead of 'window.location.pathname'
// in the part of your script that determines the initial view on load.
// For example, modify the initial load logic within updateDisplay or before calling it:

// --- Inside or before the initial updateDisplay call ---
// (Adjust based on where your initial path detection happens)

// Determine initial state based on the potentially corrected path
let initialFilter = 'about';
let initialPostId = null;
let foundMatch = false;

const blogPostMatch = initialPathToLoad.match(/^\/blog\/(post-\d+)$/);
if (blogPostMatch && contentSections.post) {
    // Check if post content exists before assuming match
    const tempPostId = blogPostMatch[1];
    if (document.getElementById(tempPostId + '-content')) {
        initialFilter = 'blog';
        initialPostId = tempPostId;
        foundMatch = true;
    }
}

if (!foundMatch) {
    filterButtons.forEach(btn => {
        const btnUrl = btn.getAttribute('data-url');
        const btnFilter = btn.getAttribute('data-filter');
        // Allow matching root path '/' to '/about'
        if (btnUrl === initialPathToLoad || (initialPathToLoad === '/' && btnFilter === 'about')) {
             if (contentSections[btnFilter]) { // Check section exists
                initialFilter = btnFilter;
                foundMatch = true;
             }
        }
    });
}

// If still no match, default to 'about'
if (!foundMatch) {
    initialFilter = 'about';
}

// Initial display call using determined filter/postId
updateDisplay(initialFilter, initialPostId, null, false); // false: don't push history on initial load

// Remove the OLD initial updateDisplay call if it was separate
// Example: // updateDisplay(null, null, null, false); // REMOVE this if it was outside logic block

// --- Rest of your script.js ---
    const cartoonCards = contentSections.wall ? contentSections.wall.querySelectorAll('.cartoon-card') : [];
    const blogCardLinks = container.querySelectorAll('.blog-card-link-wrapper');
    const readMoreButtons = container.querySelectorAll('.read-more-btn'); // Includes those inside previews

    // Search Elements
    const searchWidget = container.querySelector('#search-widget');
    const searchToggleBtn = container.querySelector('#searchToggle');
    const pageSearchInput = container.querySelector('#pageSearchInput');
    const searchResultsContainer = container.querySelector('#searchResults');

    // --- Fullscreen Image Functionality ---
    function setupFullscreenImages() {
        // Select images intended for fullscreen view - Adjusted selector for new About image structure
        const clickableImages = container.querySelectorAll('.card-image-placeholder img, .blog-image-placeholder img, #full-blog-post-view img.placeholder-image, #about-content .image-container img.about-main-image');
        clickableImages.forEach(img => {
            if (!img.dataset.fullscreenListenerAdded) {
                // Check if cursor style already applied by CSS, otherwise apply here
                if (window.getComputedStyle(img).cursor !== 'pointer' && window.getComputedStyle(img).cursor !== 'url("assets/cursors/glove-pointer.png") 0 0, pointer') {
                     img.style.cursor = 'pointer';
                }
                img.addEventListener('click', handleImageClick);
                img.dataset.fullscreenListenerAdded = 'true';
            }
        });
    }

    function handleImageClick(e) {
        e.stopPropagation(); // Prevent card/link click when image is clicked
        showFullscreenImage(this.src, this.alt);
    }

    function showFullscreenImage(src, alt) {
        // Remove existing overlay first
        const existingOverlay = document.querySelector('.fullscreen-overlay');
        if (existingOverlay && existingOverlay.parentNode) {
            existingOverlay.parentNode.removeChild(existingOverlay);
        }

        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay'; // Relies on CSS for styling

        const fullscreenImg = document.createElement('img');
        fullscreenImg.className = 'fullscreen-image'; // Relies on CSS for styling
        fullscreenImg.src = src;
        fullscreenImg.alt = alt || "Fullscreen Image";

        overlay.appendChild(fullscreenImg);

        // Click overlay to close
        overlay.addEventListener('click', () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
        document.body.appendChild(overlay); // Append to body to ensure it covers everything
    }

    // --- Text Highlighting Functions (for Search) ---
    function highlightTextInElement(element, searchTerm) {
        if (!element || !element.textContent || typeof element.textContent !== 'string' || searchTerm.length < 1) return;

        // Store original HTML if not already stored
        if (!element.dataset.originalHtml) {
            element.dataset.originalHtml = element.innerHTML;
        } else {
            // If already highlighted, revert to original before re-highlighting
            element.innerHTML = element.dataset.originalHtml;
        }

        const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedSearchTerm})`, 'gi'); // Capture the match

        // Replace text nodes, avoid breaking HTML structure
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToReplace = [];

        while(node = walker.nextNode()) {
             // Check if the node is inside an element we want to search and not inside script/style
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
                 // Check if the regex matches this specific text node
                 const localRegex = new RegExp(regex.source, regex.flags); // Create a fresh regex instance
                 if (localRegex.test(nodeValue)) {
                     nodesToReplace.push({node: node, value: nodeValue});
                 }
             }
        }

        nodesToReplace.forEach(item => {
            const localRegex = new RegExp(regex.source, regex.flags); // Use fresh regex instance
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
            // Check if the stored HTML exists before trying to restore
            if (typeof element.dataset.originalHtml === 'string') {
                element.innerHTML = element.dataset.originalHtml;
            }
            delete element.dataset.originalHtml; // Clean up attribute
        });

         // Remove the global click listener when highlights are removed
        document.removeEventListener('click', clickAwayListenerForHighlights);
    }

     // Specific listener to remove highlights when clicking outside search
    function clickAwayListenerForHighlights(event) {
         if (searchWidget && !searchWidget.contains(event.target)) {
             removeHighlights();
         }
    }


    // Helper function to apply highlighting after navigation/search
    function highlightTextOnDisplay(searchTerm) {
        setTimeout(() => {
            removeHighlights(); // Clear previous highlights
            if (!searchTerm || searchTerm.trim().length === 0) return;

            const currentSection = container.querySelector('.page-content:not(.hidden), .gallery-grid:not(.hidden)');
            if (currentSection) {
                // Define more precise selectors for content areas
                const elementsToSearch = currentSection.querySelectorAll(
                    'h1, h2, h3, p, .card-details h3, .card-details p, .blog-card-details h3, .blog-card-details p'
                );
                let foundHighlight = false;
                elementsToSearch.forEach(el => {
                    // Check if element is actually visible (offsetParent works for block/inline-block)
                    if (el.offsetParent !== null) {
                        highlightTextInElement(el, searchTerm);
                        // Check if the highlighting was successful
                        if (el.querySelector('.search-highlight')) {
                             foundFoundHighlight = true;
                         }
                    }
                });

                 // Add listener to remove highlights on click away ONLY if highlights were added
                 if (foundFoundHighlight) {
                     document.removeEventListener('click', clickAwayListenerForHighlights); // Prevent duplicates
                     document.addEventListener('click', clickAwayListenerForHighlights);
                 }
            }
        }, 100); // Delay to allow DOM update
    }

    // --- Main Display Function (SPA Logic) ---
    // Modified to handle URL updates and initial state from URL
    function updateDisplay(targetFilter = null, postId = null, searchTermToHighlight = null, updateHistory = true) {
        let currentFilter = targetFilter;
        let sectionToShowId = null;
        let isBlogPostView = false;
        let targetUrl = null; // URL to push to history

        // Determine which section to show based on filter or postId
        if (postId && contentSections.post) {
            // --- Showing a single blog post ---
            currentFilter = 'blog'; // Keep 'blog' button active
            const postContentElement = document.getElementById(postId + '-content');

            if (postContentElement) {
                contentSections.post.innerHTML = ''; // Clear previous post
                const clonedContent = postContentElement.cloneNode(true);

                const backButton = clonedContent.querySelector('.back-to-blog-btn');
                if (backButton) {
                    backButton.style.display = 'inline-block';
                    backButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        const blogListUrl = container.querySelector('.filter-btn[data-filter="blog"]')?.getAttribute('data-url') || '/blog';
                        updateDisplay('blog', null, null, true); // Update display and history
                    });
                }

                while (clonedContent.firstChild) {
                    contentSections.post.appendChild(clonedContent.firstChild);
                }

                sectionToShowId = 'post';
                isBlogPostView = true;
                targetUrl = `/blog/${postId}`; // Set URL for blog post
                setTimeout(setupFullscreenImages, 50);
            } else {
                console.error("Content for post ID '" + postId + "' not found.");
                currentFilter = 'blog'; // Fallback to blog list
                sectionToShowId = 'blog';
                targetUrl = container.querySelector(`.filter-btn[data-filter="blog"]`)?.getAttribute('data-url') || '/blog';
            }
        } else if (targetFilter && contentSections[targetFilter]) {
            // --- Showing a main section ---
            sectionToShowId = targetFilter;
            targetUrl = container.querySelector(`.filter-btn[data-filter="${targetFilter}"]`)?.getAttribute('data-url') || `/${targetFilter}`;
        } else {
             // --- Fallback / Initial Load from URL or Default ---
             const path = window.location.pathname;
             let foundMatch = false;

             // Try matching blog post URL first
             const blogPostMatch = path.match(/^\/blog\/(post-\d+)$/);
             if (blogPostMatch && contentSections.post) {
                  const initialPostId = blogPostMatch[1];
                  const postContentElement = document.getElementById(initialPostId + '-content');
                  if(postContentElement) {
                      currentFilter = 'blog';
                      sectionToShowId = 'post';
                      postId = initialPostId; // Set postId for later logic
                      isBlogPostView = true;
                      targetUrl = path; // Keep the current URL
                      foundMatch = true;
                      // Load content later in the function
                  } else {
                      console.warn(`Post content for ${initialPostId} not found on initial load. Falling back.`);
                      // Fallback handled below
                  }
             }

             // Try matching main section URL
             if (!foundMatch) {
                filterButtons.forEach(btn => {
                    const btnUrl = btn.getAttribute('data-url');
                    const btnFilter = btn.getAttribute('data-filter');
                    if (btnUrl === path && contentSections[btnFilter]) {
                        currentFilter = btnFilter;
                        sectionToShowId = btnFilter;
                        targetUrl = path;
                        foundMatch = true;
                    }
                });
             }

             // Default to 'about' if no match or root path
             if (!foundMatch || path === '/') {
                 currentFilter = 'about';
                 sectionToShowId = 'about';
                 targetUrl = container.querySelector(`.filter-btn[data-filter="about"]`)?.getAttribute('data-url') || '/about';
             }

             // Handle loading blog post content if matched initially
             if (isBlogPostView && postId) {
                const postContentElement = document.getElementById(postId + '-content');
                if (postContentElement) {
                    contentSections.post.innerHTML = ''; // Clear previous post
                    const clonedContent = postContentElement.cloneNode(true);
                    const backButton = clonedContent.querySelector('.back-to-blog-btn');
                    if (backButton) {
                        backButton.style.display = 'inline-block';
                        backButton.addEventListener('click', (e) => {
                            e.preventDefault();
                            const blogListUrl = container.querySelector('.filter-btn[data-filter="blog"]')?.getAttribute('data-url') || '/blog';
                            updateDisplay('blog', null, null, true); // Go back to list and update history
                        });
                    }
                    while (clonedContent.firstChild) { contentSections.post.appendChild(clonedContent.firstChild); }
                    setTimeout(setupFullscreenImages, 50);
                } else {
                    // This case should ideally not happen due to earlier check, but acts as safeguard
                    console.error(`Post content ${postId} missing during initial load content setup.`);
                    isBlogPostView = false; // Revert state
                    sectionToShowId = 'blog'; // Fallback to blog list view
                    currentFilter = 'blog';
                    targetUrl = container.querySelector(`.filter-btn[data-filter="blog"]`)?.getAttribute('data-url') || '/blog';
                }
            }
        }


        // Update Navigation Button Active State
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === currentFilter);
        });

        // Hide all content sections first
        Object.keys(contentSections).forEach(key => {
            if (contentSections[key]) {
                contentSections[key].classList.add('hidden');
                contentSections[key].style.display = 'none';
            }
        });

        // Show the target section
        const sectionToShow = contentSections[sectionToShowId];
        if (sectionToShow) {
            sectionToShow.classList.remove('hidden');
            const displayType = (sectionToShowId === 'wall') ? 'grid' : 'block'; // Simplified display type logic
             // Apply display style
            if (sectionToShowId === 'wall') {
                sectionToShow.style.display = 'grid';
            } else if (sectionToShowId === 'blog' && !isBlogPostView) {
                 // Container is block, inner grid needs setting
                 sectionToShow.style.display = 'block';
                 const blogGrid = sectionToShow.querySelector('.blog-grid');
                 if(blogGrid) blogGrid.style.display = 'grid';
            } else {
                sectionToShow.style.display = 'block';
            }

            // Setup images if showing Wall or About
            if (sectionToShowId === 'wall' || sectionToShowId === 'about') {
                setTimeout(setupFullscreenImages, 50);
            }
            // If showing Wall, apply potential search term filter from input
            if (sectionToShowId === 'wall') {
                 filterCards();
            }
        } else {
            console.error(`Target section element '#${sectionToShowId}-content' or similar not found.`);
            // Fallback to 'about' if target section element is missing
            if(contentSections.about) {
                contentSections.about.classList.remove('hidden');
                contentSections.about.style.display = 'block';
                currentFilter = 'about'; // Update active state
                targetUrl = container.querySelector(`.filter-btn[data-filter="about"]`)?.getAttribute('data-url') || '/about';
                filterButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-filter') === 'about'));
                setTimeout(setupFullscreenImages, 50);
            }
        }

        // Update Browser History if requested and URL changed
        if (updateHistory && targetUrl && window.location.pathname !== targetUrl) {
            const state = { filter: currentFilter, postId: postId }; // Store state
            window.history.pushState(state, '', targetUrl);
        }

        // Handle Search Term Highlighting
        if (searchTermToHighlight) {
            highlightTextOnDisplay(searchTermToHighlight);
        } else {
             removeHighlights(); // Clear highlights on normal navigation
        }

        // Handle Search Bar State (Placeholder text)
        if (pageSearchInput) {
             pageSearchInput.placeholder = (currentFilter === 'wall') ? 'Search Wallpapers...' : 'Search Site...';
        }
         // Close search results dropdown when navigating sections normally
        if (!isBlogPostView && !searchTermToHighlight && searchResultsContainer) {
             searchResultsContainer.innerHTML = '';
             searchResultsContainer.classList.remove('visible');
        }


        // Scroll to top for main sections, or partway for posts
        if (!isBlogPostView) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (sectionToShow) {
            const headerHeight = container.querySelector('header')?.offsetHeight || 0;
            const navHeight = container.querySelector('.filter-nav')?.offsetHeight || 0;
            const offset = Math.max(0, headerHeight + navHeight - 20); // Scroll just below nav
            window.scrollTo({ top: offset, behavior: 'smooth' });
        }
    }


    // --- Filter Cards Function (for Wall view search) ---
    function filterCards() {
        if (!pageSearchInput || !contentSections.wall || !cartoonCards.length) return;
        const searchTerm = pageSearchInput.value.toLowerCase().trim();
        removeHighlights(); // Clear wall highlights before filtering/re-highlighting

        let foundHighlight = false;
        cartoonCards.forEach(card => {
            const cardTags = card.getAttribute('data-tags')?.toLowerCase() || '';
            const cardTitle = card.querySelector('.card-details h3')?.textContent.toLowerCase() || '';
            const cardDesc = card.querySelector('.card-details p')?.textContent.toLowerCase() || '';
            const cardTextContent = `${cardTags} ${cardTitle} ${cardDesc}`;

            const shouldShow = searchTerm === '' || cardTextContent.includes(searchTerm);
            card.style.display = shouldShow ? 'flex' : 'none'; // Wall cards use flex

            // Highlight text within visible cards if there's a search term
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

         // Add clickaway listener *if* highlights were applied and there was a search term
         if (foundHighlight) {
             document.removeEventListener('click', clickAwayListenerForHighlights);
             document.addEventListener('click', clickAwayListenerForHighlights);
         }
    }


    // --- Site Search Function (for Search Widget Dropdown) ---
    function executeSiteSearch(term) {
        if (!searchResultsContainer) return; // Exit if container doesn't exist

        searchResultsContainer.innerHTML = ''; // Clear previous results
        // Keep highlights on main page content when showing dropdown results

        if (!term || term.length < 2) {
            searchResultsContainer.classList.remove('visible');
            return;
        }

        const results = [];
        const searchTerm = term.toLowerCase();
        const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

        // Searchable Areas Configuration (Refined)
        const searchableConfig = [
            { filter: 'about', name: 'About', selectors: ['#about-content h1', '#about-content h2', '#about-content h3', '#about-content p:not(.post-meta)', '.preview-section h3', '.preview-section p'] },
            { filter: 'distracted', name: 'Distracted World', selectors: ['#distracted-content h1', '#distracted-content h2', '#distracted-content p:not(.post-meta)'] },
            { filter: 'organized', name: 'Organized World', selectors: ['#organized-content h1', '#organized-content h2', '#organized-content p:not(.post-meta)'] },
            { filter: 'blog', name: 'Blog List', selectors: ['#blog-content h1', '#blog-content .blog-post-card h3', '#blog-content .blog-post-card p'], isBlogList: true },
            { filter: 'wall', name: 'Wallpapers', selectors: ['.gallery-grid .cartoon-card'], isWallCard: true }
        ];

        // Function to create snippet and add result
        const addResult = (config, element, textContent, primaryText = '') => {
            searchRegex.lastIndex = 0; // Reset regex index for each test
            if (searchRegex.test(textContent)) {
                searchRegex.lastIndex = 0; // Reset again for exec
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
                         if (!targetPostId) return; // Skip if no post ID found
                         primaryText = blogCard?.querySelector('h3')?.textContent || 'Blog Item';
                          if(element.tagName === 'H3') primaryText = element.textContent; // Use h3 as primary
                          displayText = `<em>${primaryText}:</em> ${snippet}`; // Ensure primary text prefix
                    }

                    // Avoid duplicate results showing the exact same snippet start
                     if (!results.some(r => r.text.substring(0, 40) === displayText.substring(0, 40) && r.postId === targetPostId && r.filter === targetFilter)) {
                        results.push({
                            section: config.name,
                            filter: targetFilter,
                            text: displayText,
                            postId: targetPostId,
                            action: () => {
                                // Pass true to update history when clicking search result
                                updateDisplay(targetPostId ? null : targetFilter, targetPostId, term, true);
                            }
                        });
                    }
                }
            }
        };

        // Search Main Content Sections
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

        // Search Hidden Blog Post Content
        const hiddenBlogPosts = container.querySelectorAll('div[id^="post-"][id$="-content"]');
        hiddenBlogPosts.forEach(postDiv => {
            const postIdMatch = postDiv.id.match(/^(post-\d+)-content$/);
            if (postIdMatch) {
                const postId = postIdMatch[1];
                const postTitleElement = postDiv.querySelector('h1');
                const postTitle = postTitleElement ? postTitleElement.textContent : `Post ${postId.split('-')[1]}`;
                const postElements = postDiv.querySelectorAll('h1, h2, p'); // Search headings and paragraphs

                postElements.forEach(el => {
                    const elementText = el.textContent || '';
                    searchRegex.lastIndex = 0; // Reset
                    if (searchRegex.test(elementText)) {
                        searchRegex.lastIndex = 0; // Reset
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
                            const displayText = snippet;

                            if (!results.some(r => r.postId === postId && r.text.substring(0, 40) === displayText.substring(0, 40))) {
                                results.push({
                                    section: sectionIdentifier,
                                    filter: 'blog',
                                    text: displayText,
                                    postId: postId,
                                    action: () => {
                                        // Pass true to update history when clicking search result
                                        updateDisplay(null, postId, term, true);
                                    }
                                });
                            }
                        }
                    }
                });
            }
        });


        // Display Search Results
        if (results.length > 0) {
            const groupedResults = {};
            results.forEach(result => {
                if (!groupedResults[result.section]) groupedResults[result.section] = [];
                 if (groupedResults[result.section].length < 5) { // Limit results per section
                    groupedResults[result.section].push(result);
                }
            });

            Object.entries(groupedResults).forEach(([sectionName, sectionResults]) => {
                const sectionHeader = document.createElement('div');
                sectionHeader.className = 'search-result-section';
                sectionHeader.textContent = sectionName;
                searchResultsContainer.appendChild(sectionHeader);

                sectionResults.forEach(result => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = result.text; // Display snippet
                    item.addEventListener('click', () => {
                        result.action(); // Navigate and highlight (includes history update)
                        // Close search after selection
                        if (searchWidget) searchWidget.classList.remove('expanded');
                        if (pageSearchInput) pageSearchInput.value = '';
                        searchResultsContainer.classList.remove('visible');
                        // Keep highlights after clicking result: removeHighlights(); // Optionally remove highlights
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


    // --- Organized World Easter Egg (Copied from v1) ---
    function triggerOrganizedEasterEgg() {
        // Check if an egg is already bouncing
        if (document.querySelector('.easter-egg-bounce')) return;

        const diMindImg = document.createElement('img');
        // *** IMPORTANT: Make sure this image exists at this path relative to index.html ***
        diMindImg.src = 'assets/images/di-mind-bounce.gif'; // Path from v1
        diMindImg.alt = 'Di-Mind Bouncing'; // Added alt text
        diMindImg.className = 'easter-egg-bounce'; // CSS handles positioning and animation
        document.body.appendChild(diMindImg);
        // Remove after animation completes (animation duration is 3s in CSS)
        setTimeout(() => {
            if (diMindImg && diMindImg.parentNode) {
                 diMindImg.parentNode.removeChild(diMindImg);
            }
        }, 3000);
    }

    // --- Event Listeners ---

    // Main Navigation Button Clicks (Modified for URL/History)
    filterButtons.forEach(button => button.addEventListener('click', e => {
        e.preventDefault();
        updateDisplay(button.getAttribute('data-filter'), null, null, true); // Pass true to update history
    }));

    // "Read More" Button Clicks (Modified for URL/History)
    readMoreButtons.forEach(button => button.addEventListener('click', e => {
        e.preventDefault();
        const filterTarget = button.getAttribute('data-target-filter');
        const linkTarget = button.getAttribute('data-post-id');

        if (filterTarget) {
            updateDisplay(filterTarget, null, null, true); // Update history
        } else if (linkTarget) {
            updateDisplay(null, linkTarget, null, true); // Update history
        } else if (button.classList.contains('page-link') && button.getAttribute('href') === '#') {
             console.warn("Read more button clicked with no target:", button);
        }
    }));

    // Blog Card Link Clicks (Modified for URL/History)
    blogCardLinks.forEach(link => link.addEventListener('click', e => {
        e.preventDefault();
        const postId = link.getAttribute('data-post-id');
        if (postId) {
            updateDisplay(null, postId, null, true); // Update history
        }
    }));

    // Handle Browser Back/Forward Navigation
    window.addEventListener('popstate', (e) => {
        // Get state or determine from new path
        const state = e.state;
        const path = window.location.pathname;

        if (state && state.filter) {
            // Restore state if available
            updateDisplay(state.filter, state.postId, null, false); // false: don't push history again
        } else {
            // If no state, figure out section from path (similar to initial load logic)
            let filter = 'about';
            let postId = null;
            let foundMatch = false;

            const blogPostMatch = path.match(/^\/blog\/(post-\d+)$/);
            if (blogPostMatch) {
                 filter = 'blog';
                 postId = blogPostMatch[1];
                 foundMatch = true;
            } else {
                filterButtons.forEach(btn => {
                    if (btn.getAttribute('data-url') === path) {
                        filter = btn.getAttribute('data-filter');
                        foundMatch = true;
                    }
                });
            }
            if (!foundMatch && path !== '/') filter = 'about'; // Default

            updateDisplay(filter, postId, null, false); // Update display without pushing history
        }
    });


    // Search Widget Interactions
    if (searchToggleBtn && pageSearchInput && searchWidget && searchResultsContainer) {
        searchToggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            const isNowExpanded = searchWidget.classList.toggle('expanded');
            if (isNowExpanded) {
                pageSearchInput.focus();
                let activeFilter = container.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'about';
                pageSearchInput.placeholder = (activeFilter === 'wall') ? 'Search Wallpapers...' : 'Search Site...';
            } else {
                pageSearchInput.value = '';
                searchResultsContainer.innerHTML = '';
                searchResultsContainer.classList.remove('visible');
                removeHighlights();
                 if (container.querySelector('.filter-btn[data-filter="wall"].active')) {
                     filterCards();
                 }
            }
        });

        let searchTimeout;
        pageSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const currentTerm = pageSearchInput.value;
            const isOnWallView = container.querySelector('.filter-btn[data-filter="wall"].active') !== null;

            // Trigger 'organized' Easter egg
            if (currentTerm.toLowerCase().trim() === 'organized' && searchWidget.classList.contains('expanded')) {
                triggerOrganizedEasterEgg();
            }

            if (searchWidget.classList.contains('expanded')) {
                searchTimeout = setTimeout(() => executeSiteSearch(currentTerm), 300);
            } else if (isOnWallView) {
                 // Filter wall directly if not expanded
                 filterCards();
                 searchResultsContainer.classList.remove('visible');
            } else {
                 // Clear dropdown if not expanded and not on wall
                 searchResultsContainer.classList.remove('visible');
            }
        });


        searchResultsContainer.addEventListener('mousedown', e => e.preventDefault());

        document.addEventListener('click', event => {
            if (searchWidget && !searchWidget.contains(event.target) && searchWidget.classList.contains('expanded')) {
                searchWidget.classList.remove('expanded');
                searchResultsContainer.classList.remove('visible');
                // Don't clear term or highlights on click away, user might still want them
            }
        });

        pageSearchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && searchWidget.classList.contains('expanded')) {
                e.preventDefault();
                const firstResult = searchResultsContainer.querySelector('.search-result-item');
                if (firstResult && !firstResult.textContent.startsWith('No results')) {
                    firstResult.click();
                } else {
                     searchResultsContainer.classList.remove('visible');
                }
            } else if (e.key === 'Escape' && searchWidget.classList.contains('expanded')) {
                searchToggleBtn.click(); // Close cleanly via toggle
            }
        });
    } else {
        console.warn("Search widget elements not fully found. Search functionality may be limited.");
    }

    // --- Vintage Safe Easter Egg Logic (Moved from inline script in v1) ---
    function setupSafeEasterEgg() {
        const triggerImage = document.getElementById('easter-egg-trigger-image');
        const safeContainer = document.getElementById('secret-safe-container');
        const safeElement = document.getElementById('vintage-safe');
        const safeDoor = document.getElementById('safe-door');
        const dialDisplaySpans = document.querySelectorAll('#dial-display-area .dial-digit');
        const dialNumbers = document.querySelectorAll('#safe-dial .dial-number.enabled'); // Only select enabled ones
        const clearButton = document.getElementById('safe-clear-button');
        const openButton = document.getElementById('safe-open-button');
        const prizeContainer = document.getElementById('safe-prize');
        const safeMessage = document.getElementById('safe-message');
        const closeSafeButton = document.getElementById('close-safe-button');

        // Audio Elements
        const dialTurnSound = document.getElementById('audio-dial-turn');
        const safeCreakSound = document.getElementById('audio-safe-creak');
        const safeUnlockSound = document.getElementById('audio-safe-unlock');
        const safeErrorSound = document.getElementById('audio-safe-error');
        const victorySound = document.getElementById('audio-victory');

        // Check if all required elements exist
        if (!triggerImage || !safeContainer || !safeElement || !safeDoor || dialDisplaySpans.length !== 3 || dialNumbers.length === 0 || !clearButton || !openButton || !prizeContainer || !safeMessage || !closeSafeButton || !dialTurnSound || !safeCreakSound || !safeUnlockSound || !safeErrorSound || !victorySound) {
            console.warn("Not all Easter egg safe elements found. Safe functionality disabled.");
            return; // Don't proceed if elements are missing
        }

        const CLICK_INTERVAL_MAX = 500; // Max time between clicks in a sequence (ms)
        const PAUSE_INTERVAL_MIN = 2000; // Min time for pause between sequences (ms)
        const CORRECT_CODE = "369";
        const MAX_WRONG_ATTEMPTS = 3;

        let clickTimestamps = [];
        let currentStage = 0; // 0: Start, 1: After 3 clicks, 2: During pause 1, 3: After 6 clicks, 4: During pause 2
        let stageStartTime = 0;
        let currentCode = "";
        let wrongAttempts = 0;
        let easterEggActive = false;
        let patternCheckInterval; // To check for pauses

        function resetPatternDetection() {
            clickTimestamps = [];
            currentStage = 0;
            stageStartTime = 0;
            if (patternCheckInterval) clearInterval(patternCheckInterval);
        }

        function triggerHapticFeedback(type = 'light') {
            if ('vibrate' in navigator && navigator.vibrate) {
                try {
                    if (type === 'success') navigator.vibrate(200);
                    else if (type === 'error') navigator.vibrate([100, 50, 100]);
                    else navigator.vibrate(10); // Light tap
                } catch (e) {
                     // Vibration failed (optional logging)
                     // console.warn("Haptic feedback failed:", e);
                }
            }
        }

        function playSound(audioElement) {
            if (audioElement) {
                audioElement.currentTime = 0;
                audioElement.play().catch(e => console.warn("Audio playback failed:", e));
            }
        }

        function activateEasterEgg() {
            if (easterEggActive) return;
            easterEggActive = true;
            resetPatternDetection(); // Stop checking pattern

            triggerImage.classList.add('shake-and-fade');
            playSound(safeCreakSound);
            triggerHapticFeedback('success');

            triggerImage.addEventListener('animationend', () => {
                triggerImage.classList.add('hidden'); // Keep it hidden
                triggerImage.style.pointerEvents = 'none'; // Prevent further clicks
                safeContainer.classList.remove('hidden');
                safeContainer.classList.add('visible');
                safeElement.classList.add('creak-in');
                resetSafeState(); // Prepare the safe UI
            }, { once: true });
        }

        // --- Pattern Checking Logic ---
        function checkPatternState() {
            if (easterEggActive || currentStage % 2 === 0) return; // Only check during click stages

            const now = Date.now();
            const timeSinceStageStart = now - stageStartTime;

            // Check for pause after 3 clicks
            if (currentStage === 1 && timeSinceStageStart >= PAUSE_INTERVAL_MIN) {
                currentStage = 2; // Move to pause stage
                clickTimestamps = []; // Reset clicks for next sequence
                stageStartTime = now; // Reset timer for the pause duration itself (or for next stage)
            }
            // Check for pause after 6 clicks (Stage 3 logic happens in click handler)
            else if (currentStage === 3 && timeSinceStageStart >= PAUSE_INTERVAL_MIN) {
                 currentStage = 4; // Move to second pause stage
                 clickTimestamps = [];
                 stageStartTime = now;
            }
        }

        triggerImage.addEventListener('click', (e) => {
            if (easterEggActive) return;

            // Light-up effect on any click
            triggerImage.classList.add('light-up');
            setTimeout(() => triggerImage.classList.remove('light-up'), 500);

            const now = Date.now();
            const timeSinceLastClick = clickTimestamps.length > 0 ? now - clickTimestamps[clickTimestamps.length - 1] : Infinity;

            // Start interval checker if not already running
            if (!patternCheckInterval) {
                patternCheckInterval = setInterval(checkPatternState, 500);
            }

            switch (currentStage) {
                case 0: // Looking for first 3 clicks
                    if (clickTimestamps.length === 0 || timeSinceLastClick < CLICK_INTERVAL_MAX) {
                        clickTimestamps.push(now);
                        if (clickTimestamps.length === 1) stageStartTime = now; // Start timer on first click
                        if (clickTimestamps.length === 3) {
                            currentStage = 1; // Move to waiting-for-pause stage
                            // stageStartTime is already set
                        }
                    } else {
                        resetPatternDetection(); // Wrong timing, reset
                        clickTimestamps.push(now); // Start new sequence
                        stageStartTime = now;
                    }
                    break;

                case 1: // Waiting for pause after 3 clicks
                    // Any click during this stage resets the pattern
                    resetPatternDetection();
                    clickTimestamps.push(now); // Start new sequence
                    stageStartTime = now;
                    break;

                case 2: // During first pause, looking for 6 clicks
                     if (clickTimestamps.length === 0 || timeSinceLastClick < CLICK_INTERVAL_MAX) {
                        clickTimestamps.push(now);
                        if (clickTimestamps.length === 1 && stageStartTime === 0) stageStartTime = now; // Start timer for this sequence
                        if (clickTimestamps.length === 6) {
                            currentStage = 3; // Move to waiting-for-second-pause stage
                            // stageStartTime is already set for the click sequence
                        }
                    } else {
                        resetPatternDetection();
                        clickTimestamps.push(now);
                        stageStartTime = now;
                    }
                    break;

                case 3: // Waiting for second pause after 6 clicks
                    resetPatternDetection();
                    clickTimestamps.push(now);
                    stageStartTime = now;
                    break;

                 case 4: // During second pause, looking for 9 clicks
                     if (clickTimestamps.length === 0 || timeSinceLastClick < CLICK_INTERVAL_MAX) {
                         clickTimestamps.push(now);
                         if (clickTimestamps.length === 1 && stageStartTime === 0) stageStartTime = now;
                         if (clickTimestamps.length === 9) {
                             activateEasterEgg(); // SUCCESS!
                         }
                     } else {
                         resetPatternDetection();
                         clickTimestamps.push(now);
                         stageStartTime = now;
                     }
                     break;
            }
        });


        // --- Safe UI Logic ---
        function updateDisplaySafe() { // Renamed to avoid conflict
            for (let i = 0; i < 3; i++) {
                // Ensure dialDisplaySpans[i] exists
                if(dialDisplaySpans[i]) {
                    dialDisplaySpans[i].textContent = currentCode[i] || '-';
                }
            }
        }

        function resetSafeState() {
            currentCode = "";
            wrongAttempts = 0;
            updateDisplaySafe();
            safeMessage.textContent = "Enter Code: 3-6-9";
            safeMessage.classList.remove('error', 'success');
            safeDoor.classList.remove('hidden'); // Show door
            prizeContainer.classList.add('hidden'); // Hide prize
            prizeContainer.classList.remove('visible'); // Ensure not visible
            openButton.disabled = false; // Enable open button
            // Re-enable dial buttons that might have been disabled (if applicable)
            dialNumbers.forEach(btn => btn.disabled = false);
        }

        function handleSafeUnlock() {
            playSound(safeUnlockSound);
            playSound(victorySound);
            triggerHapticFeedback('success');
            safeMessage.textContent = "UNLOCKED!";
            safeMessage.classList.add('success');
            safeDoor.classList.add('hidden'); // Hide door
            prizeContainer.classList.remove('hidden'); // Show prize
            prizeContainer.classList.add('visible'); // Add animation class
            openButton.disabled = true; // Disable buttons
            clearButton.disabled = true;
            dialNumbers.forEach(btn => btn.disabled = true);
        }

        function handleSafeError() {
            wrongAttempts++;
            playSound(safeErrorSound);
            triggerHapticFeedback('error');
            safeMessage.textContent = `WRONG CODE (${wrongAttempts}/${MAX_WRONG_ATTEMPTS})`;
            safeMessage.classList.add('error');
            currentCode = "";
            updateDisplaySafe();

            if (wrongAttempts >= MAX_WRONG_ATTEMPTS) {
                safeMessage.textContent = `LOCKED OUT!`;
                openButton.disabled = true;
                clearButton.disabled = true;
                dialNumbers.forEach(btn => btn.disabled = true);
                // Close the safe automatically after a delay
                setTimeout(closeSafe, 2500);
            } else {
                // Briefly show error, then reset message
                setTimeout(() => {
                    // Check if still locked out before resetting message
                    if (wrongAttempts < MAX_WRONG_ATTEMPTS && !openButton.disabled) {
                        safeMessage.textContent = "Enter Code: 3-6-9";
                        safeMessage.classList.remove('error');
                    }
                }, 1500);
            }
        }

        function closeSafe() {
            safeContainer.classList.remove('visible');
            safeContainer.classList.add('hidden');
            safeElement.classList.remove('creak-in'); // Remove animation class
            easterEggActive = false; // Allow triggering again
            resetPatternDetection(); // Reset click pattern detector
            resetSafeState(); // Reset safe UI
            // Make trigger image visible again
            triggerImage.classList.remove('hidden', 'shake-and-fade');
            triggerImage.style.pointerEvents = 'auto';
            // Ensure buttons are re-enabled if needed
             openButton.disabled = false;
             clearButton.disabled = false;
             dialNumbers.forEach(btn => btn.disabled = false);
        }

        // Add listeners to safe elements
        dialNumbers.forEach(button => {
            button.addEventListener('click', () => {
                if (currentCode.length < 3 && !openButton.disabled) {
                    currentCode += button.dataset.value;
                    updateDisplaySafe();
                    playSound(dialTurnSound);
                    triggerHapticFeedback();
                    // Reset message if it was showing an error/prompt
                    if (safeMessage.classList.contains('error') || safeMessage.textContent !== "Enter Code: 3-6-9") {
                         safeMessage.textContent = "Enter Code: 3-6-9";
                         safeMessage.classList.remove('error', 'success');
                    }
                }
            });
        });

        clearButton.addEventListener('click', () => {
            if (!openButton.disabled) {
                currentCode = "";
                updateDisplaySafe();
                playSound(dialTurnSound); // Use dial sound for clear? Or a different one?
                triggerHapticFeedback();
                safeMessage.textContent = "Enter Code: 3-6-9";
                safeMessage.classList.remove('error', 'success');
            }
        });

        openButton.addEventListener('click', () => {
            if (currentCode === CORRECT_CODE) {
                handleSafeUnlock();
            } else if (currentCode.length === 3) {
                handleSafeError();
            } else {
                // Prompt to enter 3 digits if not enough entered
                safeMessage.textContent = "Enter 3 digits";
                safeMessage.classList.add('error');
                setTimeout(() => {
                    // Only reset if not locked out
                    if (!openButton.disabled) {
                         safeMessage.textContent = "Enter Code: 3-6-9";
                         safeMessage.classList.remove('error');
                    }
                }, 1500);
            }
        });

        closeSafeButton.addEventListener('click', closeSafe); // Listener for the prize close button

    } // --- End setupSafeEasterEgg ---

    // --- Initial Setup ---
    const yearSpan = container.querySelector('#copyright-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // Initialize display based on current URL or default to 'about'
    updateDisplay(null, null, null, false); // false: don't push history on initial load

    // Setup Easter Egg after initial display is ready
    setupSafeEasterEgg();

})(); // End IIFE
