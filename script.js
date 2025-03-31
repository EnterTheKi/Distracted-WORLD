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
        // Select images intended for fullscreen view
        const clickableImages = container.querySelectorAll('.card-image-placeholder img, .blog-image-placeholder img, #full-blog-post-view img.placeholder-image, #about-content img.about-main-image');
        clickableImages.forEach(img => {
            if (!img.dataset.fullscreenListenerAdded) {
                // Check if cursor style already applied by CSS, otherwise apply here
                if (window.getComputedStyle(img).cursor !== 'pointer') {
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

        const originalHTML = element.innerHTML; // Store original to revert
        element.dataset.originalHtml = originalHTML; // Store it on the element

        const text = element.textContent;
        const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedSearchTerm})`, 'gi'); // Capture the match

        // Only proceed if a match is found
        if (!regex.test(text)) return;

        // Replace text nodes, avoid breaking HTML structure
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToReplace = [];
        while(node = walker.nextNode()) {
             if (node.parentNode && !['SCRIPT', 'STYLE'].includes(node.parentNode.tagName)) {
                 const nodeValue = node.nodeValue;
                 if (regex.test(nodeValue)) {
                      nodesToReplace.push({node: node, value: nodeValue});
                 }
             }
        }

        nodesToReplace.forEach(item => {
            const newNodeValue = item.value.replace(regex, '<span class="search-highlight">$1</span>');
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
            element.innerHTML = element.dataset.originalHtml;
            delete element.dataset.originalHtml; // Clean up
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
                const elementsToSearch = currentSection.querySelectorAll('h1, h2, h3, p, .card-details'); // Adjust selectors as needed
                let foundHighlight = false;
                elementsToSearch.forEach(el => {
                    if (el.offsetParent !== null) { // Check if visible
                        highlightTextInElement(el, searchTerm);
                        if (el.querySelector('.search-highlight')) {
                             foundHighlight = true;
                         }
                    }
                });

                 // Add listener to remove highlights on click away ONLY if highlights were added
                 if (foundHighlight) {
                     document.removeEventListener('click', clickAwayListenerForHighlights); // Prevent duplicates
                     document.addEventListener('click', clickAwayListenerForHighlights);
                 }
            }
        }, 100); // Delay to allow DOM update
    }

    // --- Main Display Function (SPA Logic) ---
    function updateDisplay(targetFilter = null, postId = null, searchTermToHighlight = null) {
        let currentFilter = targetFilter;
        let sectionToShowId = null;
        let isBlogPostView = false;

        // Determine which section to show
        if (postId && contentSections.post) {
            // --- Showing a single blog post ---
            currentFilter = 'blog'; // Keep 'blog' button active even when viewing a post
            const postContentElement = document.getElementById(postId + '-content');

            if (postContentElement) {
                contentSections.post.innerHTML = ''; // Clear previous post

                // Clone content - IMPORTANT: Use cloneNode(true) to get all descendants
                const clonedContent = postContentElement.cloneNode(true);

                // Ensure the back button inside the CLONE gets its event listener
                const backButton = clonedContent.querySelector('.back-to-blog-btn');
                if (backButton) {
                    backButton.style.display = 'inline-block'; // Ensure it's visible
                    backButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        updateDisplay('blog'); // Navigate back to the blog list
                    });
                } else {
                    // Optionally add a back button dynamically if not in the template
                     const dynamicBackButton = document.createElement('button');
                     dynamicBackButton.className = 'back-to-blog-btn';
                     dynamicBackButton.innerHTML = '← Back to Blog List';
                     dynamicBackButton.addEventListener('click', (e) => {
                         e.preventDefault();
                         updateDisplay('blog');
                     });
                     contentSections.post.appendChild(dynamicBackButton); // Add to top
                }


                // Append all children from the cloned content
                while (clonedContent.firstChild) {
                     contentSections.post.appendChild(clonedContent.firstChild);
                }

                sectionToShowId = 'post'; // Target the #full-blog-post-view container
                isBlogPostView = true;
                setTimeout(setupFullscreenImages, 50); // Setup images within the loaded post
            } else {
                console.error("Content for post ID '" + postId + "' not found.");
                currentFilter = 'blog'; // Fallback to blog list
                sectionToShowId = 'blog';
            }
        } else if (targetFilter && contentSections[targetFilter]) {
            // --- Showing a main section ---
            sectionToShowId = targetFilter;
        } else {
             // --- Fallback / Initial Load ---
            let foundActive = false;
            filterButtons.forEach(btn => {
                if (btn.classList.contains('active') && !foundActive) {
                    currentFilter = btn.getAttribute('data-filter');
                    if (contentSections[currentFilter]) {
                         sectionToShowId = currentFilter;
                         foundActive = true;
                    }
                }
            });
             if (!foundActive || !sectionToShowId) { // Default to 'about' if no active or invalid
                currentFilter = 'about';
                sectionToShowId = 'about';
             }
        }


        // Update Navigation Button Active State
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === currentFilter);
        });

        // Hide all content sections
        Object.keys(contentSections).forEach(key => {
            if (contentSections[key]) {
                contentSections[key].classList.add('hidden');
                // Ensure display:none via class or direct style
                 contentSections[key].style.display = 'none';
            }
        });

        // Show the target section
        const sectionToShow = contentSections[sectionToShowId];
        if (sectionToShow) {
            sectionToShow.classList.remove('hidden');
            // Use appropriate display type (grid for wall/blog-grid, block for others)
            const displayType = (sectionToShowId === 'wall' || sectionToShowId === 'blog') ? 'grid' : 'block';
            // Handle the containers specifically
            if (sectionToShowId === 'wall') {
                 contentSections.wall.style.display = 'grid';
            } else if (sectionToShowId === 'blog' && !isBlogPostView) {
                 contentSections.blog.style.display = 'block'; // The container is block
                 const blogGrid = contentSections.blog.querySelector('.blog-grid');
                 if(blogGrid) blogGrid.style.display = 'grid'; // The inner grid
            } else {
                 sectionToShow.style.display = 'block';
            }


            // Setup images if showing Wall or About (initial load)
            if (sectionToShowId === 'wall' || sectionToShowId === 'about') {
                setTimeout(setupFullscreenImages, 50);
            }
             // If showing Wall, apply potential search term filter
            if (sectionToShowId === 'wall') {
                 filterCards();
            }
        } else {
            console.error(`Target section '#${sectionToShowId}' not found.`);
             // Show default 'about' section as a fallback
            if(contentSections.about) {
                contentSections.about.classList.remove('hidden');
                contentSections.about.style.display = 'block';
                filterButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-filter') === 'about'));
                setTimeout(setupFullscreenImages, 50);
            }
        }

        // Handle Search Term Highlighting
        if (searchTermToHighlight) {
            highlightTextOnDisplay(searchTermToHighlight);
        } else if (!isBlogPostView) {
             // Clear highlights only when navigating sections normally, not posts
             removeHighlights();
        }

        // Handle Search Bar State (Placeholder text)
        if (pageSearchInput) {
             pageSearchInput.placeholder = (currentFilter === 'wall') ? 'Search Wallpapers...' : 'Search Site...';
        }
         // Close search results dropdown when navigating sections normally
        if (!isBlogPostView && !searchTermToHighlight && searchResultsContainer) {
             searchResultsContainer.innerHTML = '';
             searchResultsContainer.classList.remove('visible');
             // Optionally close the whole search input on navigation
             // if (searchWidget && searchWidget.classList.contains('expanded')) {
             //     searchWidget.classList.remove('expanded');
             //     pageSearchInput.value = '';
             // }
        }


        // Scroll to top for main sections, or partway for posts
        if (!isBlogPostView) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (sectionToShow) { // Check sectionToShow exists
            // Scroll just below header/nav for posts
            const headerHeight = container.querySelector('header')?.offsetHeight || 0;
            const navHeight = container.querySelector('.filter-nav')?.offsetHeight || 0;
             // Calculate offset ensuring it's not negative
            const offset = Math.max(0, headerHeight + navHeight - 20);
            window.scrollTo({ top: offset, behavior: 'smooth' });
        }
    }

    // --- Filter Cards Function (for Wall view search) ---
    function filterCards() {
        // Check necessary elements exist
        if (!pageSearchInput || !contentSections.wall || !cartoonCards.length) return;

        const searchTerm = pageSearchInput.value.toLowerCase().trim();
        removeHighlights(); // Clear previous highlights on Wall view before filtering/highlighting again

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
             }
        });
         // Add clickaway listener *if* highlights were applied and there was a search term
         if (searchTerm !== '' && container.querySelector('.search-highlight')) {
             document.removeEventListener('click', clickAwayListenerForHighlights);
             document.addEventListener('click', clickAwayListenerForHighlights);
         }
    }


    // --- Site Search Function (for Search Widget Dropdown) ---
    function executeSiteSearch(term) {
        if (!searchResultsContainer) return; // Exit if container doesn't exist

        searchResultsContainer.innerHTML = ''; // Clear previous results
        removeHighlights(); // Clear highlights from main page content

        if (!term || term.length < 2) {
            searchResultsContainer.classList.remove('visible');
            return;
        }

        const results = [];
        const searchTerm = term.toLowerCase();
        // Escape regex special chars and create case-insensitive regex
        const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

        // Searchable Areas Configuration
        const searchableConfig = [
            { filter: 'about', name: 'About', selectors: ['#about-content h1', '#about-content h2', '#about-content h3', '#about-content p', '.preview-section p'] },
            { filter: 'distracted', name: 'Distracted World', selectors: ['#distracted-content h1', '#distracted-content h2', '#distracted-content p'] },
            { filter: 'organized', name: 'Organized World', selectors: ['#organized-content h1', '#organized-content h2', '#organized-content p'] },
            { filter: 'blog', name: 'Blog List', selectors: ['#blog-content h1', '#blog-content .blog-post-card h3', '#blog-content .blog-post-card p'], isBlogList: true },
            { filter: 'wall', name: 'Wallpapers', selectors: ['.gallery-grid .cartoon-card'], isWallCard: true }
            // Hidden Blog Posts are searched separately below
        ];

        // Search Main Content Sections
        searchableConfig.forEach(config => {
            if (!contentSections[config.filter]) return; // Skip if section doesn't exist

            config.selectors.forEach(selector => {
                container.querySelectorAll(selector).forEach(el => {
                    let elementText = '';
                    let targetFilter = config.filter;
                    let targetPostId = null;
                    let primaryText = ''; // Text for display, e.g., title

                    if (config.isWallCard) {
                        const title = el.querySelector('h3')?.textContent || '';
                        const desc = el.querySelector('p')?.textContent || '';
                        const tags = el.getAttribute('data-tags') || '';
                        elementText = `${title} ${desc} ${tags}`;
                        primaryText = title || 'Wallpaper';
                    } else if (config.isBlogList) {
                        const blogCard = el.closest('.blog-post-card');
                        targetPostId = blogCard?.querySelector('.blog-card-link-wrapper')?.getAttribute('data-post-id');
                        elementText = el.textContent || '';
                        primaryText = blogCard?.querySelector('h3')?.textContent || 'Blog Item';
                         // Use title as main text for blog list title hits
                         if(el.tagName === 'H3') primaryText = elementText;
                    } else {
                        elementText = el.textContent || '';
                        primaryText = (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') ? elementText : ''; // Use heading as primary text
                    }

                    if (elementText && searchRegex.test(elementText)) {
                         searchRegex.lastIndex = 0; // Reset regex index
                         const match = searchRegex.exec(elementText); // Find the first match
                         if (match) {
                            const index = match.index;
                            const start = Math.max(0, index - 30);
                            const end = Math.min(elementText.length, index + term.length + 50);
                            let snippet = elementText.substring(start, end).trim();
                            if (start > 0) snippet = '...' + snippet;
                            if (end < elementText.length) snippet = snippet + '...';

                            // Highlight the term within the snippet for display
                            snippet = snippet.replace(searchRegex, match => `<strong>${match}</strong>`);

                            // Add context (e.g., heading if primaryText is empty)
                             let displayText = primaryText ? `<em>${primaryText}:</em> ${snippet}` : snippet;

                            // Avoid duplicate results showing the exact same snippet start
                             if (!results.some(r => r.text.substring(0, 40) === displayText.substring(0, 40))) {
                                results.push({
                                    section: config.name,
                                    filter: targetFilter,
                                    text: displayText,
                                    postId: targetPostId,
                                    action: () => updateDisplay(targetPostId ? null : targetFilter, targetPostId, term)
                                });
                            }
                        }
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
                     if (elementText && searchRegex.test(elementText)) {
                         searchRegex.lastIndex = 0; // Reset regex index
                         const match = searchRegex.exec(elementText); // Find the first match
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

                             // Avoid duplicates for the same post with the same snippet start
                             if (!results.some(r => r.postId === postId && r.text.substring(0, 40) === displayText.substring(0, 40))) {
                                results.push({
                                    section: sectionIdentifier,
                                    filter: 'blog', // Keep blog nav active
                                    text: displayText,
                                    postId: postId,
                                    action: () => updateDisplay(null, postId, term) // Navigate to this post
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
                        result.action(); // Navigate and highlight
                         // Close search after selection
                        if (searchWidget) searchWidget.classList.remove('expanded');
                        if (pageSearchInput) pageSearchInput.value = '';
                        searchResultsContainer.classList.remove('visible');
                        // Optional: remove highlights immediately
                        // removeHighlights();
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

    // --- Event Listeners ---

    // Main Navigation Button Clicks
    filterButtons.forEach(button => button.addEventListener('click', e => {
        e.preventDefault();
        updateDisplay(button.getAttribute('data-filter'));
    }));

    // "Read More" Button Clicks (within preview sections, etc.)
    readMoreButtons.forEach(button => button.addEventListener('click', e => {
        e.preventDefault();
        const filterTarget = button.getAttribute('data-target-filter');
        const linkTarget = button.getAttribute('data-post-id'); // Check if it links to a post

        if (filterTarget) {
            updateDisplay(filterTarget);
        } else if (linkTarget) {
            updateDisplay(null, linkTarget); // Should navigate to a blog post
        } else if (button.classList.contains('page-link') && button.getAttribute('href') === '#') {
             // Fallback for page-links without specific targets, maybe default to 'about'?
             // updateDisplay('about');
             console.warn("Read more button clicked with no target:", button);
        }
    }));

    // Blog Card Link Clicks (to view full post)
    blogCardLinks.forEach(link => link.addEventListener('click', e => {
        e.preventDefault();
        const postId = link.getAttribute('data-post-id');
        if (postId) {
            updateDisplay(null, postId);
        }
    }));

    // Search Widget Interactions
    if (searchToggleBtn && pageSearchInput && searchWidget && searchResultsContainer) {
        searchToggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            const isNowExpanded = searchWidget.classList.toggle('expanded');
            if (isNowExpanded) {
                pageSearchInput.focus();
                // Update placeholder based on current view (find active button)
                let activeFilter = container.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'about';
                pageSearchInput.placeholder = (activeFilter === 'wall') ? 'Search Wallpapers...' : 'Search Site...';
            } else {
                 // When closing via toggle button explicitly:
                pageSearchInput.value = '';
                searchResultsContainer.innerHTML = '';
                searchResultsContainer.classList.remove('visible');
                removeHighlights(); // Clear highlights
                // Re-filter Wall view if currently active
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

            // Decide whether to show dropdown search or filter Wall view
            if (searchWidget.classList.contains('expanded')) {
                 // If search input is visibly open, perform dropdown search
                searchTimeout = setTimeout(() => executeSiteSearch(currentTerm), 300);
            } else if (isOnWallView) {
                 // If search input is *not* expanded, but we are on Wall view, filter cards directly
                 filterCards();
                 // No dropdown needed here
                 searchResultsContainer.classList.remove('visible');
            } else {
                 // Input changed but not expanded and not on Wall - do nothing? Or maybe dropdown search?
                 // For now, only trigger dropdown search if expanded
                 searchResultsContainer.classList.remove('visible');
            }
        });


        // Prevent search results click from closing the widget immediately
        searchResultsContainer.addEventListener('mousedown', e => e.preventDefault());

        // Close search widget if clicking outside of it
        document.addEventListener('click', event => {
            if (searchWidget && !searchWidget.contains(event.target) && searchWidget.classList.contains('expanded')) {
                searchWidget.classList.remove('expanded');
                // Keep search term and highlights, just hide dropdown
                // pageSearchInput.value = '';
                searchResultsContainer.classList.remove('visible');
            }
        });

        // Handle Enter key in search input
        pageSearchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && searchWidget.classList.contains('expanded')) {
                e.preventDefault();
                const firstResult = searchResultsContainer.querySelector('.search-result-item');
                if (firstResult && !firstResult.textContent.startsWith('No results')) {
                    firstResult.click(); // Simulate click on the first result
                } else {
                     // No results to click, maybe just close the dropdown
                     searchResultsContainer.classList.remove('visible');
                }
            } else if (e.key === 'Escape' && searchWidget.classList.contains('expanded')) {
                searchToggleBtn.click(); // Close cleanly via toggle
            }
        });
    } else {
        console.warn("Search widget elements not fully found. Search functionality may be limited.");
    }

    // --- Initial Setup ---
    const yearSpan = container.querySelector('#copyright-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // Initial display setup - show 'about' by default
    updateDisplay('about');

})(); // End IIFE
