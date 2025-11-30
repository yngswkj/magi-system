import { PERSONAS } from './personas.js';
import { OpenAIClient } from './api.js';

// DOM Elements
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const saveSettingsBtn = document.getElementById('save-settings');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const analyzeBtn = document.getElementById('analyze-btn');
const topicInput = document.getElementById('topic-input');
const randomPersonaBtn = document.getElementById('random-persona-btn');
const finalResultDisplay = document.getElementById('final-result');
const finalResultText = finalResultDisplay.querySelector('.result-text');

// Core Elements
const cores = [
    {
        id: 1,
        element: document.getElementById('core-1'),
        select: document.getElementById('persona-1'),
        display: document.getElementById('core-1').querySelector('.conversation-history'),
        status: document.getElementById('core-1').querySelector('.status-indicator'),
        toggle: document.getElementById('core-1').querySelector('.core-toggle'),
        history: [] // Store conversation history
    },
    {
        id: 2,
        element: document.getElementById('core-2'),
        select: document.getElementById('persona-2'),
        display: document.getElementById('core-2').querySelector('.conversation-history'),
        status: document.getElementById('core-2').querySelector('.status-indicator'),
        toggle: document.getElementById('core-2').querySelector('.core-toggle'),
        history: []
    },
    {
        id: 3,
        element: document.getElementById('core-3'),
        select: document.getElementById('persona-3'),
        display: document.getElementById('core-3').querySelector('.conversation-history'),
        status: document.getElementById('core-3').querySelector('.status-indicator'),
        toggle: document.getElementById('core-3').querySelector('.core-toggle'),
        history: []
    }
];

// State
let apiKey = localStorage.getItem('magi_api_key') || '';
let selectedModel = localStorage.getItem('magi_model') || 'gpt-5.1';
let reasoningEffort = localStorage.getItem('magi_reasoning_effort') || 'none';

// Initialize
function init() {
    // Load Settings
    if (apiKey) apiKeyInput.value = apiKey;
    modelSelect.value = selectedModel;

    const reasoningSelect = document.getElementById('reasoning-effort');
    reasoningSelect.value = reasoningEffort;

    // Toggle reasoning select visibility based on model
    toggleReasoningSelect();
    modelSelect.addEventListener('change', toggleReasoningSelect);

    // Populate Persona Selects
    cores.forEach((core, index) => {
        // Clear existing options first to avoid duplicates if init runs multiple times
        core.select.innerHTML = '';

        PERSONAS.forEach(persona => {
            const option = document.createElement('option');
            option.value = persona.id;
            option.textContent = persona.name;
            core.select.appendChild(option);
        });

        // Set default selections (Scientist, Mother, Woman)
        if (index === 0) core.select.value = 'scientist';
        if (index === 1) core.select.value = 'mother';
        if (index === 2) core.select.value = 'woman';

        // Toggle Event Listener
        core.toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                core.element.classList.remove('disabled');
            } else {
                core.element.classList.add('disabled');
            }
        });
    });

    // Event Listeners
    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSettings();
        });
    } else {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }

    analyzeBtn.addEventListener('click', startAnalysis);

    // Ctrl+Enter to submit
    topicInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            startAnalysis();
        }
    });

    // Randomize Personas
    if (randomPersonaBtn) {
        randomPersonaBtn.addEventListener('click', randomizePersonas);
    }

    // Show settings if no API key
    if (!apiKey) {
        settingsModal.style.display = 'flex';
    }
}

async function randomizePersonas() {
    randomPersonaBtn.disabled = true;

    // 1. Determine target personas (Unique shuffle)
    const activeCores = cores.filter(core => core.toggle.checked);
    if (activeCores.length === 0) {
        randomPersonaBtn.disabled = false;
        return;
    }

    // Shuffle PERSONAS array
    const shuffledPersonas = [...PERSONAS].sort(() => 0.5 - Math.random());

    // Assign unique personas to active cores
    const assignments = activeCores.map((core, index) => {
        // If we have more cores than personas, loop around (though unlikely with 3 cores / 6 personas)
        const targetPersona = shuffledPersonas[index % shuffledPersonas.length];
        return { core, targetPersona };
    });

    // 2. Start Slot Animation for each core
    const animations = assignments.map(({ core, targetPersona }, index) => {
        return runSlotAnimation(core, targetPersona, index * 200); // Stagger start times
    });

    await Promise.all(animations);

    randomPersonaBtn.disabled = false;
}

