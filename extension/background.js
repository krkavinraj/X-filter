// X-Filter Background Script (Service Worker)

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // We expect a message with a 'filterTweets' action
    if (request.action === "filterTweets") {
        // Call the function to handle the API request
        handleFilterRequest(request.data)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => {
                // It's important to send a response to avoid the port being closed prematurely
                sendResponse({ success: false, error: error.message });
            });
        
        // Return true to indicate that the response will be sent asynchronously
        return true; 
    }
});

async function handleFilterRequest(data) {
    const { backendUrl, tweets, prompt } = data;

    try {
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                tweets: tweets,
                prompt: prompt
            })
        });

        if (!response.ok) {
            // Try to get more detailed error info from the response body
            const errorBody = await response.json().catch(() => response.text());
            console.error('X-Filter Background: Backend request failed.', {
                status: response.status,
                statusText: response.statusText,
                body: errorBody
            });
            // Propagate a structured error
            throw new Error(`Backend returned status ${response.status}: ${JSON.stringify(errorBody)}`);
        }

        const results = await response.json();
        return results;

    } catch (error) {
        console.error('X-Filter Background: Error fetching from backend.', error);
        // Re-throw the error to be caught by the caller
        throw error;
    }
}
