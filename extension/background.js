// X-Filter Background Service Worker (v3 - Final)

// This is the single source of truth for the backend URL.
// Ensure this matches your active ngrok tunnel.
const BACKEND_URL = 'https://ee88-223-185-26-59.ngrok-free.app/api/filter-tweets';

/**
 * Listens for messages from the content script. This is the entry point.
 * It uses an async function directly inside the listener for cleaner logic.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'filterTweets') {
        console.log('Background: Received filterTweets request with data:', request.data);
        // Asynchronously handle the request and send the response.
        handleFilterRequest(request.data)
            .then(response => {
                console.log('Background: Sending response to content script:', response);
                sendResponse(response);
            })
            .catch(error => {
                // This catch is a fallback, but handleFilterRequest should not reject.
                console.error('Background: Unhandled error in handleFilterRequest chain:', error);
                sendResponse({ success: false, error: 'Unhandled background script error' });
            });

        // Return true to indicate that we will respond asynchronously.
        return true;
    }
});

/**
 * Handles the actual fetch request to the backend.
 * This function is designed to NEVER reject. It always resolves with a standard
 * response object: { success: boolean, data?: any, error?: string }
 *
 * @param {object} data - The data from the content script, e.g., { tweets: [...] }
 * @returns {Promise<object>} A promise that resolves to the standard response object.
 */
async function handleFilterRequest(data) {
    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(data)
        });

        // The backend responded, but it might be an error (e.g., 500).
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Background: Backend returned an error status ${response.status}. Body: ${errorText}`);
            // Return a structured error object.
            return { success: false, error: `Backend returned status ${response.status}` };
        }

        const responseData = await response.json();
        console.log('Background: Successfully fetched and parsed response from backend:', responseData);
        // Return a structured success object.
        return { success: true, data: responseData };

    } catch (error) {
        // This catches network errors (e.g., fetch failed, ngrok down) or JSON parsing errors.
        console.error('Background: A critical network or parsing error occurred:', error);
        // Return a structured error object.
        return { success: false, error: error.message };
    }
}
