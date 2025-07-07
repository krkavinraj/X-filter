// X-Filter Content Script

// --- Configuration ---
const BACKEND_URL = 'https://0d8f-34-47-181-182.ngrok-free.app/api/filter-tweets';
const DEBOUNCE_DELAY = 1000; // ms to wait after last DOM change before filtering
const BATCH_SIZE = 50; // Number of tweets to process per API call

// --- State ---
let filterConfig = {
    enabled: false,
    prompt: 'Is this tweet about startups, entrepreneurship, building tech products, or business growth?'
};
let debounceTimer;
let observer; // Declare observer here to be accessible globally within the script

// --- Core Functions ---

/**
 * Sends batches of tweets to the backend for classification.
 */
async function filterTweets() {
    if (!filterConfig.enabled) return;

    // Find all tweets that haven't been processed yet
    const tweetElements = Array.from(document.querySelectorAll('article [data-testid="tweetText"]:not([data-x-filter-processed="true"])'));

    if (tweetElements.length === 0) return;

    console.log(`X-Filter: Found ${tweetElements.length} new tweets to process.`);
    // Mark tweets as processed immediately to avoid re-processing in the next run
    tweetElements.forEach(el => el.setAttribute('data-x-filter-processed', 'true'));

    const tweetsData = tweetElements.map(el => ({
        element: el,
        text: el.innerText
    }));

    // Process tweets in batches
    for (let i = 0; i < tweetsData.length; i += BATCH_SIZE) {
        const batch = tweetsData.slice(i, i + BATCH_SIZE);
        const batchTexts = batch.map(t => t.text);

        try {
            console.log("X-Filter: Sending message to background script", {
                action: "filterTweets",
                data: {
                    backendUrl: BACKEND_URL,
                    tweets: batchTexts,
                    prompt: filterConfig.prompt
                }
            });
            const response = await chrome.runtime.sendMessage({
                action: "filterTweets",
                data: {
                    backendUrl: BACKEND_URL,
                    tweets: batchTexts,
                    prompt: filterConfig.prompt
                }
            });

            if (!response || !response.success) {
                console.error('X-Filter: Backend request failed via background script.', response?.error || 'No response');
                // Un-mark so they can be retried later
                batch.forEach(t => t.element.removeAttribute('data-x-filter-processed'));
                continue;
            }

            const { results } = response.data;

            if (results && results.length === batch.length) {
                updateDOM(batch, results);
            } else {
                console.error('X-Filter: Mismatch in results length or invalid response from background script.');
                batch.forEach(t => t.element.removeAttribute('data-x-filter-processed'));
            }
        } catch (error) {
            console.error('X-Filter: Error sending message to background script.', error);
            batch.forEach(t => t.element.removeAttribute('data-x-filter-processed'));
        }
    }
}

/**
 * Hides tweets by replacing them with a placeholder panel.
 * @param {Array} batch - The batch of tweet data objects.
 * @param {Array<boolean>} results - The classification results from the backend.
 */
