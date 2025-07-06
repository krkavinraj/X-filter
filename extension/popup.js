document.addEventListener('DOMContentLoaded', () => {
    const filterToggle = document.getElementById('filterToggle');
    const promptText = document.getElementById('promptText');
    const saveButton = document.getElementById('saveButton');
    const statusMessage = document.getElementById('statusMessage');

    const DEFAULT_PROMPT = 'Is this tweet about startups, entrepreneurship, building tech products, or business growth?';

    // Load saved state from storage
    chrome.storage.sync.get(['filterEnabled', 'customPrompt'], (result) => {
        filterToggle.checked = !!result.filterEnabled;
        promptText.value = result.customPrompt || DEFAULT_PROMPT;
    });

    // Save button handler
    saveButton.addEventListener('click', () => {
        const newPrompt = promptText.value.trim();
        if (!newPrompt) {
            statusMessage.textContent = 'Rule cannot be empty.';
            statusMessage.style.color = 'red';
            return;
        }

        chrome.storage.sync.set({ customPrompt: newPrompt }, () => {
            console.log('X-Filter: New rule saved.');
            statusMessage.textContent = 'Rule saved!';
            statusMessage.style.color = 'green';
            setTimeout(() => statusMessage.textContent = '', 2000);
            notifyContentScript();
        });
    });

    // Toggle switch handler
    filterToggle.addEventListener('change', () => {
        const enabled = filterToggle.checked;
        chrome.storage.sync.set({ filterEnabled: enabled }, () => {
            console.log(`X-Filter is ${enabled ? 'enabled' : 'disabled'}`);
            notifyContentScript();
        });
    });

    // Function to send the current state to the content script
    function notifyContentScript() {
        chrome.storage.sync.get(['filterEnabled', 'customPrompt'], (config) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateConfig",
                        config: {
                            enabled: config.filterEnabled,
                            prompt: config.customPrompt || DEFAULT_PROMPT
                        }
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('X-Filter: Could not connect to the content script. Try reloading the page.');
                        }
                    });
                }
            });
        });
    }
});
