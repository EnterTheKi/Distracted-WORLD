// Wrap everything in an IIFE (Immediately Invoked Function Expression)
(function() {
    'use strict';

    // --- DOM Element Selection ---
    const container = document.querySelector('.gallery-page-container');
    if (!container) {
        console.error("CRITICAL: Main container '.gallery-page-container' not found.");
        // Optionally display an error message to the user
        document.body.innerHTML = '<p style="color: red; text-align: center; padding: 50px;">Error: Essential site component missing. Cannot load page.</p>';
        return;
    }

    const filterButtons = container.querySelectorAll('.filter-nav .filter-btn');
    const contentSections = {
        home: container.querySelector('#home-content'),
        distracted: container.querySelector('#distracted-content'),
        organized: container.querySelector('#organized-content'),
        blog: container.querySelector('#blog-content'),
        goals: container.querySelector('#goals-content'),
        // Note: Telegram section is nested within goals content
        telegram: container.querySelector('#goals-content .telegram-section'), // Select nested Telegram section
        post: container.querySelector('#full-blog-post-view')
    };
    const yearSpan = container.querySelector('#copyright-year');
    const searchWidget = container.querySelector('#search-widget');
    const searchToggleBtn = container.querySelector('#searchToggle');
    const pageSearchInput = container.querySelector('#pageSearchInput');
    const searchResultsContainer = container.querySelector('#searchResults');

    // Audio Elements (Gracefully handle if missing)
    const audioElements = {
        dialTurn: container.querySelector('#audio-dial-turn'),
        safeCreak: container.querySelector('#audio-safe-creak'),
        safeUnlock: container.querySelector('#audio-safe-unlock'),
        safeError: container.querySelector('#audio-safe-error'),
        victory: container.querySelector('#audio-victory'),
        goalAdd: container.querySelector('#audio-goal-add'),
        goalComplete: container.querySelector('#audio-goal-complete'),
        goalRemove: container.querySelector('#audio-goal-remove'),
        goalExport: container.querySelector('#audio-goal-export'),
        telegramReceive: container.querySelector('#audio-telegram-receive'),
        dimindSuccess: container.querySelector('#audio-dimind-success'),
        dimindFailure: container.querySelector('#audio-dimind-failure'),
    };

    // Check for essential content sections
    const essentialSectionIds = ['home', 'distracted', 'organized', 'blog', 'goals', 'post'];
    let missingSection = false;
    essentialSectionIds.forEach(key => {
        if (!contentSections[key]) {
            console.error(`Essential content section element for '${key}' (#${key}-content or similar) not found.`);
            missingSection = true;
        }
    });
     // Specifically check for the nested Telegram section
     if (!contentSections.telegram) {
        console.error("Essential nested element for 'telegram' (.telegram-section within #goals-content) not found.");
        missingSection = true;
     }
    if (!contentSections.home) {
       console.error("CRITICAL: Home section (#home-content) is missing. Cannot proceed.");
       // Avoid wiping body if container exists but home is missing
       if(container) container.innerHTML = '<p style="color: red; text-align: center; padding: 50px;">Error: Home content could not be loaded.</p>';
       return;
    }
     if (missingSection) {
         console.warn("One or more content sections missing. Some functionality might be impaired.");
     }

    // --- Global Flags and State ---
    let manualGoalsInitialized = false;
    let telegramHelperInitialized = false;
    const activeTypingTimers = new Map();
    let currentHighlightIndex = -1;
    let currentMatches = [];
    let goals = []; // Global goals array for manual tracker
    const MAX_GOALS = 10; // Max goals limit

    // Define common distractions for search trigger
    const commonDistractions = [
        'instagram', 'youtube', 'tiktok', 'facebook', 'twitter', 'social media', 'social',
        'scrolling', 'emails', 'email', 'texting', 'texts', 'notifications', 'procrastination', 'procrastinating',
        'multitasking', 'internet browsing', 'browsing', 'gaming', 'games', 'tv', 'television', 'news', 'daydreaming',
        'worrying', 'stress', 'fatigue', 'tired', 'boredom', 'bored', 'online shopping', 'shopping',
        'checking stats', 'overthinking', 'comparison', 'smartphone addiction', 'disorganization',
        'negative self talk', 'relationship issues', 'financial worries', 'health concerns',
        'analysis paralysis', 'feeling overwhelmed', 'task avoidance', 'social comparison',
        'seeking validation', 'imposter syndrome', 'low energy levels', 'difficulty concentrating',
        'job dissatisfaction', 'interruptions', 'shiny object syndrome', 'lack of sleep', 'poor diet',
        'lack of exercise', 'dehydration', 'caffeine crash', 'information overload',
        'waiting for inspiration', 'fear of judgement', 'resistance to change', 'lack of planning',
        'environment too comfortable', 'unresolved conflict', 'digital clutter', 'boredom with routine',
        'external validation seeking', 'fear of missing out', 'lack of boundaries', 'rumination',
        'substance use impact', 'grief or loss', 'chronic pain', 'seasonal affective disorder'
    ];


    // Determine Initial State from URL
    let initialFilter = 'home';
    let initialPostId = null;
    const path = window.location.pathname;
    const pathSegments = path.split('/').filter(segment => segment);

    if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0];
        let potentialFilter = firstSegment;
        // Map URL slugs to internal filter names
        if (firstSegment === 'dw') potentialFilter = 'distracted';
        else if (firstSegment === 'ow') potentialFilter = 'organized';
        else if (firstSegment === 'home') potentialFilter = 'home'; // Explicitly handle /home
        // 'blog' and 'goals' map directly

        // Check if the potential filter is valid
        if (contentSections[potentialFilter]) {
            initialFilter = potentialFilter;
            // Check for blog post ID: /blog/post-id
            if (initialFilter === 'blog' && pathSegments.length > 1) {
                 const potentialPostId = pathSegments[1];
                 // Verify the corresponding hidden content div exists
                 if (container.querySelector(`#${potentialPostId}-content`)) {
                    initialPostId = potentialPostId;
                    console.log(`Initial state: Blog post ${initialPostId}`);
                 } else {
                    console.warn(`URL indicated post '${potentialPostId}', but content not found. Showing blog list.`);
                    initialFilter = 'blog'; // Fallback to blog list
                 }
            } else {
                console.log(`Initial state: Section ${initialFilter}`);
            }
        } else if (firstSegment !== '') {
             // Handle unknown segments - default to home
             console.warn(`Unknown path segment '${firstSegment}'. Defaulting to home.`);
             initialFilter = 'home';
        }
    } else {
         console.log("Initial state: Root path, defaulting to home.");
         initialFilter = 'home'; // Root path defaults to home
    }

    // Final sanity check on initial filter
    if (!contentSections[initialFilter]) {
         console.warn(`Resolved initial filter '${initialFilter}' is invalid. Forcing 'home'.`);
         initialFilter = 'home'; initialPostId = null;
    }


    // --- Utility Functions ---
    function playSound(audioElement) {
        if (audioElement && audioElement instanceof HTMLAudioElement && audioElement.src) { // Check src exists
            audioElement.currentTime = 0; // Reset playback
            audioElement.play().catch(error => {
                 // Log more specific errors if possible
                if (error.name === 'NotAllowedError') {
                    console.warn(`Audio playback failed: User interaction likely required first. (Sound: ${audioElement.id})`);
                } else {
                    console.warn(`Sound playback failed (${audioElement.id}): ${error.name} - ${error.message}`);
                }
            });
        } else if (audioElement && !audioElement.src) {
             console.warn(`Cannot play sound: Audio element #${audioElement.id} has no valid src.`);
        }
        // Silently ignore if audioElement is null/undefined
    }

    // Typewriter function
    async function typeWriter(element, text, speed = 30) {
        return new Promise(resolve => {
            if (!element) { console.error("Typewriter target element is null"); resolve(); return; }
            // Cancel any existing typewriter effect on this element
            if (activeTypingTimers.has(element)) {
                clearTimeout(activeTypingTimers.get(element));
                activeTypingTimers.delete(element);
            }
            element.textContent = ''; // Clear previous text immediately
            let i = 0;
            let typingTimeoutId;
            function type() {
                if (i < text.length) {
                     element.textContent += text.charAt(i);
                     i++;
                     typingTimeoutId = setTimeout(type, speed);
                     activeTypingTimers.set(element, typingTimeoutId); // Store the timer ID
                } else {
                     activeTypingTimers.delete(element); // Remove timer ID when done
                     resolve(); // Resolve the promise when typing is complete
                }
            }
            // Use requestAnimationFrame for smoother start
            requestAnimationFrame(type);
        });
    }

    // --- Traveler's Telegram Functionality (Nested within Goals) ---
    function setupTelegramHelper(triggerTerm = null) {
        console.log("Setting up Telegram Helper!"); // Add debug log
        
        // Get elements within the #goals-content section
        const telegramSection = contentSections.goals?.querySelector('.telegram-section'); // Use optional chaining
        if (!telegramSection) {
            console.warn("Telegram section (.telegram-section) not found within #goals-content. Skipping setup.");
            return;
        }

        const focusInput = telegramSection.querySelector('#focusInput');
        const getAdviceBtn = telegramSection.querySelector('#getAdviceBtn');
        const responseArea = telegramSection.querySelector('#telegramResponseArea');
        const feedbackEl = telegramSection.querySelector('#feedback');
        const checklistEl = telegramSection.querySelector('#checklist');
        const nextQuestionEl = telegramSection.querySelector('#nextQuestion');

        // Ensure all required elements exist before proceeding
        if (!focusInput) {
            console.error("Focus input (#focusInput) is missing in Telegram section");
            return;
        }
        if (!getAdviceBtn) {
            console.error("Get Advice button (#getAdviceBtn) is missing in Telegram section");
            return;
        }
        if (!responseArea) {
            console.error("Response area (#telegramResponseArea) is missing in Telegram section");
            return;
        }
        if (!feedbackEl) {
            console.error("Feedback element (#feedback) is missing in response area");
            return;
        }
        if (!checklistEl) {
            console.error("Checklist element (#checklist) is missing in response area");
            return;
        }
        if (!nextQuestionEl) {
            console.error("Next question element (#nextQuestion) is missing in response area");
            return;
        }

        // Always ensure the response area is visible in its initialized state
        responseArea.classList.remove('hidden');
        responseArea.classList.add('force-show');
        responseArea.style.display = 'block';
        responseArea.style.opacity = '1';
        responseArea.style.visibility = 'visible';
        
        // Define the response database
        const responseDatabase = {
            // Default response for when no specific match is found
            "default": {
                feedback: "The path to focus begins with awareness. What you've identified is indeed one of life's many distractions. Let me offer some guidance for navigating through it.",
                checklist: [
                    "Acknowledge the distraction without judgment",
                    "Take three deep breaths to center yourself",
                    "Clearly define your next immediate action step",
                    "Set a timer for 25 minutes of focused work",
                    "Reward yourself with a short break afterward"
                ],
                question: "What specific task would benefit most from your complete attention right now?"
            },
            
            // Social Media Related
            "social_media": {
                feedback: "Social media is designed to capture and hold your attention through endless scrolling and notifications. The key is to transform it from a controller to a tool you control.",
                checklist: [
                    "Set specific times for social media use (e.g., 15 minutes, twice daily)",
                    "Move social apps off your home screen or consider a temporary deletion",
                    "Turn off all non-essential notifications",
                    "Use time-blocking apps to limit your access",
                    "Create a physical barrier (place phone in another room during focus time)"
                ],
                question: "What would you accomplish today if social media wasn't an option?"
            },
            "instagram": {
                feedback: "Instagram's carefully curated images and infinite scroll can steal hours of valuable time and mental energy. Visual stimulation is particularly effective at capturing attention.",
                checklist: [
                    "Set a timer before opening the app (stick to 10-15 minutes)",
                    "Unfollow accounts that don't add genuine value to your life",
                    "Turn off all Instagram notifications",
                    "Replace morning Instagram checks with a focused morning ritual",
                    "Consider a weekend Instagram fast to recalibrate your attention"
                ],
                question: "What creative pursuit of your own could you develop with the time spent browsing others' creations?"
            },
            "facebook": {
                feedback: "Facebook combines social pressure, variable rewards, and content algorithms that can make it challenging to disengage. Your time and attention deserve more intentional allocation.",
                checklist: [
                    "Use browser extensions to remove the Facebook news feed",
                    "Audit and reduce your friend list to meaningful connections",
                    "Schedule specific check-in times using a timer",
                    "Disable notifications and email alerts",
                    "Consider accessing only via desktop browser, not mobile app"
                ],
                question: "Which relationships in your life would benefit from direct, personal interaction instead of Facebook engagement?"
            },
            "tiktok": {
                feedback: "TikTok's algorithm and short-form content create one of the most effective dopamine loops in social media, making it particularly challenging for sustained focus.",
                checklist: [
                    "Delete the app during critical focus periods",
                    "Set app limits through your phone settings",
                    "Replace 'quick TikTok breaks' with short walks or stretches",
                    "Use screen time reports to become aware of actual usage",
                    "Create a 'no phone zone' in your workspace"
                ],
                question: "What skill could you develop in the next month if you redirected your TikTok time to deliberate practice?"
            },
            "twitter": {
                feedback: "Twitter's rapid-fire, short content creates a false sense of urgency and importance, while its continuous updates can foster anxiety about missing out on information.",
                checklist: [
                    "Curate your feed ruthlessly - unfollow accounts that don't truly add value",
                    "Use Twitter lists to focus on specific content categories",
                    "Schedule specific times for Twitter, outside of deep work periods",
                    "Turn off retweets for most accounts to reduce noise",
                    "Consider accessing only through browser with added friction"
                ],
                question: "What thoughtful project could you develop with the mental space currently occupied by Twitter's stream of consciousness?"
            },
            "youtube": {
                feedback: "YouTube's algorithm is designed to keep you watching by serving an endless stream of 'recommended' content, making it one of the most engaging yet time-consuming distractions.",
                checklist: [
                    "Use browser extensions that remove recommended videos",
                    "Set a timer before opening YouTube and stick to it",
                    "Create a specific 'learning playlist' rather than browsing",
                    "Watch at 1.5x or 2x speed to reduce time spent",
                    "Schedule YouTube time as a reward after completing focused work"
                ],
                question: "What specific type of content do you find most valuable on YouTube, and how could you limit yourself to just that?"
            },
            "reddit": {
                feedback: "Reddit's endless subreddits and discussions can quickly consume hours of time as you jump from one interesting topic to another, creating a false sense of productivity through information gathering.",
                checklist: [
                    "Use Reddit's 'Custom Feed' feature to limit visible subreddits",
                    "Set specific Reddit time slots with clear start/end times",
                    "Use browser extensions like LeechBlock to limit access",
                    "Turn off notifications and unsubscribe from trigger subreddits",
                    "Ask yourself 'Is this information I need now?' before diving in"
                ],
                question: "Which of your saved Reddit posts or resources have you actually put into practice in your life?"
            },
            "snapchat": {
                feedback: "Snapchat's ephemeral content and streak mechanics create powerful engagement loops that demand constant attention and can fragment focus throughout your day.",
                checklist: [
                    "Turn off all Snapchat notifications",
                    "Let close friends know when you're in focus periods",
                    "Consider breaking streaks intentionally to reduce pressure",
                    "Set a 'Snapchat time' once or twice daily instead of checking constantly",
                    "Keep the app in a folder off your home screen to reduce automatic checking"
                ],
                question: "What real-world moments have you missed while capturing or viewing Snapchat content?"
            },
            "pinterest": {
                feedback: "Pinterest's visual-based discovery can quickly transform from inspiration to endless browsing, with the satisfaction of collection replacing the fulfillment of creation.",
                checklist: [
                    "Set a specific purpose before opening Pinterest",
                    "Time-box your browsing sessions to 15 minutes maximum",
                    "Create focused boards with actionable themes",
                    "Schedule time to actually implement ideas from your pins",
                    "Use the search function directly rather than browsing the feed"
                ],
                question: "Of all the things you've pinned, which single idea could you implement today to add value to your life?"
            },
            "linkedin": {
                feedback: "LinkedIn can transform from a professional networking tool to a time sink through its social media features, creating the illusion of productivity while actually distracting from core work.",
                checklist: [
                    "Define specific networking goals before logging in",
                    "Schedule LinkedIn time for after completing important work",
                    "Disable feed updates and notifications",
                    "Use direct messaging instead of feed scrolling",
                    "Set a timer for 10-15 minutes when browsing"
                ],
                question: "What specific career or business outcome are you seeking from your LinkedIn usage?"
            },
            "discord": {
                feedback: "Discord's continuous chat format and community engagement can create a constant pull on your attention, making it challenging to establish deep focus on other tasks.",
                checklist: [
                    "Use Discord's 'Do Not Disturb' status during focus periods",
                    "Mute non-essential channels and servers",
                    "Schedule specific times to check and engage with communities",
                    "Disable most notifications, especially during work hours",
                    "Be selective about which servers you join and stay in"
                ],
                question: "Which Discord communities genuinely advance your goals versus simply entertaining you?"
            },
            "telegram": {
                feedback: "Telegram's multiple chat groups and channels can lead to constant notifications and a sense of needing to keep up with various conversations, fragmenting attention.",
                checklist: [
                    "Archive less important chats to reduce visible distractions",
                    "Use the 'Silent' notification option for non-urgent groups",
                    "Set specific times to check and respond to messages",
                    "Disable read receipts during focus periods if possible",
                    "Be selective about which groups you join and stay in"
                ],
                question: "Which conversations on Telegram truly require your immediate attention versus those that could wait for designated break times?"
            },
            
            // Phone/Tech Distractions
            "phone": {
                feedback: "Your smartphone combines countless potential distractions in a single device that's always within reach. Creating distance and boundaries is essential for regaining control.",
                checklist: [
                    "Place your phone in another room during focus sessions",
                    "Use 'Do Not Disturb' or 'Focus' modes during work periods",
                    "Rearrange your home screen to contain only essential tools",
                    "Set specific 'phone check' times rather than random checking",
                    "Consider a minimalist 'focus phone' setup with limited apps"
                ],
                question: "What would your ideal relationship with your phone look like that would support rather than hinder your most important work?"
            },
            "notifications": {
                feedback: "Each notification creates a micro-interruption that can derail your focus for far longer than the notification itself. These interruptions have a cumulative negative effect on sustained attention.",
                checklist: [
                    "Audit and disable notifications for all non-essential apps",
                    "Set specific people (e.g., family) as exceptions who can reach you",
                    "Consider enabling notifications only for direct messages, not group chats",
                    "Create notification-free time blocks on your calendar",
                    "Use 'Do Not Disturb' mode consistently during focus periods"
                ],
                question: "Which notification, if disabled right now, would create the greatest immediate improvement in your focus?"
            },
            "email": {
                feedback: "Email creates an artificial sense of urgency and an endless loop of communication that can consume your day. Intentional boundaries are essential for reclaiming your attention.",
                checklist: [
                    "Check email at scheduled times (e.g., 10am, 2pm, 5pm) rather than continuously",
                    "Turn off email notifications on all devices",
                    "Use an email signature that sets response time expectations",
                    "Create templates for common responses to save time",
                    "Practice the 'touch it once' principle - handle emails completely when you open them"
                ],
                question: "What proactive work could you accomplish if you reduced email checking to three times daily?"
            },
            "texting": {
                feedback: "Text messages carry an implied expectation of immediate response, creating ongoing attention splits as you feel compelled to check and respond throughout the day.",
                checklist: [
                    "Set auto-responses during focus periods",
                    "Communicate your availability to frequent contacts",
                    "Turn off message previews on your lock screen",
                    "Batch text responses during scheduled breaks",
                    "Keep your phone out of sight during deep work sessions"
                ],
                question: "Which text conversations truly require immediate responses versus those that could wait for designated communication periods?"
            },
            "tv": {
                feedback: "Television and streaming services are designed to capture extended periods of attention, often leading to passive consumption that exceeds intended viewing time.",
                checklist: [
                    "Set specific viewing times with clear boundaries",
                    "Use a timer or episode limit rather than auto-play",
                    "Remove TVs from bedrooms and work areas",
                    "Consider a streaming service pause during critical project periods",
                    "Be intentional about what you watch - select specific content rather than browsing"
                ],
                question: "How often does your planned 'one episode' turn into several hours of watching, and what triggers that extension?"
            },
            "porn": {
                feedback: "Pornography can quickly become a problematic escape that disrupts focus, reduces motivation for real-world activities, and affects your ability to engage deeply in work and relationships.",
                checklist: [
                    "Install content-filtering tools during work/focus hours",
                    "Identify trigger situations and create alternative response plans",
                    "Practice urge surfing - observing the urge without acting on it",
                    "Find healthier dopamine sources (exercise, social connection, achievements)",
                    "Consider speaking with a therapist if usage feels compulsive"
                ],
                question: "What emotional states or situations typically precede the urge to view pornography, and what alternative responses could address those underlying needs?"
            },
            "scrolling": {
                feedback: "The mindless thumb-flick of infinite scrolling is specifically designed to bypass your conscious decision-making and keep you engaged in a trance-like state of passive consumption.",
                checklist: [
                    "Use apps like Freedom or Cold Turkey to block scroll-heavy sites",
                    "Set a clear intention before unlocking your phone",
                    "Enable grayscale mode on your devices to reduce visual stimulation",
                    "Place a physical reminder (like a sticker) on your phone about your goals",
                    "Track daily screen time and set progressive reduction targets"
                ],
                question: "What deeper need are you attempting to fulfill through scrolling, and what activity might better address that need?"
            },
            "news": {
                feedback: "The 24/7 news cycle is designed to trigger emotional responses and create a false sense of urgency, keeping you coming back for updates while rarely providing actionable information.",
                checklist: [
                    "Limit news checking to specific times (once in morning, once in evening)",
                    "Subscribe to curated weekly news summaries instead of constant updates",
                    "Ask 'Is this actionable information?' before diving deep into a story",
                    "Disable news app notifications and email alerts",
                    "Be selective about sources, prioritizing depth over breaking headlines"
                ],
                question: "How has constantly updated news information actually improved your life decisions versus creating anxiety and distraction?"
            },
            "gaming": {
                feedback: "Video games are expertly crafted to deliver variable rewards and achievement loops that can make them significantly more engaging than real-world tasks and responsibilities.",
                checklist: [
                    "Set a gaming timer or alarm before starting",
                    "Use gaming as a scheduled reward after completing important work",
                    "Remove gaming apps from your phone if they're a frequent distraction",
                    "Try replacing some gaming time with physical activity",
                    "Consider joining gaming communities that emphasize balanced lifestyles"
                ],
                question: "What real-world skills or projects could benefit from the focus and persistence you apply to gaming challenges?"
            },
            "internet": {
                feedback: "Aimless internet browsing often begins with a specific query but quickly transforms into a web of loosely connected tangents, consuming vast amounts of time with little retention or application.",
                checklist: [
                    "Write down your specific purpose before opening a browser",
                    "Use website blockers during focused work periods",
                    "Set a timer when researching to maintain awareness",
                    "Close browser tabs immediately after using them",
                    "Keep a 'to research later' list for interesting but non-essential topics"
                ],
                question: "What percentage of your internet browsing is purposeful versus simply filling time, and how might you increase the former?"
            },
            
            // Mental States
            "anxiety": {
                feedback: "Anxiety pulls attention from the present into worries about the future. It fractures focus and diminishes your capacity for deep engagement with the task at hand.",
                checklist: [
                    "Practice 5 minutes of deep breathing when anxiety arises",
                    "Write down specific worries to externalize them from your mind",
                    "Identify one small, concrete action you can take now",
                    "Focus on what you can control, not what you can't",
                    "Consider a brief mindfulness meditation to center yourself"
                ],
                question: "What is one small step you could take right now that would move you forward despite the anxiety?"
            },
            "overwhelmed": {
                feedback: "Feeling overwhelmed often stems from trying to hold too many tasks in mind simultaneously. Breaking down challenges and creating structure can transform paralysis into progress.",
                checklist: [
                    "Do a complete brain dump of all tasks and concerns on paper",
                    "Identify the single most important task (MIT) to focus on first",
                    "Break that task into smaller, concrete steps",
                    "Set a timer for 25 minutes to work only on the first step",
                    "Schedule when you'll address other items from your list"
                ],
                question: "If you could only accomplish one meaningful thing today, what would have the greatest positive impact?"
            },
            "procrastination": {
                feedback: "Procrastination isn't about laziness—it's often about avoiding negative emotions associated with difficult tasks. The key is making starting easier than not starting.",
                checklist: [
                    "Commit to working for just 5 minutes (the hardest part is starting)",
                    "Break down the task into ridiculously small steps",
                    "Remove friction from your environment (prepare materials in advance)",
                    "Use implementation intentions: 'When X happens, I'll do Y'",
                    "Reward yourself for completed steps, not just the finished project"
                ],
                question: "What's the smallest possible first step you could take on your most important task?"
            },
            "tired": {
                feedback: "Mental and physical fatigue significantly impair cognitive function and willpower. Sometimes the most productive action is strategic rest rather than pushing through.",
                checklist: [
                    "Assess your current energy level honestly on a scale of 1-10",
                    "For tasks requiring focus, consider a 20-minute power nap",
                    "Hydrate and consider a small protein-based snack",
                    "Try a 5-minute movement break to increase circulation",
                    "Reschedule deep work for your natural high-energy periods"
                ],
                question: "Which tasks on your list match your current energy level and could be accomplished now?"
            },
            "bored": {
                feedback: "Boredom can paradoxically lead to both distraction-seeking and creative breakthroughs. The key is distinguishing between empty boredom and fertile boredom that precedes insight.",
                checklist: [
                    "Resist the immediate impulse to seek novel stimulation",
                    "Ask if the boredom is task-related or general restlessness",
                    "For task boredom, find a more challenging approach to the work",
                    "For general restlessness, try a different environment or work position",
                    "Consider if this is a signal to pursue a more meaningful challenge"
                ],
                question: "What aspect of your current work could be reframed to engage your curiosity more deeply?"
            },
            "daydreaming": {
                feedback: "While occasional daydreaming can spark creativity, habitual mind-wandering during important tasks fragments attention and reduces both productivity and comprehension.",
                checklist: [
                    "Note specific daydream triggers or patterns",
                    "Use a physical anchor (like a worry stone) to ground your attention",
                    "Practice 'noting' thoughts – briefly acknowledge then return to task",
                    "Try working in shorter, more intensely focused blocks",
                    "Schedule specific time for creative thinking or reflection"
                ],
                question: "What patterns do you notice in your daydreaming content, and what might that reveal about unfulfilled needs or interests?"
            },
            "overthinking": {
                feedback: "Overthinking creates an analysis paralysis where excessive rumination replaces productive action. The mind becomes caught in loops rather than moving forward.",
                checklist: [
                    "Set a timer for 10 minutes to think, then commit to a decision",
                    "Write down your thoughts to externalize them",
                    "Identify one small action step to test your thinking",
                    "Ask 'Will this matter in one month/year?' to gain perspective",
                    "Practice thought-stopping by saying 'enough' when caught in loops"
                ],
                question: "What's the smallest action you could take to test your thinking rather than remaining in analysis mode?"
            },
            "stress": {
                feedback: "Chronic stress narrows attention to perceived threats while reducing creative thinking and strategic planning. The stress response is helpful for immediate dangers but counterproductive for knowledge work.",
                checklist: [
                    "Take three deep belly breaths to activate your parasympathetic system",
                    "Do a quick body scan to release physical tension",
                    "Distinguish between productive concerns and unproductive worry",
                    "Take a brief nature break if possible, even just looking at trees",
                    "Write down three things you can control in this situation"
                ],
                question: "What single action within your control would most reduce your current stress level?"
            },
            
            // Productivity Challenges
            "multitasking": {
                feedback: "What we call 'multitasking' is actually rapid task-switching, which depletes mental resources and reduces the quality of all tasks involved. Single-tasking is the path to both efficiency and excellence.",
                checklist: [
                    "Choose ONE task to focus on completely for the next 30 minutes",
                    "Close all unrelated tabs, documents, and applications",
                    "Put your phone in another room or on 'Do Not Disturb'",
                    "Use noise-canceling headphones or background sound if helpful",
                    "Set a clear stopping point before switching to another task"
                ],
                question: "Which task, if given your complete, undivided attention, would produce the most significant results today?"
            },
            "focus": {
                feedback: "Deep focus is a skill that can be developed with practice. Creating the right conditions—both external and internal—makes achieving flow states more likely and sustainable.",
                checklist: [
                    "Eliminate visual clutter from your workspace",
                    "Block focus sessions on your calendar as non-negotiable appointments",
                    "Use a ritual to signal to your brain it's time for deep work",
                    "Have clear entry and exit criteria for each focus session",
                    "Gradually extend your focus periods from 25 to 50 to 90 minutes"
                ],
                question: "What conditions, when present, have historically helped you achieve your deepest states of flow and concentration?"
            },
            "planning": {
                feedback: "Effective planning reduces decision fatigue and creates momentum. The time invested in planning often returns tenfold in execution efficiency.",
                checklist: [
                    "Schedule 15 minutes every evening to plan the next day",
                    "Identify no more than 3 priority tasks that drive your main goals",
                    "Time-block your calendar for these priority tasks",
                    "Prepare your environment in advance for your first task",
                    "Review and adjust plans weekly to ensure alignment with larger goals"
                ],
                question: "What specific planning ritual could you establish that you'd actually stick with consistently?"
            },
            "perfectionism": {
                feedback: "Perfectionism often masquerades as high standards but actually prevents completion and progress. The pursuit of flawlessness creates paralysis rather than excellence.",
                checklist: [
                    "Set a 'good enough' standard before starting",
                    "Establish a firm deadline for each stage of the work",
                    "Focus on progress over perfection - value iteration",
                    "Schedule specific times for improving versus creating",
                    "Ask 'Who is served by my perfectionism?' when you notice it arising"
                ],
                question: "What project could you complete and share today if you reduced your standard from 'perfect' to 'good enough to be useful'?"
            },
            "disorganization": {
                feedback: "Physical and digital clutter create cognitive load that drains attention resources, making focus more difficult and decisions more taxing.",
                checklist: [
                    "Spend 10 minutes clearing only your immediate workspace",
                    "Close unnecessary browser tabs and applications",
                    "Create a designated 'home' for frequently used items",
                    "Implement a basic file naming/organization system",
                    "Schedule short but regular organizing sessions (15 min daily)"
                ],
                question: "What specific area of disorganization costs you the most time or mental energy each day?"
            },
            "meetings": {
                feedback: "Excessive or poorly run meetings fragment the day, preventing deep work while creating the illusion of productivity through mere participation and discussion.",
                checklist: [
                    "Decline meetings without clear agendas or outcomes",
                    "Request to join only the relevant portion of longer meetings",
                    "Block 'meeting days' versus 'deep work days' when possible",
                    "Suggest agenda items and time limits for meetings you must attend",
                    "Schedule buffer time between meetings for processing and transitions"
                ],
                question: "Which recurring meetings in your calendar could be shortened, eliminated, or converted to asynchronous updates?"
            },
            "workspace": {
                feedback: "Your physical environment significantly impacts your ability to focus. An optimal workspace reduces distractions and cognitive load while supporting your specific work needs.",
                checklist: [
                    "Remove visual distractions from your line of sight",
                    "Ensure proper lighting to reduce eye strain",
                    "Optimize your chair and desk height for comfort",
                    "Keep only task-relevant materials within reach",
                    "Consider using environmental cues (certain music, scent, etc.) as focus triggers"
                ],
                question: "What single change to your physical workspace would most improve your ability to focus on important work?"
            },
            "interruptions": {
                feedback: "Each interruption breaks your cognitive flow and requires significant time to re-engage with deep work. The cost is far greater than just the moments of interruption.",
                checklist: [
                    "Communicate your focus periods to colleagues/family",
                    "Use visual signals (headphones, signs) to indicate focused work time",
                    "Batch similar interruptions for designated 'open door' periods",
                    "Create a quick capture system for incoming requests or ideas",
                    "Find alternative workspaces for your most crucial deep work"
                ],
                question: "What boundaries could you establish that would protect your focus without alienating important people in your life?"
            },
            
            // Specific Goals
            "goals": {
                feedback: "Clear, compelling goals provide both direction and motivation. The right goals balance ambition with achievability and connect to your deeper values.",
                checklist: [
                    "Review your current goals for clarity and specificity",
                    "Break each goal into measurable milestones",
                    "Connect each goal to your deeper 'why'—the value it serves",
                    "Create visible reminders of your goals in your daily environment",
                    "Establish a regular review process to track progress and adjust"
                ],
                question: "Which of your current goals, if achieved, would have the greatest positive ripple effect on your other aspirations?"
            },
            "productivity": {
                feedback: "True productivity isn't about doing more things—it's about doing the right things well. Focus on effectiveness (impact) before efficiency (speed).",
                checklist: [
                    "Identify the 20% of your activities that produce 80% of your results",
                    "Ruthlessly eliminate or delegate low-impact tasks",
                    "Block your most productive hours for your most important work",
                    "Build in recovery periods between intense focus sessions",
                    "Track your results, not just your time or activity"
                ],
                question: "If you could only work 2 hours per day, which activities would absolutely need to happen within those hours?"
            },
            "sleep": {
                feedback: "Sleep is not a luxury but a biological necessity for cognitive function. Poor sleep undermines willpower, decision-making, creativity, and focus the following day.",
                checklist: [
                    "Create a consistent sleep and wake schedule, even on weekends",
                    "Establish a relaxing pre-sleep routine without screens",
                    "Optimize your sleep environment (cool, dark, quiet)",
                    "Avoid caffeine after noon and alcohol close to bedtime",
                    "If sleep problems persist, consider tracking your sleep or consulting a specialist"
                ],
                question: "How does your energy and focus on days after good sleep compare to days after poor sleep, and what does that tell you about sleep's priority in your life?"
            },
            "nutrition": {
                feedback: "What you eat directly impacts your cognitive function. Blood sugar spikes and crashes, dehydration, and nutrient deficiencies can significantly impair focus and mental clarity.",
                checklist: [
                    "Keep water visible and accessible throughout your day",
                    "Plan balanced meals to avoid hunger-based decision making",
                    "Choose complex carbs over simple sugars for sustained energy",
                    "Prepare healthy snacks to avoid vending machine choices",
                    "Notice how different foods affect your energy and focus"
                ],
                question: "Which eating patterns have you noticed give you the most sustained mental energy throughout the day?"
            },
            "exercise": {
                feedback: "Regular physical activity improves focus, learning, and cognitive function while reducing stress and anxiety. Even brief movement breaks can reset attention and boost productivity.",
                checklist: [
                    "Schedule movement as non-negotiable calendar appointments",
                    "Try brief exercise 'snacks' (5-10 minutes) throughout the day",
                    "Find activities you genuinely enjoy rather than forcing yourself",
                    "Use exercise as a transition between different types of work",
                    "Notice and track the mental benefits of different exercise types"
                ],
                question: "What type of movement leaves you feeling most mentally clear and focused afterward?"
            },
            "mindfulness": {
                feedback: "Regular mindfulness practice strengthens your ability to direct and sustain attention, recognize distractions without following them, and return focus to your chosen target.",
                checklist: [
                    "Start with just 5 minutes of mindful breathing daily",
                    "Practice single-tasking everyday activities (eating, walking)",
                    "Use transitions (elevator rides, waiting in line) for micro-mindfulness",
                    "Try guided meditations focused specifically on attention training",
                    "Notice mind-wandering without judgment and gently redirect focus"
                ],
                question: "In what daily activities could you practice being fully present rather than running on autopilot?"
            },
            "burnout": {
                feedback: "Burnout develops when demands consistently exceed resources without adequate recovery. It's characterized by exhaustion, cynicism, and reduced effectiveness.",
                checklist: [
                    "Audit your commitments and identify what can be reduced",
                    "Schedule daily recovery activities, even brief ones",
                    "Set clearer boundaries between work and personal time",
                    "Connect with supportive people who energize you",
                    "Consider whether you need a larger reset (vacation, sabbatical)"
                ],
                question: "What signals is your body or mind sending that you might be ignoring about your current pace and workload?"
            },
            "decision_fatigue": {
                feedback: "Each decision depletes your mental energy, regardless of the decision's importance. Creating systems and defaults preserves willpower for truly important choices.",
                checklist: [
                    "Create personal defaults for recurring decisions",
                    "Batch similar decisions into dedicated time blocks",
                    "Use decision frameworks for medium-importance choices",
                    "Eliminate trivial choices where possible (e.g., meal planning)",
                    "Schedule important decisions for your peak mental energy time"
                ],
                question: "Which recurring decisions could you automate or systematize to free up mental bandwidth for more important matters?"
            },
            "noise": {
                feedback: "Background noise and auditory distractions can significantly impair cognitive performance, especially for complex tasks requiring deep focus and verbal processing.",
                checklist: [
                    "Use noise-canceling headphones during focus sessions",
                    "Try white noise or ambient sound apps to mask disruptive sounds",
                    "Communicate with others about your need for quiet during certain periods",
                    "Consider changing your work location or schedule to avoid peak noise times",
                    "Use earplugs for simple tasks when digital solutions aren't available"
                ],
                question: "What types of background noise affect your concentration most, and which working environments offer your ideal sound level?"
            },
            "relationship_conflict": {
                feedback: "Unresolved relationship tensions consume significant mental bandwidth, as your mind repeatedly revisits conversations and scenarios instead of focusing on present tasks.",
                checklist: [
                    "Schedule a specific time to address the conflict directly",
                    "Write out your thoughts to externalize them from your mind",
                    "Practice compartmentalization for now - 'park' the issue until your designated time",
                    "Consider whether a third-party perspective would be helpful",
                    "Focus on one concrete next step rather than the entire resolution"
                ],
                question: "What single communication could you initiate that might begin to resolve this distraction?"
            },
            "clutter": {
                feedback: "Physical clutter in your environment competes for your attention, reduces working memory capacity, and increases cognitive load even when you're not consciously focused on it.",
                checklist: [
                    "Clear only your immediate workspace - don't tackle everything at once",
                    "Create a 'pending' box for items needing decisions or actions",
                    "Establish a 'one in, one out' policy for new acquisitions",
                    "Set a 10-minute daily decluttering ritual",
                    "Use the 'four-box method': keep, donate, trash, or store"
                ],
                question: "Which specific cluttered area, if cleaned up, would give you the greatest sense of mental spaciousness?"
            },
            "comparison": {
                feedback: "Comparing yourself to others on social media or in real life triggers insecurity and anxiety, pulling focus from your own path and values to external validation metrics.",
                checklist: [
                    "Notice when comparison thinking arises without judging yourself",
                    "Remind yourself you're seeing others' highlights, not their full reality",
                    "Redirect focus to your personal progress, not relative standing",
                    "Limit exposure to trigger environments during vulnerable periods",
                    "Create a 'wins' journal to document your own growth journey"
                ],
                question: "How might your focus and creativity improve if you stopped comparing your chapter 3 to someone else's chapter 20?"
            },
            "financial_worry": {
                feedback: "Money concerns can create a scarcity mindset that tunnels your attention toward short-term financial issues while impairing long-term decision making and creative thinking.",
                checklist: [
                    "Schedule specific 'money time' to address financial matters",
                    "Create a simple action plan for your most pressing financial concern",
                    "Distinguish between productive planning and unproductive worry",
                    "Practice thought-stopping when financial worries arise outside your designated time",
                    "Consider whether you need additional resources or expertise"
                ],
                question: "What single financial action, if taken this week, would most reduce your mental load around money?"
            },
            "future_worry": {
                feedback: "Excessive future-focused thinking pulls your attention from the present moment, creating anxiety about hypothetical scenarios instead of engaging with what's actually before you.",
                checklist: [
                    "Distinguish between productive planning and unproductive worry",
                    "Schedule specific 'worry time' to contain anxious thoughts",
                    "Practice grounding techniques to return to the present (5-4-3-2-1 senses)",
                    "Ask 'Is there any useful action I can take now about this?'",
                    "Write down specific future concerns to externalize them from your mind"
                ],
                question: "What percentage of your past worries actually came true in the way you feared, and what does that tell you about your current concerns?"
            },
            "past_rumination": {
                feedback: "Dwelling on past events, mistakes, or missed opportunities drains energy that could be directed toward present actions and future possibilities.",
                checklist: [
                    "Notice the rumination trigger without judgment",
                    "Ask 'What lesson can I extract from this experience?'",
                    "Practice self-compassion rather than criticism",
                    "Redirect attention to one present action within your control",
                    "Consider journaling to process persistent thoughts"
                ],
                question: "What would become possible if you redirected the energy spent on past events toward your current goals?"
            },
            "hunger": {
                feedback: "Even mild hunger significantly impairs concentration, decision-making, and impulse control as your brain prioritizes finding food over other cognitive tasks.",
                checklist: [
                    "Keep easy, healthy snacks accessible in your workspace",
                    "Schedule regular meal times to avoid blood sugar drops",
                    "Consider front-loading protein and complex carbs earlier in the day",
                    "Notice patterns between eating habits and focus levels",
                    "Stay hydrated - thirst is often mistaken for hunger"
                ],
                question: "Which eating patterns have you noticed give you the most sustained mental energy throughout your workday?"
            },
            "imposter_syndrome": {
                feedback: "Feeling like a fraud despite evidence of your competence consumes mental bandwidth with self-doubt and anxiety, preventing full engagement with challenging work.",
                checklist: [
                    "Collect and review evidence of your capabilities and accomplishments",
                    "Recognize that competent people often feel this way",
                    "Focus on contribution over perfection",
                    "Share your feelings with trusted others - secrecy amplifies shame",
                    "Track your learning and growth rather than comparing to others"
                ],
                question: "What would you attempt if you fully trusted in your ability to learn what you need along the way?"
            },
            "waiting": {
                feedback: "The 'dead time' of waiting—in lines, for appointments, between tasks—often becomes lost time as we fill it with low-value distractions rather than intentional use.",
                checklist: [
                    "Prepare a 'waiting list' of small tasks that can be done in brief periods",
                    "Keep learning materials (articles, podcasts, books) easily accessible",
                    "Practice presence and observation instead of reaching for your phone",
                    "Use waiting time for brief mindfulness practice",
                    "Batch errands to minimize overall waiting time"
                ],
                question: "How might you transform your most common waiting periods into opportunities for learning or renewal?"
            },
            "caffeine": {
                feedback: "While moderate caffeine can enhance focus, excessive or poorly timed consumption can cause anxiety, jitters, sleep disruption, and ultimately decreased cognitive function.",
                checklist: [
                    "Track your caffeine intake and note effects on your focus and sleep",
                    "Establish a caffeine curfew (typically before 2pm)",
                    "Consider cycling down gradually if you suspect dependency",
                    "Hydrate properly alongside caffeinated beverages",
                    "Experiment with reduced amounts and note any withdrawal symptoms"
                ],
                question: "How does your focus and productivity in the hours after caffeine consumption compare to your baseline state?"
            },
            "alcohol": {
                feedback: "Even moderate alcohol consumption can impair sleep quality, morning focus, and cognitive function, creating a cycle of compensating with stimulants like caffeine.",
                checklist: [
                    "Track the correlation between evening drinks and next-day focus",
                    "Establish alcohol-free days, especially before important work",
                    "Set a drink limit before social situations",
                    "Hydrate between alcoholic beverages to reduce impact",
                    "Consider alcohol-free alternatives in social settings"
                ],
                question: "How does your cognitive performance on mornings after drinking compare to mornings after alcohol-free evenings?"
            },
            "meetings": {
                feedback: "Poorly structured meetings fragment your day, preventing deep work blocks while creating an illusion of productivity through mere participation.",
                checklist: [
                    "Question whether your attendance is truly necessary",
                    "Request agendas before accepting invitations",
                    "Suggest time limits for meetings you organize",
                    "Batch meetings into specific days or time blocks",
                    "Propose asynchronous alternatives when appropriate"
                ],
                question: "Which recurring meetings in your schedule could be shortened, eliminated, or converted to email updates without losing value?"
            },
            "digital_entertainment": {
                feedback: "Streaming services, online videos, and digital media are engineered to maximize engagement, often leading to extended consumption well beyond what we initially intended.",
                checklist: [
                    "Set viewing limits before you start watching",
                    "Use a timer rather than relying on willpower",
                    "Disable autoplay features on streaming services",
                    "Schedule specific entertainment time rather than default watching",
                    "Consider a digital entertainment 'fast' during critical work periods"
                ],
                question: "How would your productivity change if you redirected just half of your entertainment time toward your most important goals?"
            },
            "information_overload": {
                feedback: "The constant influx of information—news, articles, podcasts, videos—can create cognitive overwhelm, where collecting more inputs prevents processing and applying what you already know.",
                checklist: [
                    "Establish information consumption boundaries (time limits, trusted sources)",
                    "Practice 'slow media' - fewer, deeper dives versus constant skimming",
                    "Create an 'information inbox' for things to read/watch later",
                    "Schedule specific learning time separate from doing time",
                    "Ask 'How will this information change my actions?' before consuming"
                ],
                question: "What percentage of the information you consume actually translates into meaningful action or decisions in your life?"
            },
            "uncomfortable_environment": {
                feedback: "Physical discomfort—whether from seating, temperature, lighting, or air quality—drains cognitive resources as your brain continuously processes and responds to these stressors.",
                checklist: [
                    "Audit your workspace for specific comfort issues",
                    "Invest in proper ergonomics for your primary work area",
                    "Address temperature issues with appropriate clothing layers",
                    "Optimize lighting to reduce eye strain",
                    "Take regular movement breaks to prevent stiffness and pain"
                ],
                question: "What specific aspect of your physical environment, if improved, would most enhance your ability to maintain focus?"
            },
            "music": {
                feedback: "While music can sometimes enhance focus, it can also become a significant distraction, especially music with lyrics when performing verbal tasks.",
                checklist: [
                    "Experiment with instrumental music vs. lyrics for different tasks",
                    "Create task-specific playlists rather than random shuffle",
                    "Try noise-cancelling headphones with or without music",
                    "Use music as a defined work trigger rather than constant background",
                    "Notice when music becomes the focus rather than the task"
                ],
                question: "Which specific types of music or sounds have historically helped your concentration versus hindering it?"
            },
            "health_concerns": {
                feedback: "Worries about health issues—whether current symptoms or future possibilities—create a background anxiety that distracts from full engagement with work and relationships.",
                checklist: [
                    "Schedule appropriate medical care for legitimate concerns",
                    "Differentiate between productive action and unproductive worry",
                    "Limit health research to specific times with trusted sources",
                    "Practice thought-containment for health worries during focus time",
                    "Consider whether talking with someone would help provide perspective"
                ],
                question: "What concrete step could you take this week to address your health concern or your worry about it?"
            },
            "negative_self_talk": {
                feedback: "The internal critic consumes significant mental bandwidth, undermining confidence and creating secondary emotion (feeling bad about feeling bad) that further distracts from the task at hand.",
                checklist: [
                    "Notice self-critical thoughts without identifying with them",
                    "Ask 'Would I speak this way to someone I care about?'",
                    "Practice self-compassion through gentle internal language",
                    "Focus on specific behaviors rather than global judgments",
                    "Create a physical gesture to interrupt negative thought loops"
                ],
                question: "How might your focus and creativity expand if you approached yourself with the same kindness you'd offer a good friend?"
            },
            "technology_troubleshooting": {
                feedback: "Tech issues—from slow loading to crashes to update interruptions—fragment attention and create frustration that can linger even after the problem is resolved.",
                checklist: [
                    "Schedule regular maintenance outside of key work periods",
                    "Create backup systems for critical workflows",
                    "Set time limits for troubleshooting before seeking help",
                    "Document solutions for recurring issues",
                    "Batch non-urgent updates to convenient times"
                ],
                question: "Which recurring technology issues could be prevented with better systems or possibly upgrading certain tools?"
            }
        };
        
        // --- Response Generation Function ---
        async function generateTelegramResponse(inputText) {
            const input = inputText.trim().toLowerCase();
            
            console.log("Generating telegram response for:", input);
            
            // IMPORTANT: Make sure response area is visible BEFORE any other operations
            responseArea.classList.remove('hidden');
            responseArea.classList.add('force-show');
            responseArea.style.display = 'block';
            responseArea.style.opacity = '1';
            responseArea.style.visibility = 'visible';
            
            console.log("Response area visibility set:", 
                "display:", responseArea.style.display,
                "opacity:", responseArea.style.opacity,
                "visibility:", responseArea.style.visibility,
                "classes:", responseArea.className);
            
            // Clear previous content
            feedbackEl.textContent = '';
            checklistEl.innerHTML = '';
            nextQuestionEl.textContent = '';
            
            // Reset animations
            feedbackEl.style.animation = 'none';
            checklistEl.style.animation = 'none'; 
            checklistEl.querySelectorAll('li').forEach(li => li.style.animation = 'none');
            nextQuestionEl.style.animation = 'none';
            
            // Force reflow to ensure animations can restart
            void responseArea.offsetWidth;
            
            // Empty input handling
            if (!input) {
                // Provide guidance even for empty input
                feedbackEl.textContent = "The Traveler needs guidance. What hinders your focus or objective today?";
                feedbackEl.style.opacity = '1';
                feedbackEl.style.animation = 'fadeIn 0.5s forwards';
                focusInput.focus();
                return;
            }
            
            // Find matching response in database
            let response;
            const keys = Object.keys(responseDatabase).filter(key => key !== 'default');
            
            // Prioritize exact or near-exact matches
            let foundKey = keys.find(key => {
                const regex = new RegExp(`(^|\\W)${key.replace(/_/g, '\\s?')}(\\W|$)`, 'i');
                return regex.test(input);
            });
            
            // Fallback to broader inclusion check
            if (!foundKey) {
                foundKey = keys.find(key => input.includes(key.replace(/_/g, ' ')));
            }
            
            response = responseDatabase[foundKey] || responseDatabase.default;
            
            console.log("Found response:", foundKey || "default");
            
            try {
                playSound(audioElements.telegramReceive);
            } catch(e) {
                console.warn("Could not play sound:", e);
            }
            
            // Apply content immediately so it's visible even if animations fail
            feedbackEl.textContent = response.feedback;
            feedbackEl.style.opacity = '1';
            feedbackEl.style.animation = 'fadeIn 0.5s forwards';
            
            // Add checklist items
            response.checklist.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                li.style.opacity = '1'; // Ensure visible
                checklistEl.appendChild(li);
            });
            
            // Set next question
            nextQuestionEl.textContent = response.question;
            nextQuestionEl.style.opacity = '1';
            
            // Double-check visibility after content is added
            setTimeout(() => {
                console.log("Response area visibility after content:", 
                    "display:", responseArea.style.display,
                    "opacity:", responseArea.style.opacity,
                    "visibility:", responseArea.style.visibility,
                    "classes:", responseArea.className,
                    "offsetHeight:", responseArea.offsetHeight);
                
                // Force visibility again after content is added
                responseArea.classList.remove('hidden');
                responseArea.classList.add('force-show');
                responseArea.style.display = 'block';
                responseArea.style.opacity = '1';
                responseArea.style.visibility = 'visible';
            }, 10);
            
            // Try animations if possible
            try {
                // Apply staged animations for visual appeal
                let itemDelay = 0.6;
                checklistEl.querySelectorAll('li').forEach((li, i) => {
                    li.style.animation = `fadeInUp 0.4s ${itemDelay + i * 0.15}s forwards`;
                });
                
                nextQuestionEl.style.animation = `slideInRight 0.5s 1.5s forwards`;
            } catch(e) {
                console.warn("Animation failed:", e);
                // Content is already visible as set above
            }
            
            // Clear and focus input only if not triggered by search
            if (!triggerTerm && focusInput) {
                focusInput.value = '';
                focusInput.focus();
            }
        }

        // --- Event Listener Setup (run only once per page load) ---
        // Remove previous listeners to prevent doubles
        if (getAdviceBtn._hasClickListener) {
            getAdviceBtn.removeEventListener('click', getAdviceBtn._clickHandler);
        }
        
        // Create a named handler function so we can remove it if needed
        const clickHandler = () => { 
            console.log("Get Advice button clicked!");
            generateTelegramResponse(focusInput.value); 
        };
        
        // Store the handler on the button element itself
        getAdviceBtn._clickHandler = clickHandler;
        getAdviceBtn._hasClickListener = true;
        
        // Add the event listener
        getAdviceBtn.addEventListener('click', clickHandler);
        
        // Add keypress event for Enter key
        if (focusInput._hasKeypressListener) {
            focusInput.removeEventListener('keypress', focusInput._keypressHandler);
        }
        
        const keypressHandler = (e) => { 
            if (e.key === 'Enter' && !focusInput.disabled) { 
                e.preventDefault(); 
                generateTelegramResponse(focusInput.value); 
            } 
        };
        
        focusInput._keypressHandler = keypressHandler;
        focusInput._hasKeypressListener = true;
        
        focusInput.addEventListener('keypress', keypressHandler);
        
        telegramHelperInitialized = true;
        console.log("Telegram helpers and listeners initialized!");

        // --- Handle Trigger Term (e.g., from search) ---
        if (triggerTerm) {
            console.log("Handling trigger term for Telegram:", triggerTerm);
            focusInput.value = `Regarding: ${triggerTerm}`; // Show context in input
            focusInput.disabled = true; // Prevent user editing while showing triggered response
            getAdviceBtn.disabled = true;
            generateTelegramResponse(triggerTerm); // Auto-generate response based on the term
        } else {
            // Normal mode: Enable input
            focusInput.disabled = false;
            getAdviceBtn.disabled = false;
            if (!document.hidden) { // Only focus if the tab is active
                 focusInput.value = ''; // Clear input
                 setTimeout(() => focusInput.focus(), 100); // Focus after potential rendering delay
            }
        }
        console.log("Traveler's Telegram setup/update complete.");
    }


    // --- Manual Goals Functionality ---
    function setupManualGoals() {
        const goalsContent = contentSections.goals; // Parent container
        if (!goalsContent || goalsContent.classList.contains('hidden')) return; // Exit if parent hidden

        // Select elements specifically within #goals-content
        const newGoalInput = goalsContent.querySelector('#newGoalInput');
        const addGoalBtn = goalsContent.querySelector('#addGoalBtn');
        const goalList = goalsContent.querySelector('#goalList');
        const exportGoalsBtn = goalsContent.querySelector('#exportGoalsBtn');
        const summonDiMindBtn = goalsContent.querySelector('#summonDiMindBtn');
        const diMindFeedbackArea = goalsContent.querySelector('#diMindFeedback');
        const diMindMessageEl = goalsContent.querySelector('#diMindMessage');
        const diMindFeedbackImgEl = goalsContent.querySelector('#diMindFeedbackImg');
        const goalErrorMsg = goalsContent.querySelector('#goalError');
        const goalLimitMsg = goalsContent.querySelector('#goalLimit');

        // Check if all necessary goal-specific elements exist
        if (!newGoalInput || !addGoalBtn || !goalList || !exportGoalsBtn || !summonDiMindBtn ||
            !diMindFeedbackArea || !diMindMessageEl || !diMindFeedbackImgEl ||
            !goalErrorMsg || !goalLimitMsg) {
            console.error("One or more Manual Goals elements within #goals-content are missing.");
            manualGoalsInitialized = false; // Ensure it can retry if elements appear later
            return;
        }

        // Prevent re-initialization if already done
        if (manualGoalsInitialized) return;
        console.log("Setting up Manual Goals functionality...");

        // --- Local Storage Functions ---
        function saveGoalsToLocalStorage() {
            try {
                 localStorage.setItem('manualGoals', JSON.stringify(goals));
            } catch (e) {
                 console.error("Failed to save goals to localStorage:", e);
                 // Optionally notify user or handle error
            }
        }
        function loadGoalsFromLocalStorage() {
             try {
                 const saved = localStorage.getItem('manualGoals');
                 goals = saved ? JSON.parse(saved) : [];
             } catch (e) {
                 console.error("Failed to load or parse goals from localStorage:", e);
                 goals = []; // Reset to empty array on error
             }
             renderGoals(); // Render whatever was loaded (or empty array)
        }

        // --- DOM Manipulation Functions ---
        function renderGoals() {
            goalList.innerHTML = ''; // Clear existing list items
            goals.forEach((goal, index) => addGoalToListDOM(goal.text, goal.completed, index));
            checkGoalLimit(); // Update button/input states based on count
        }

        function checkGoalLimit() {
            const limitReached = goals.length >= MAX_GOALS;
            goalLimitMsg.classList.toggle('hidden', !limitReached); // Show message if limit reached
            addGoalBtn.disabled = limitReached;
            newGoalInput.disabled = limitReached;
            if (limitReached) {
                 newGoalInput.placeholder = "Maximum goals reached!";
            } else {
                 newGoalInput.placeholder = "Enter your goal...";
            }
        }

        function addGoalToListDOM(goalText, isCompleted = false, index) {
             const li = document.createElement('li');
             if (isCompleted) li.classList.add('completed');

             const checkbox = document.createElement('input');
             checkbox.type = 'checkbox';
             checkbox.checked = isCompleted;
             checkbox.id = `goal-${index}`;
             checkbox.setAttribute('aria-label', `Mark goal ${index + 1} as ${isCompleted ? 'incomplete' : 'complete'}`); // Dynamic label
             checkbox.addEventListener('change', () => {
                 goals[index].completed = checkbox.checked;
                 li.classList.toggle('completed', checkbox.checked);
                 checkbox.setAttribute('aria-label', `Mark goal ${index + 1} as ${checkbox.checked ? 'incomplete' : 'complete'}`);
                 playSound(audioElements.goalComplete);
                 saveGoalsToLocalStorage();
             });

             const textSpan = document.createElement('label'); // Use label for accessibility
             textSpan.className = 'goal-text';
             textSpan.textContent = goalText.trim();
             textSpan.htmlFor = `goal-${index}`; // Associate label with checkbox

             const removeBtn = document.createElement('button');
             removeBtn.className = 'remove-goal-btn';
             removeBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>'; // FontAwesome icon
             removeBtn.setAttribute('aria-label', `Remove goal: ${goalText}`);
             removeBtn.addEventListener('click', () => {
                 playSound(audioElements.goalRemove);
                 li.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; // Add transition for removal
                 li.style.opacity = '0';
                 li.style.transform = 'translateX(-20px)'; // Slide out effect
                 setTimeout(() => {
                     goals.splice(index, 1); // Remove from array
                     saveGoalsToLocalStorage();
                     renderGoals(); // Re-render the entire list to fix indices
                 }, 300); // Wait for animation
             });

             li.appendChild(checkbox);
             li.appendChild(textSpan);
             li.appendChild(removeBtn);
             goalList.appendChild(li);

             // Animate goal addition
             li.style.opacity = '0';
             li.style.transform = 'translateY(10px)';
             requestAnimationFrame(() => { // Ensure styles are applied before transition starts
                 li.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                 li.style.opacity = '1';
                 li.style.transform = 'translateY(0)';
             });
        }

        function handleAddGoal() {
            const goalText = newGoalInput.value.trim();
            goalErrorMsg.classList.add('hidden'); // Hide errors initially
            goalLimitMsg.classList.add('hidden');

            if (!goalText) {
                goalErrorMsg.classList.remove('hidden'); // Show error if input is empty
                return;
            }
            if (goals.length >= MAX_GOALS) {
                goalLimitMsg.classList.remove('hidden'); // Show error if limit reached
                return;
            }

            goals.push({ text: goalText, completed: false });
            saveGoalsToLocalStorage();
            addGoalToListDOM(goalText, false, goals.length - 1); // Add only the new goal to DOM
            playSound(audioElements.goalAdd);
            newGoalInput.value = ''; // Clear input
            newGoalInput.focus(); // Focus back on input
            checkGoalLimit(); // Re-check limit after adding
        }

        // --- Di-Mind Feedback Function ---
        function checkGoalCompletion() {
             const completedCount = goals.filter(goal => goal.completed).length;
             const totalGoals = goals.length;

             diMindFeedbackArea.classList.remove('hidden', 'success', 'failure', 'neutral');
             diMindFeedbackArea.style.opacity = '0'; // Start transparent for fade-in
             void diMindFeedbackArea.offsetWidth; // Force browser reflow

             if (totalGoals === 0) {
                 diMindMessageEl.textContent = "No goals set, friend! Add some tasks to begin your journey!";
                 diMindFeedbackImgEl.src = 'assets/images/Di-Mind2.gif'; // Assume a default/neutral GIF
                 diMindFeedbackArea.classList.add('neutral');
                 // No sound for neutral state? Or a specific sound?
             } else if (completedCount === totalGoals) {
                 diMindMessageEl.textContent = "Bravo! All goals conquered! You're a star of discipline!";
                 // Optional: Change image source for success state if available
                 // diMindFeedbackImgEl.src = 'assets/images/Di-Mind-Success.gif';
                 diMindFeedbackArea.classList.add('success');
                 playSound(audioElements.dimindSuccess);
             } else {
                 const remaining = totalGoals - completedCount;
                 diMindMessageEl.textContent = `Some tasks remain (${remaining} left), traveler. Rally and complete your ledger!`;
                 // Optional: Change image source for failure/incomplete state if available
                 // diMindFeedbackImgEl.src = 'assets/images/Di-Mind-Failure.gif';
                 diMindFeedbackArea.classList.add('failure');
                 playSound(audioElements.dimindFailure);
             }

             // Fade in the feedback area
             diMindFeedbackArea.style.transition = 'opacity 0.5s ease';
             diMindFeedbackArea.style.opacity = '1';

             // Auto-hide feedback after a delay
             setTimeout(() => {
                 diMindFeedbackArea.style.opacity = '0';
                 // Wait for fade-out transition to complete before hiding with display:none
                 setTimeout(() => {
                     diMindFeedbackArea.classList.add('hidden');
                     // Reset classes for next time
                     diMindFeedbackArea.classList.remove('success', 'failure', 'neutral');
                 }, 500); // Match transition duration
             }, 5000); // Show feedback for 5 seconds
         }

        // --- Export Function ---
        function exportGoalsCSV() {
             if (goals.length === 0) {
                 alert("No goals to export!");
                 return;
             }
             const goalsData = [['Goal', 'Status']]; // Header row
             goals.forEach(goal => {
                 // Escape double quotes within the goal text by doubling them
                 const escapedText = `"${goal.text.replace(/"/g, '""')}"`;
                 goalsData.push([escapedText, goal.completed ? 'Completed' : 'Pending']);
             });

             // Join rows with newline, columns with comma
             const csvContent = goalsData.map(e => e.join(",")).join("\n");
             const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); // Create Blob
             const url = URL.createObjectURL(blob); // Create Object URL

             const link = document.createElement("a");
             link.setAttribute("href", url);
             link.setAttribute("download", "dworld_goals.csv"); // Filename
             link.style.visibility = 'hidden'; // Hide the link
             document.body.appendChild(link);
             link.click(); // Simulate click to trigger download
             document.body.removeChild(link); // Clean up the link
             URL.revokeObjectURL(url); // Release the Object URL

             playSound(audioElements.goalExport);
         }


        // --- Attach Event Listeners ---
        addGoalBtn.addEventListener('click', handleAddGoal);
        newGoalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if inside a form
                handleAddGoal();
            }
        });
        exportGoalsBtn.addEventListener('click', exportGoalsCSV);
        summonDiMindBtn.addEventListener('click', checkGoalCompletion);

        // --- Initial Load ---
        loadGoalsFromLocalStorage(); // Load and render goals on setup
        manualGoalsInitialized = true;
        console.log("Manual Goals functionality setup complete.");

        // --- Also ensure Telegram helper is set up when Goals are shown ---
        // Pass null because this isn't triggered by a search term
        setupTelegramHelper(null);

    } // End setupManualGoals

    // --- Main Display Function (SPA Logic) ---
    function updateDisplay(targetFilter = null, postId = null, triggerData = null, updateHistory = true) {
        console.log(`updateDisplay called with: filter=${targetFilter}, postId=${postId}, trigger=${triggerData}, history=${updateHistory}`);

        let currentFilter = targetFilter;
        let sectionToShowId = null;
        let isBlogPostView = false;
        let targetUrl = null;

        // 1. Determine Target Section and URL
        if (postId && contentSections.post && container.querySelector(`#${postId}-content`)) {
            // Specific Blog Post View
            currentFilter = 'blog'; // Conceptually under blog
            sectionToShowId = 'post';
            isBlogPostView = true;
            targetUrl = `/blog/${postId}`;
        } else if (targetFilter && (contentSections[targetFilter] || targetFilter === 'goals')) { // Allow 'goals' as valid filter
            // Standard Section View (including 'goals')
            sectionToShowId = targetFilter;
            let urlPath = targetFilter;
            if (targetFilter === 'distracted') urlPath = 'dw';
            else if (targetFilter === 'organized') urlPath = 'ow';
            // Use data-url from button if available, otherwise construct path
            targetUrl = container.querySelector(`.filter-btn[data-filter="${targetFilter}"]`)?.getAttribute('data-url') || `/${urlPath}`;
        } else {
            // Fallback Logic (Invalid filter or initial load without path)
            console.warn(`Target filter '${targetFilter}' invalid or missing. Falling back.`);
            currentFilter = initialFilter; // Use state determined on load
            postId = initialPostId;       // Use state determined on load
            isBlogPostView = !!postId;
            sectionToShowId = isBlogPostView ? 'post' : currentFilter;

            // Double-check validity, default to home if still broken
            if (!contentSections[sectionToShowId] && sectionToShowId !== 'goals') {
                console.error(`Fallback filter '${sectionToShowId}' invalid. Defaulting to 'home'.`);
                currentFilter = 'home'; sectionToShowId = 'home'; postId = null; isBlogPostView = false;
            }

            // Determine fallback URL based on final decision
            let urlPath = sectionToShowId;
            if (isBlogPostView && sectionToShowId === 'post') urlPath = `blog/${postId}`;
            else if (sectionToShowId === 'distracted') urlPath = 'dw';
            else if (sectionToShowId === 'organized') urlPath = 'ow';
             // No else if needed for 'blog', 'goals', 'home' as they map directly

            targetUrl = container.querySelector(`.filter-btn[data-filter="${currentFilter}"]`)?.getAttribute('data-url') || `/${urlPath}`;
            // Ensure root path maps to /home for consistency if needed
            if (sectionToShowId === 'home' && (!targetUrl || targetUrl === '/')) targetUrl = '/home';
        }

         // Final CRITICAL check: if target section doesn't exist, stop or show error
        if (!contentSections[sectionToShowId] && sectionToShowId !== 'goals') { // Allow 'goals' check later
            console.error(`CRITICAL: Cannot find element for section '${sectionToShowId}'. Defaulting to 'home'.`);
            currentFilter = 'home'; sectionToShowId = 'home'; postId = null; isBlogPostView = false; targetUrl = '/home';
            if (!contentSections.home) {
                console.error("CRITICAL: Home section not found either. Cannot render content.");
                container.innerHTML = '<p style="color: red; text-align: center; padding: 50px;">Error: Critical site content missing.</p>';
                return; // Stop execution
            }
        }


        // 2. Handle Blog Post Injection
        if (isBlogPostView && contentSections.post) {
            const postContentElement = container.querySelector(`#${postId}-content`);
            if (postContentElement) {
                contentSections.post.innerHTML = ''; // Clear previous post content
                // Add 'Back to Blog' button
                const backButton = document.createElement('button');
                backButton.className = 'back-to-blog-btn';
                backButton.innerHTML = '← Back to Blog List';
                backButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    updateDisplay('blog', null, null, true); // Navigate back to list view
                });
                contentSections.post.appendChild(backButton);
                // Clone and append the actual post content
                const clonedContent = postContentElement.cloneNode(true);
                clonedContent.style.display = 'block'; // Ensure hidden content is visible
                while (clonedContent.firstChild) {
                    contentSections.post.appendChild(clonedContent.firstChild);
                }
            } else {
                // Fallback if post content div is missing
                console.error(`Post content div #${postId}-content not found. Displaying blog list instead.`);
                sectionToShowId = 'blog'; isBlogPostView = false; postId = null; currentFilter = 'blog'; targetUrl = '/blog';
            }
        }

        // 3. Update Navigation Button States
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === currentFilter);
        });

        // 4. Hide All Sections
        Object.keys(contentSections).forEach(key => {
            // Skip hiding 'telegram' as it's nested and controlled by 'goals' visibility
            if (key !== 'telegram' && contentSections[key]) {
                contentSections[key].classList.add('hidden');
            }
        });

        // 5. Show Target Section & Run Setups
        const sectionToShow = contentSections[sectionToShowId];
        if (sectionToShow) {
            sectionToShow.classList.remove('hidden');

            // Blog list grid handling
            if (sectionToShowId === 'blog' && !isBlogPostView) {
                const grid = sectionToShow.querySelector('.blog-grid');
                if (grid) grid.style.display = 'grid';
            } else if (contentSections.blog) { // Hide grid if not on blog list view
                const grid = contentSections.blog.querySelector('.blog-grid');
                if (grid) grid.style.display = 'none';
            }

            // Run setup functions for specific sections AFTER they are visible
            // Use setTimeout 0 to allow browser to render the section first
            if (sectionToShowId === 'goals') {
                 setTimeout(() => {
                     setupManualGoals(); // This includes setupTelegramHelper now
                     // Potentially pass triggerData to setupTelegramHelper if needed here
                     if(triggerData && typeof triggerData === 'string'){
                         setupTelegramHelper(triggerData);
                     }
                 }, 0);
            }
            // Run setup for other potential dynamic features if needed
            // if (typeof setupFullscreenImages === 'function' && ...) { setTimeout(setupFullscreenImages, 0); }

        } else {
            console.error(`Target section element '${sectionToShowId}' not found at final display stage.`);
            // Fallback to home if possible
            if(contentSections.home) {
                contentSections.home.classList.remove('hidden');
                filterButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-filter') === 'home'));
                targetUrl = '/home'; currentFilter = 'home'; postId = null; isBlogPostView = false;
            }
        }

        // 6. Update Browser History (if requested and URL changed)
        if (updateHistory && targetUrl && window.location.pathname !== targetUrl) {
            const state = { filter: currentFilter, postId: isBlogPostView ? postId : null, trigger: triggerData };
            try {
                window.history.pushState(state, '', targetUrl);
                console.log("History pushed:", state, targetUrl);
            } catch (error) {
                console.error("Error updating history state:", error);
                // Fallback to replaceState if push fails? Be cautious.
                 if (window.location.pathname !== targetUrl) {
                      console.warn("Attempting replaceState as fallback.");
                      window.history.replaceState(state, '', targetUrl);
                 }
            }
        }

        // 7. Text Highlighting (if triggered by search)
        // Only highlight if triggerData is a string and we are NOT showing the goals/telegram section
        const highlightTerm = (typeof triggerData === 'string' && sectionToShowId !== 'goals') ? triggerData : null;
        if (highlightTerm) {
             if (typeof highlightTextOnDisplay === 'function') highlightTextOnDisplay(highlightTerm);
        } else {
             if (typeof removeHighlights === 'function') removeHighlights(); // Clear highlights otherwise
        }

        // 8. Reset Search UI (unless navigating TO goals via trigger)
        if (pageSearchInput) pageSearchInput.placeholder = 'Search or Ask...';
        if (!triggerData || sectionToShowId !== 'goals') {
            if (searchResultsContainer) {
                searchResultsContainer.innerHTML = '';
                searchResultsContainer.classList.remove('visible');
            }
            // Optionally close search widget if results are cleared
            // if (searchWidget && searchWidget.classList.contains('expanded')) {
            //     searchWidget.classList.remove('expanded');
            //     if(pageSearchInput) pageSearchInput.value = '';
            // }
        }

        // 9. Scroll Management
         if (!isBlogPostView) {
             window.scrollTo({ top: 0, behavior: 'smooth' });
         } else if (sectionToShow) {
             // Scroll to slightly below header/nav for blog posts
             const headerHeight = container.querySelector('header')?.offsetHeight || 0;
             const navHeight = container.querySelector('.filter-nav')?.offsetHeight || 0;
             const targetScroll = Math.max(0, headerHeight + navHeight - 20); // Avoid negative scroll
             window.scrollTo({ top: targetScroll, behavior: 'smooth' });
         }
         console.log(`updateDisplay completed for filter=${sectionToShowId}`);
    }


    // --- Site Search Function ---
    function executeSiteSearch(term) {
        if (!searchResultsContainer || !pageSearchInput) {
            console.error("Search results container or input missing.");
            return;
        }
        searchResultsContainer.innerHTML = ''; // Clear previous results
        const searchTerm = term.trim().toLowerCase();

        if (!searchTerm || searchTerm.length < 2) {
            searchResultsContainer.classList.remove('visible');
            return; // Don't search for empty or very short terms
        }

        // --- Distraction Keyword Trigger ---
        // Find the most specific keyword match first
        let matchedDistraction = commonDistractions.find(d => d === searchTerm);
        if (!matchedDistraction) {
            // If no exact match, find the first keyword included in the search term
            matchedDistraction = commonDistractions.find(d => searchTerm.includes(d));
        }

        if (matchedDistraction) {
            console.log(`Distraction keyword detected: '${matchedDistraction}'. Navigating to Goals/Telegram.`);
            searchResultsContainer.classList.remove('visible'); // Hide results dropdown
            pageSearchInput.value = ''; // Clear search input
            if (searchWidget) searchWidget.classList.remove('expanded'); // Close search widget
            updateDisplay('goals', null, matchedDistraction, true); // Navigate to goals, passing trigger
            return; // Stop further search execution
        }

        // --- Regular Text Search ---
        console.log(`Executing normal text search for: "${searchTerm}"`);
        const results = [];
        const searchRegex = new RegExp(term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); // Escape special chars

        // Define sections and selectors to search
        const searchableConfig = [
            { filter: 'home', name: 'Home', selectors: ['h1', 'h2', 'h3', 'p:not(.post-meta)', '.preview-section h3', '.preview-section p', '.preview-section.centered-preview p'] },
            { filter: 'distracted', name: 'Distracted World', selectors: ['h1', 'h2', 'p:not(.post-meta)'] },
            { filter: 'organized', name: 'Organized World', selectors: ['h1', 'h2', 'p:not(.post-meta)'] },
            { filter: 'blog', name: 'Blog List', selectors: ['h1', '> h1 + p', '.blog-post-card h3', '.blog-post-card p'], isBlogList: true },
            // Combine Goals & Telegram search as they are in the same content section (#goals-content)
            { filter: 'goals', name: 'Goals & Telegram', selectors: [
                'h1', // Main title
                '> p.section-intro', // Goals intro (use '>' for direct child)
                'h2', // Section titles (Today's Objectives, Traveler's Telegram)
                '.goal-list-vintage li .goal-text', // Dynamic goal text
                '.telegram-section .telegram-intro', // Telegram intro paragraph
                '#staticFocusCard h2', // Static card title
                '#staticFocusCard p', // Static card paragraphs
                '#staticFocusCard li' // Static card list items
            ]}
        ];

        // Helper to add results, avoiding duplicates and providing context
        const addResult = (config, element, textContent) => {
            if (!contentSections[config.filter]) return; // Ensure section exists

            searchRegex.lastIndex = 0; // Reset regex state
            if (searchRegex.test(textContent)) {
                searchRegex.lastIndex = 0; // Reset again for exec
                const match = searchRegex.exec(textContent);
                if (match) {
                    const index = match.index;
                    const start = Math.max(0, index - 35); // Slightly more context before
                    const end = Math.min(textContent.length, index + term.length + 55); // Slightly more context after
                    let snippet = textContent.substring(start, end).trim();
                    if (start > 0) snippet = '…' + snippet; // Use ellipsis
                    if (end < textContent.length) snippet = snippet + '…';
                    // Highlight match within snippet
                    snippet = snippet.replace(searchRegex, match => `<strong>${match}</strong>`);

                    let targetPostId = null;
                    let targetFilter = config.filter;
                    let sectionName = config.name; // Use defined section name
                    let primaryText = ''; // Context identifier

                    // --- Handle specific contexts for better result display ---
                     if (element.closest('#full-blog-post-view')) { // Handle matches within full blog posts (added later)
                         // Logic handled in the hidden post search below
                         return; // Skip adding here, will be added by the dedicated loop
                     }
                     else if (config.isBlogList) {
                        const card = element.closest('.blog-post-card');
                        targetPostId = card?.querySelector('.blog-card-link-wrapper')?.getAttribute('data-post-id');
                        if (!targetPostId) return; // Skip if no post ID found
                        primaryText = card?.querySelector('h3')?.textContent || 'Blog Item';
                        if (element.tagName === 'H3') primaryText = element.textContent; // Use H3 text if it matched
                        sectionName = `Blog: ${primaryText}`; // More specific section name
                        targetFilter = 'blog';
                    } else if (config.filter === 'goals') {
                        // Determine context within the Goals/Telegram section
                        if (element.closest('#goalList')) {
                            primaryText = 'Listed Goal';
                            // Use full goal text for snippet if possible, or truncate if very long
                            snippet = textContent.length > 80 ? textContent.substring(0, 80) + '…' : textContent;
                            snippet = snippet.replace(searchRegex, match => `<strong>${match}</strong>`); // Re-apply highlight
                             sectionName = 'Accountability Ledger'; // Specific name for goals part
                        } else if (element.closest('.telegram-section')) {
                            sectionName = 'Traveler\'s Telegram';
                            if (element.closest('#staticFocusCard')) {
                                primaryText = element.tagName === 'H2' ? 'Focus Card Title' : (element.tagName === 'LI' ? 'Focus Step' : 'Focus Advice');
                            } else if (element.classList.contains('telegram-intro')) {
                                primaryText = 'Telegram Intro';
                            } else if (element.tagName === 'H2') {
                                primaryText = element.textContent; // e.g., "Traveler's Telegram" heading
                            }
                        } else {
                            // General Goals section content (H1, intro P, H2)
                             sectionName = 'Accountability Ledger';
                            if (element.tagName === 'H1') primaryText = element.textContent;
                            else if (element.classList.contains('section-intro')) primaryText = "Goals Intro";
                            else if (element.tagName === 'H2') primaryText = element.textContent; // e.g., "Today's Objectives"
                        }
                    } else if (['H1','H2','H3'].includes(element.tagName)) {
                         // General headings in other sections
                         primaryText = element.textContent.trim();
                    }

                    let displayText = primaryText ? `<em>${primaryText}:</em> ${snippet}` : snippet;
                    // Use a robust key to prevent duplicates
                    const key = `${targetFilter}-${targetPostId || 'none'}-${textContent.substring(0, 50).trim()}`;

                    if (!results.some(r => r.key === key)) {
                        results.push({
                            key: key,
                            section: sectionName,
                            filter: targetFilter,
                            text: displayText,
                            postId: targetPostId,
                            action: () => {
                                if (searchResultsContainer) searchResultsContainer.classList.remove('visible');
                                if (pageSearchInput) pageSearchInput.value = ''; // Clear search on click
                                if (searchWidget) searchWidget.classList.remove('expanded'); // Close widget on click
                                updateDisplay(targetFilter, targetPostId, term, true); // Pass term for potential highlighting
                            }
                        });
                    }
                }
            }
        };

        // Search VISIBLE content sections first
        searchableConfig.forEach(config => {
            const sectionElement = contentSections[config.filter];
            if (!sectionElement || sectionElement.classList.contains('hidden')) return; // Skip hidden sections

            config.selectors.forEach(selector => {
                try {
                    // Query within the specific section's container
                    const searchRoot = (config.filter === 'goals') ? contentSections.goals : sectionElement;
                     if (!searchRoot) return;

                    searchRoot.querySelectorAll(selector).forEach(el => {
                        const text = el.textContent || '';
                        if (text.trim()) {
                            addResult(config, el, text);
                        }
                    });
                } catch (e) {
                    console.error(`Error searching selector "${selector}" in section "${config.filter}":`, e);
                }
            });
        });

        // Search HIDDEN blog post content divs
        const hiddenPosts = container.querySelectorAll('div[id^="post-"][id$="-content"]');
        hiddenPosts.forEach(div => {
             const matchId = div.id.match(/^(post-\d+)-content$/);
             if (matchId) {
                 const postId = matchId[1];
                 const postTitle = div.querySelector('h1')?.textContent || `Post ${postId.split('-')[1]}`;
                 // Search relevant elements within the hidden post div
                 const elements = div.querySelectorAll('h1, h2, h3, p, li'); // Add other tags if needed
                 elements.forEach(el => {
                     // Exclude metadata paragraphs from showing as primary results here
                     if (el.classList.contains('post-meta')) return;

                     const text = el.textContent || '';
                     searchRegex.lastIndex = 0; // Reset regex
                     if (searchRegex.test(text)) {
                         searchRegex.lastIndex = 0; // Reset for exec
                         const match = searchRegex.exec(text);
                         if (match) {
                             const index = match.index;
                             const start = Math.max(0, index - 35);
                             const end = Math.min(text.length, index + term.length + 55);
                             let snippet = text.substring(start, end).trim();
                             if (start > 0) snippet = '…' + snippet;
                             if (end < text.length) snippet = snippet + '…';
                             snippet = snippet.replace(searchRegex, match => `<strong>${match}</strong>`);

                             const sectionId = `Blog: ${postTitle}`;
                             // Use a more specific key combining post ID and snippet start
                             const key = `blog-${postId}-${snippet.substring(0, 30).trim()}`;

                             if (!results.some(r => r.key === key)) {
                                 results.push({
                                     key: key,
                                     section: sectionId, // Section name includes post title
                                     filter: 'blog',
                                     text: snippet,
                                     postId: postId, // Store post ID
                                     action: () => {
                                         if (searchResultsContainer) searchResultsContainer.classList.remove('visible');
                                         if (pageSearchInput) pageSearchInput.value = '';
                                         if (searchWidget) searchWidget.classList.remove('expanded');
                                         updateDisplay('blog', postId, term, true); // Navigate to the specific post
                                     }
                                 });
                             }
                         }
                     }
                 });
             }
        });

        // Display results or "No results" message
        if (results.length > 0) {
             // Optional: Sort results (e.g., by section name)
             // results.sort((a, b) => a.section.localeCompare(b.section));

             const grouped = {};
             results.forEach(r => {
                 if (!grouped[r.section]) grouped[r.section] = [];
                 // Limit results per section to avoid overly long dropdown
                 if (grouped[r.section].length < 5) grouped[r.section].push(r);
             });

             Object.entries(grouped).forEach(([name, group]) => {
                 const header = document.createElement('div');
                 header.className = 'search-result-section';
                 header.textContent = name;
                 searchResultsContainer.appendChild(header);
                 group.forEach(r => {
                     const item = document.createElement('div');
                     item.className = 'search-result-item';
                     item.innerHTML = r.text; // Display the snippet with context/highlighting
                     item.addEventListener('click', r.action); // Click navigates
                     searchResultsContainer.appendChild(item);
                 });
             });
             searchResultsContainer.classList.add('visible');
        } else {
             const none = document.createElement('div');
             none.className = 'search-result-item'; // Use same class for consistent styling
             none.textContent = 'No results found for "' + term.trim() + '"';
             searchResultsContainer.appendChild(none);
             searchResultsContainer.classList.add('visible');
        }
    }


    // --- Text Highlighting Functions ---
    function highlightTextOnDisplay(term) {
         removeHighlights(); // Clear previous highlights first
         if (!term || term.trim().length < 2) return; // Don't highlight short/empty terms

         // Find the currently visible content area
         const searchArea = container.querySelector('.main-content-area .page-content:not(.hidden)');
         if (!searchArea) return; // No visible area to highlight

         const walker = document.createTreeWalker(
             searchArea,
             NodeFilter.SHOW_TEXT, // Only consider text nodes
             { acceptNode: (node) => {
                 // Filter out nodes within scripts, styles, buttons, inputs, labels, etc.
                 const parentTag = node.parentElement?.tagName.toUpperCase();
                 const closestWidget = node.parentElement?.closest('.search-widget-container, .search-results, .safe');
                 // Add more tags/classes to exclude if needed
                 const excludedTags = ['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'LABEL', 'AUDIO'];
                 if (excludedTags.includes(parentTag) || closestWidget || node.parentElement?.classList.contains('search-highlight')) {
                     return NodeFilter.FILTER_REJECT;
                 }
                 // Check if the node or its parent is hidden (though walker might skip some hidden)
                 if (!node.parentElement || node.parentElement.offsetParent === null) {
                    // return NodeFilter.FILTER_REJECT; // Might be too aggressive
                 }
                 // Check for blank/whitespace-only nodes
                 if (!/\S/.test(node.nodeValue)) {
                     return NodeFilter.FILTER_REJECT;
                 }
                 return NodeFilter.FILTER_ACCEPT;
             }},
             false
         );

         const nodesToReplace = [];
         const regex = new RegExp(`(${term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
         currentMatches = []; // Reset global matches array

         let node;
         while(node = walker.nextNode()) {
             const text = node.nodeValue;
             let match;
             let lastIndex = 0;
             const fragment = document.createDocumentFragment();
             let foundMatchInNode = false;

             regex.lastIndex = 0; // Reset regex index for each node
             while ((match = regex.exec(text)) !== null) {
                 foundMatchInNode = true;
                 // Add text before the match
                 if (match.index > lastIndex) {
                     fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                 }
                 // Create the highlight span
                 const span = document.createElement('span');
                 span.className = 'search-highlight';
                 span.textContent = match[0];
                 fragment.appendChild(span);
                 currentMatches.push(span); // Add to global list for potential navigation
                 lastIndex = regex.lastIndex;
             }

             // If matches were found in this node, prepare for replacement
             if (foundMatchInNode) {
                 // Add any remaining text after the last match
                 if (lastIndex < text.length) {
                     fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                 }
                 // Store the original node and the fragment to replace it with
                 nodesToReplace.push({ original: node, replacement: fragment });
             }
         }

         // Perform replacements after iterating (safer than modifying during iteration)
         nodesToReplace.forEach(item => {
             if (item.original.parentNode) {
                 try {
                     item.original.parentNode.replaceChild(item.replacement, item.original);
                 } catch (e) {
                     console.warn("Could not replace text node for highlighting.", e, item.original);
                 }
             }
         });

         currentHighlightIndex = -1; // Reset highlight navigation index
         console.log(`Highlighted ${currentMatches.length} instances of "${term}"`);
    }

    function removeHighlights() {
         // Find all highlight spans
         const highlights = container.querySelectorAll('span.search-highlight, span.search-highlight-current');
         highlights.forEach(span => {
             const parent = span.parentNode;
             if (parent) {
                 // Replace the span with its own text content
                 parent.replaceChild(document.createTextNode(span.textContent), span);
                 // Normalize the parent to merge adjacent text nodes
                 parent.normalize();
             }
         });
         currentMatches = []; // Clear the global list
         currentHighlightIndex = -1;
    }


    // --- Easter Egg Functions ---
    function setupFullscreenImages() { /* Placeholder if needed */ }
    function triggerOrganizedEasterEgg() { /* Placeholder if needed */ }
    function setupSafeEasterEgg() {
         try {
             const trigger = container.querySelector('#easter-egg-trigger-image');
             const safeCont = container.querySelector('#secret-safe-container');
             const safeEl = safeCont?.querySelector('.safe');
             const digits = safeCont?.querySelectorAll('.dial-digit');
             const nums = safeCont?.querySelectorAll('.dial-number');
             const clearBtn = safeCont?.querySelector('#safe-clear');
             const enterBtn = safeCont?.querySelector('#safe-enter');
             const msgEl = safeCont?.querySelector('#safe-message');
             const prizeEl = safeCont?.querySelector('#safe-prize');
             const doorEl = safeCont?.querySelector('.safe-door');
             const closeBtn = safeCont?.querySelector('#safe-close');

             // Check if all elements are present
             if (!trigger || !safeCont || !safeEl || !digits || digits.length < 5 || !nums || !clearBtn || !enterBtn || !msgEl || !prizeEl || !doorEl || !closeBtn) {
                 console.warn("Safe Easter Egg elements missing. Cannot initialize.");
                 return;
             }

             const correctCode = "19305";
             let currentInput = "";
             let isSafeOpen = false;

             function updateSafeDisplay() {
                 digits.forEach((d, i) => { d.textContent = currentInput[i] || '_'; });
                 enterBtn.disabled = currentInput.length !== correctCode.length;
                 nums.forEach(b => {
                     b.classList.toggle('enabled', currentInput.length < correctCode.length && !isSafeOpen);
                     b.disabled = currentInput.length >= correctCode.length || isSafeOpen;
                 });
                 msgEl.textContent = isSafeOpen ? "UNLOCKED!" : (currentInput.length === correctCode.length ? "Ready" : "Enter Code");
                 msgEl.classList.remove('error', 'success');
             }

             function clearInput() {
                 currentInput = "";
                 isSafeOpen = false;
                 doorEl.style.display = 'block'; // Show door
                 prizeEl.classList.add('hidden'); // Hide prize
                 updateSafeDisplay();
                 playSound(audioElements.dialTurn);
             }

             function attemptUnlock() {
                 if (currentInput === correctCode) {
                     msgEl.textContent = "UNLOCKED!";
                     msgEl.classList.add('success');
                     isSafeOpen = true;
                     prizeEl.classList.remove('hidden'); // Show prize
                     doorEl.style.display = 'none'; // Hide door
                     updateSafeDisplay(); // Update button states etc.
                     playSound(audioElements.safeUnlock);
                     setTimeout(() => playSound(audioElements.victory), 300); // Delayed victory sound
                 } else {
                     msgEl.textContent = "WRONG!";
                     msgEl.classList.add('error');
                     safeEl.classList.add('shake-error'); // Shake animation
                     playSound(audioElements.safeError);
                     // Clear after delay
                     setTimeout(() => {
                         safeEl.classList.remove('shake-error');
                         clearInput(); // Clear wrong code
                     }, 600);
                 }
             }

             // Add listeners to number buttons
             nums.forEach(b => {
                 b.addEventListener('click', () => {
                     if (currentInput.length < correctCode.length && !isSafeOpen) {
                         currentInput += b.getAttribute('data-value');
                         playSound(audioElements.dialTurn);
                         updateSafeDisplay();
                     }
                 });
             });

             // Add listeners to control buttons
             clearBtn.addEventListener('click', clearInput);
             enterBtn.addEventListener('click', attemptUnlock);

             // Add listener to trigger image
             trigger.addEventListener('click', () => {
                 clearInput(); // Reset state when opening
                 safeCont.classList.add('visible');
                 safeEl.classList.add('creak-in'); // Entrance animation
                 playSound(audioElements.safeCreak);
                 setTimeout(() => safeEl.classList.remove('creak-in'), 800); // Remove animation class
             });

             // Add listeners for closing the safe
             function closeSafe() {
                 safeCont.classList.remove('visible');
                 clearInput(); // Reset safe state on close
             }
             safeCont.addEventListener('click', (e) => {
                 // Close if clicking on the background overlay, not the safe itself
                 if (e.target === safeCont) {
                     closeSafe();
                 }
             });
             closeBtn.addEventListener('click', closeSafe); // Close button inside prize area

             // Initial setup
             updateSafeDisplay();

         } catch(err) {
             console.error("Error setting up safe easter egg:", err);
         }
     }

    /* =========================================== */
    /* === EVENT LISTENERS & INITIAL SETUP ==== */
    /* =========================================== */

    // --- Main Navigation ---
    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', e => {
                e.preventDefault(); // Prevent default link behavior
                const filter = button.getAttribute('data-filter');
                // Check if the filter corresponds to a valid content section or 'goals'
                if (filter && (contentSections[filter] || filter === 'goals')) {
                    updateDisplay(filter, null, null, true); // Update display and history
                } else {
                    console.warn(`Invalid navigation filter clicked: ${filter}. Defaulting to home.`);
                    updateDisplay('home', null, null, true); // Fallback to home
                }
            });
        });
    } else {
        console.error("No filter buttons found! Navigation will not work.");
    }

    // --- Delegated Click Listener (for dynamic content like blog cards, read more) ---
    container.addEventListener('click', e => {
        const button = e.target.closest('.read-more-btn, .blog-card-link-wrapper, .page-link');

        // Exit if not a relevant button, or if disabled, or inside search/safe UI
        if (!button || button.closest('.search-results') || button.hasAttribute('disabled') || button.closest('.safe')) {
             return;
        }

        const href = button.getAttribute('href');
        const isExternalLink = href && !href.startsWith('#') && !href.startsWith('/') && button.tagName === 'A' && button.getAttribute('target') === '_blank';

        // Prevent default for internal links/buttons, allow for external links
        if (!isExternalLink) {
            e.preventDefault();
        } else {
            // It's an external link (like Anti-Brain Rot), let the browser handle it
            return;
        }

        // Handle internal actions based on attributes
        const filterTarget = button.getAttribute('data-target-filter');
        const postIdTarget = button.getAttribute('data-post-id');

        if (postIdTarget) { // It's a blog post link
            updateDisplay('blog', postIdTarget, null, true);
        } else if (filterTarget && (contentSections[filterTarget] || filterTarget === 'goals')) { // It's a section link
            updateDisplay(filterTarget, null, null, true);
        } else if (href === '#conductor-info-placeholder') { // Placeholder link
            alert('Conductor\'s Club info coming soon!');
        } else if (filterTarget) { // Invalid filter attribute
             console.warn(`Invalid data-target-filter on clicked button: ${filterTarget}`);
             updateDisplay('home', null, null, true); // Fallback
        } else {
             // Log unhandled internal links/buttons if needed
             // console.log(`Unhandled internal button/link click:`, button);
        }
    });

    // --- Browser Back/Forward Navigation ---
    window.addEventListener('popstate', (e) => {
        let targetFilter = 'home'; // Default fallback
        let targetPostId = null;
        let triggerData = null;

        if (e.state && e.state.filter && (contentSections[e.state.filter] || e.state.filter === 'goals')) {
             // Use valid state from history
             targetFilter = e.state.filter;
             targetPostId = e.state.postId || null;
             triggerData = e.state.trigger || null;
             console.log("Popstate: Using state:", e.state);
        } else {
             // No valid state, re-parse the URL like initial load
             console.log("Popstate: No valid state, re-parsing URL:", window.location.pathname);
             const path = window.location.pathname;
             const seg = path.split('/').filter(s => s);
             if (seg.length > 0) {
                 let potential = seg[0];
                 if(potential === 'dw') potential = 'distracted';
                 else if(potential === 'ow') potential = 'organized';
                 else if (potential === 'home') potential = 'home';

                 if(contentSections[potential] || potential === 'goals') {
                     targetFilter = potential;
                     if (targetFilter === 'blog' && seg.length > 1 && container.querySelector(`#${seg[1]}-content`)) {
                         targetPostId = seg[1];
                     }
                 } // else: unknown path segment, keeps targetFilter as 'home' default
             } // else: root path, keeps targetFilter as 'home' default
        }

        // Update display WITHOUT pushing to history again
        console.log(`Popstate final decision: filter=${targetFilter}, postId=${targetPostId}`);
        updateDisplay(targetFilter, targetPostId, triggerData, false);
    });

    // --- Search Widget Interactions ---
    if (searchToggleBtn && pageSearchInput && searchWidget && searchResultsContainer) {
        searchToggleBtn.addEventListener('click', () => {
             searchWidget.classList.toggle('expanded');
             if (searchWidget.classList.contains('expanded')) {
                 pageSearchInput.focus();
             } else {
                 pageSearchInput.value = ''; // Clear input when closing
                 searchResultsContainer.innerHTML = ''; // Clear results
                 searchResultsContainer.classList.remove('visible');
                 removeHighlights(); // Remove any text highlighting
             }
        });

        let searchDebounce;
        pageSearchInput.addEventListener('input', () => {
             clearTimeout(searchDebounce);
             const term = pageSearchInput.value;
             if (term.trim().length > 1) { // Search on 2+ chars
                 searchDebounce = setTimeout(() => {
                     executeSiteSearch(term.trim());
                 }, 350); // Slightly longer debounce
             } else { // Clear results if input is too short or empty
                 searchResultsContainer.innerHTML = '';
                 searchResultsContainer.classList.remove('visible');
                 if (term.length === 0) {
                     removeHighlights(); // Remove highlights only if input is fully cleared
                 }
             }
        });

        // Close search results if clicking outside the widget area
        document.addEventListener('click', (e) => {
             if (!searchWidget.contains(e.target)) {
                 searchResultsContainer.classList.remove('visible');
             }
        });
    } else {
        console.warn("Search widget elements not fully found. Search functionality disabled.");
    }

    // --- Initial Setup ---
    if (yearSpan) { yearSpan.textContent = new Date().getFullYear(); }
    if (typeof setupSafeEasterEgg === 'function') setupSafeEasterEgg();

    // --- Initial Display on Page Load ---
    // Update display based on the initialFilter/initialPostId determined from the URL
    // Do not push history state on initial load (false)
    updateDisplay(initialFilter, initialPostId, null, false);

    console.log(`Distracted World Script Initialized Successfully. Initial View: ${initialFilter}${initialPostId ? ` (Post: ${initialPostId})` : ''}`);

})(); // End IIFE