function runSlotAnimation(core, targetPersona, delay) {
    return new Promise(resolve => {
        const select = core.select;
        const rect = select.getBoundingClientRect();
        const parentRect = select.parentElement.getBoundingClientRect();

        // Create Overlay
        const overlay = document.createElement('div');
        overlay.classList.add('slot-overlay');

        // Position overlay exactly over the select element
        // Since .core-controls is relative, we calculate relative position
        overlay.style.top = (select.offsetTop) + 'px';
        overlay.style.left = (select.offsetLeft) + 'px';
        overlay.style.width = select.offsetWidth + 'px';
        overlay.style.height = select.offsetHeight + 'px';

        // Create Strip
        const strip = document.createElement('div');
        strip.classList.add('slot-strip');

        // Build strip content: [Random Personas] ... [Target Persona]
        // Make it long enough for a good spin
        const spinCount = 20;
        let stripHtml = '';

        for (let i = 0; i < spinCount; i++) {
            const randomP = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
            stripHtml += `<div class="slot-item">${randomP.name}</div>`;
        }
        // Add target at the end
        stripHtml += `<div class="slot-item">${targetPersona.name}</div>`;

        strip.innerHTML = stripHtml;
        overlay.appendChild(strip);
        select.parentElement.appendChild(overlay);

        // Hide original select visibility (but keep layout)
        select.style.visibility = 'hidden';

        // Animate
        // Height of one item should match the select element height
        const itemHeight = select.offsetHeight;
        const totalHeight = (spinCount + 1) * itemHeight;
        const finalPosition = -(spinCount * itemHeight); // Stop at the last item

        // Start animation after delay
        setTimeout(() => {
            // Use CSS transition for smooth spinning
            // Ease-out for "landing" effect
            strip.style.transition = `transform 1.5s cubic-bezier(0.1, 0.9, 0.2, 1)`;
            strip.style.transform = `translateY(${finalPosition}px)`;

            // Cleanup after animation
            setTimeout(() => {
                core.select.value = targetPersona.id;
                select.style.visibility = 'visible';
                overlay.remove();
                resolve();
            }, 1500); // Match transition duration
        }, delay);
    });
}

function toggleReasoningSelect() {
    const reasoningGroup = document.getElementById('reasoning-effort-group');
    if (modelSelect.value === 'gpt-5.1') {
        reasoningGroup.style.display = 'block';
    } else {
        reasoningGroup.style.display = 'none';
    }
}

function saveSettings() {
    apiKey = apiKeyInput.value.trim();
    selectedModel = modelSelect.value;
    reasoningEffort = document.getElementById('reasoning-effort').value;

    if (apiKey) {
        localStorage.setItem('magi_api_key', apiKey);
        localStorage.setItem('magi_model', selectedModel);
        localStorage.setItem('magi_reasoning_effort', reasoningEffort);
        settingsModal.style.display = 'none';
    } else {
        alert('API Keyを入力してください');
    }
}

async function startAnalysis() {
    const topic = topicInput.value.trim();
    if (!topic) {
        alert('議題を入力してください');
        return;
    }

    if (!apiKey) {
        alert('設定からAPI Keyを入力してください');
        settingsModal.style.display = 'flex';
        return;
    }

    // Reset UI for new turn (don't clear history, just status)
    resetStatusUI();

    const client = new OpenAIClient(apiKey, selectedModel, reasoningEffort);

    // Filter active cores
    const activeCores = cores.filter(core => core.toggle.checked);

    if (activeCores.length === 0) {
        alert("少なくとも1つのコアを有効にしてください");
        return;
    }

    const promises = activeCores.map(core => processCore(core, client, topic));

    try {
        const results = await Promise.all(promises);
        determineFinalResult(results);
        topicInput.value = ""; // Clear input after sending
    } catch (error) {
        console.error("Analysis failed:", error);
        alert("エラーが発生しました。APIキーや通信状況を確認してください。");
    }
}

async function processCore(core, client, topic) {
    // Set Loading State
    core.element.classList.add('processing');
    core.status.textContent = "PROCESSING...";

    // Add user message to history
    core.history.push({ role: "user", content: topic });
    appendMessageToDisplay(core, "user", topic);

    const personaId = core.select.value;
    const persona = PERSONAS.find(p => p.id === personaId);

    try {
        const result = await client.analyze(core.history, persona.systemPrompt);

        // Update UI with Result
        core.element.classList.remove('processing');
        core.status.textContent = result.decision; // "承認" or "否定"

        // Add AI response to history
        core.history.push({ role: "assistant", content: JSON.stringify(result) });
        appendMessageToDisplay(core, "ai", result.reason);

        // Apply Color Style
        if (result.decision.includes("承認")) {
            core.element.classList.add('approved');
            core.element.classList.remove('denied');
        } else {
            core.element.classList.add('denied');
            core.element.classList.remove('approved');
        }

        return result.decision;
    } catch (error) {
        core.element.classList.remove('processing');
        core.status.textContent = "ERROR";
        appendMessageToDisplay(core, "ai", "Error: " + error.message);
        return "ERROR";
    }
}

function appendMessageToDisplay(core, role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role);
    msgDiv.textContent = text;
    core.display.appendChild(msgDiv);
    core.display.scrollTop = core.display.scrollHeight;
}

function determineFinalResult(results) {
    const approveCount = results.filter(r => r.includes("承認")).length;
    const denyCount = results.filter(r => r.includes("否定")).length;

    finalResultDisplay.classList.remove('approved', 'denied');

    if (approveCount > denyCount) {
        finalResultText.textContent = "承認 (GRANTED)";
        finalResultDisplay.classList.add('approved');
    } else if (denyCount > approveCount) {
        finalResultText.textContent = "否定 (DENIED)";
        finalResultDisplay.classList.add('denied');
    } else {
        finalResultText.textContent = "審議中 (PENDING)";
    }
}

function resetStatusUI() {
    cores.forEach(core => {
        if (core.toggle.checked) {
            core.element.classList.remove('approved', 'denied', 'processing');
            core.status.textContent = "STANDBY";
        }
    });
    finalResultDisplay.classList.remove('approved', 'denied');
    finalResultText.textContent = "ANALYZING...";
}

// Start
init();