function updateDOM(batch, results) {
    batch.forEach((tweetData, index) => {
        const shouldKeep = results[index];
        if (shouldKeep) return; // Don't do anything to tweets we want to keep.

        const tweetArticle = tweetData.element.closest('article');
        // Check if the tweet is already hidden to avoid processing it again.
        if (tweetArticle && !tweetArticle.dataset.originalContent) {
            // Store the original content in a data attribute for easy restoration.
            tweetArticle.dataset.originalContent = tweetArticle.innerHTML;

            // Create the placeholder element.
            const placeholder = document.createElement('div');
            placeholder.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100px;
                padding: 1rem;
                border-top: 1px solid rgb(47, 51, 54);
                color: rgb(113, 118, 123);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            `;

            placeholder.innerHTML = `
                <div style="font-size: 15px; margin-bottom: 8px; display: flex; align-items: center;">
                    <span style="font-size: 18px; margin-right: 8px;">🙈</span>
                    Hidden by your filter
                </div>
                <button class="show-anyway-btn" style="background: none; border: none; color: rgb(29, 155, 240); font-size: 14px; cursor: pointer; padding: 4px;">
                    Show anyway
                </button>
            `;

            // Replace the tweet's content with our placeholder.
            tweetArticle.innerHTML = '';
            tweetArticle.appendChild(placeholder);

            // Add a listener to the 'Show anyway' button to restore the tweet.
            placeholder.querySelector('.show-anyway-btn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tweetArticle.dataset.originalContent) {
                    tweetArticle.innerHTML = tweetArticle.dataset.originalContent;
                    delete tweetArticle.dataset.originalContent;
                }
            }, { once: true }); // The listener removes itself after being clicked once.
        }
    });
}

/**
 * Restores all tweets that were hidden by the filter.
 */
function showAllTweets() {
    document.querySelectorAll('article[data-original-content]').forEach(tweetArticle => {
        // Restore the tweet from the stored HTML.
        if (tweetArticle.dataset.originalContent) {
            tweetArticle.innerHTML = tweetArticle.dataset.originalContent;
            delete tweetArticle.dataset.originalContent;
        }
    });
}

/**
 * Resets the state of all tweets on the page, restoring hidden ones and
 * removing the 'processed' flag so they can be re-filtered.
 */
function resetAllTweets() {
    // First, restore any tweets that were hidden by replacing their content.
    showAllTweets();

    // Then, remove the processed flag from all tweet text elements.
    document.querySelectorAll('[data-testid="tweetText"][data-x-filter-processed]').forEach(el => {
        el.removeAttribute('data-x-filter-processed');
    });
}

/**
 * Resets the state of all tweets, making them visible and ready for re-processing.
 */
function resetAndRefilter() {
    // Make all tweets visible
    showAllTweets();
    // Remove processed marker from all tweets
    document.querySelectorAll('[data-x-filter-processed="true"]').forEach(el => {
        el.removeAttribute('data-x-filter-processed');
    });
    // Trigger a new filter run
    filterTweets();
}

// --- Observers and Listeners ---

/**
 * Debounces a function to prevent it from being called too frequently.
 */
function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

const debouncedFilter = debounce(filterTweets, DEBOUNCE_DELAY);

function initializeObserver() {
    if (observer) observer.disconnect(); // Disconnect previous observer if exists

    observer = new MutationObserver((mutations) => {
        if (mutations.some(mutation => mutation.addedNodes.length > 0)) {
            debouncedFilter();
        }
    });

    const timeline = document.querySelector('div[data-testid="primaryColumn"]');
    if (timeline) {
        observer.observe(timeline, {
            childList: true,
            subtree: true
        });
        console.log('X-Filter: Mutation observer started.');
        // Run an initial filter pass
        setTimeout(filterTweets, 500);
    } else {
        // Retry if timeline not found yet
        setTimeout(initializeObserver, 1000);
    }
}

// Listen for configuration changes from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateConfig') {
        // Store previous state before updating
        const wasEnabled = filterConfig.enabled;
        const oldPrompt = filterConfig.prompt;

        // Update to the new configuration
        filterConfig = request.config;
        console.log('X-Filter: Config updated', filterConfig);

        // Case 1: The filter is now ON
        if (filterConfig.enabled) {
            // Subcase 1a: It was just turned ON from an OFF state.
            if (!wasEnabled) {
                console.log('X-Filter: Filter enabled. Starting observer.');
                initializeObserver(); // This will also trigger an initial filter run
            }
            // Subcase 1b: The prompt changed while the filter was already ON.
            else if (filterConfig.prompt !== oldPrompt) {
                console.log('X-Filter: Prompt changed. Re-filtering all tweets.');
                resetAllTweets(); // Restore hidden tweets and remove processed flags
                filterTweets();   // Trigger a new filter run immediately
            }
        } 
        // Case 2: The filter is now OFF (but was previously ON)
        else if (wasEnabled) {
            console.log('X-Filter: Filter disabled. Stopping observer and showing all tweets.');
            if (observer) {
                observer.disconnect();
            }
            showAllTweets(); // Restore any tweets that were hidden
        }

        sendResponse({ status: "config updated" });
        return true; // Indicates an async response
    }
});

// Load initial configuration from storage when the script is first injected
chrome.storage.sync.get(['filterEnabled', 'customPrompt'], (result) => {
    filterConfig.enabled = !!result.filterEnabled;
    if (result.customPrompt) {
        filterConfig.prompt = result.customPrompt;
    }
    console.log('X-Filter: Initializing with config:', filterConfig);
    if (filterConfig.enabled) {
        initializeObserver();
    }
});

console.log("X-Filter content script loaded.");
