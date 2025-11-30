import { PERSONAS } from './personas.js';
import { OpenAIClient } from './api.js';

// DOM Elements
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const saveSettingsBtn = document.getElementById('save-settings');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const themeSelect = document.getElementById('theme-select');
const analyzeBtn = document.getElementById('analyze-btn');
const topicInput = document.getElementById('topic-input');
const randomPersonaBtn = document.getElementById('random-persona-btn');
const finalResultDisplay = document.getElementById('final-result');
const finalResultText = finalResultDisplay.querySelector('.result-text');
const discussionOverlay = document.getElementById('discussion-overlay');
const discussionTimeline = document.getElementById('discussion-timeline');
const closeDiscussionBtn = document.getElementById('close-discussion');
const nextPhaseBtn = document.getElementById('next-phase-btn');
const maxLengthInput = document.getElementById('max-length');

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
let selectedTheme = localStorage.getItem('magi_theme') || 'orange';
let maxResponseLength = localStorage.getItem('magi_max_length') || 300;

const THEMES = {
    orange: {
        main: '#ff9900',
        dim: '#663300',
        text: '#ffcc00'
    },
    blue: {
        main: '#0099ff',
        dim: '#003366',
        text: '#66ccff'
    },
    green: {
        main: '#00ff99',
        dim: '#006633',
        text: '#66ffcc'
    },
    purple: {
        main: '#9900ff',
        dim: '#330066',
        text: '#cc66ff'
    },
    red: {
        main: '#ff0033',
        dim: '#660011',
        text: '#ff6666'
    }
};

// Initialize
function init() {
    // Load Settings
    if (apiKey) apiKeyInput.value = apiKey;
    modelSelect.value = selectedModel;
    if (maxLengthInput) maxLengthInput.value = maxResponseLength;

    const reasoningSelect = document.getElementById('reasoning-effort');
    reasoningSelect.value = reasoningEffort;

    if (themeSelect) {
        themeSelect.value = selectedTheme;
        // Preview theme on change
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
    }
    applyTheme(selectedTheme);

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
    settingsBtn.addEventListener('click', () => {
        // Reset form to saved values when opening
        if (themeSelect) themeSelect.value = selectedTheme;
        applyTheme(selectedTheme); // Ensure correct theme is applied
        settingsModal.style.display = 'flex';
    });

    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', () => {
            // Revert to saved theme
            applyTheme(selectedTheme);
            settingsModal.style.display = 'none';
        });
    }

    if (closeDiscussionBtn) {
        closeDiscussionBtn.addEventListener('click', () => {
            // Toggle off discussion mode
            const discussionModeCheckbox = document.getElementById('discussion-mode');
            if (discussionModeCheckbox) {
                discussionModeCheckbox.checked = false;
                // Trigger change event manually
                discussionModeCheckbox.dispatchEvent(new Event('change'));
            }
        });
    }

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

    // Mode Switch Listener
    const discussionModeCheckbox = document.getElementById('discussion-mode');
    if (discussionModeCheckbox) {
        discussionModeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('discussion-active');
            } else {
                document.body.classList.remove('discussion-active');
            }
        });
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
    selectedTheme = themeSelect.value;
    maxResponseLength = maxLengthInput ? maxLengthInput.value.trim() : 300;

    if (apiKey) {
        localStorage.setItem('magi_api_key', apiKey);
        localStorage.setItem('magi_model', selectedModel);
        localStorage.setItem('magi_reasoning_effort', reasoningEffort);
        localStorage.setItem('magi_theme', selectedTheme);
        localStorage.setItem('magi_max_length', maxResponseLength);

        applyTheme(selectedTheme);
        settingsModal.style.display = 'none';
    } else {
        alert('API Keyを入力してください');
    }
}

function applyTheme(themeName) {
    const theme = THEMES[themeName] || THEMES.orange;
    const root = document.documentElement;
    root.style.setProperty('--main-color', theme.main);
    root.style.setProperty('--dim-color', theme.dim);
    root.style.setProperty('--text-color', theme.text);
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

    const isDiscussionMode = document.getElementById('discussion-mode').checked;

    if (isDiscussionMode) {
        await runDiscussionMode(activeCores, client, topic);
    } else {
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
}

function waitForNextPhase() {
    return new Promise(resolve => {
        nextPhaseBtn.style.display = 'block';
        nextPhaseBtn.classList.add('blink-active');

        // Scroll button into view
        nextPhaseBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });

        nextPhaseBtn.onclick = () => {
            nextPhaseBtn.style.display = 'none';
            nextPhaseBtn.classList.remove('blink-active');
            resolve();
        };
    });
}

async function runDiscussionMode(activeCores, client, topic) {
    topicInput.value = ""; // Clear input immediately
    finalResultText.textContent = "DISCUSSION PHASE 1";

    // Show Discussion Overlay (Already visible via CSS, but ensure log is clear)
    discussionTimeline.innerHTML = ''; // Clear previous log
    appendDiscussionLog("SYSTEM", `>>> CONFERENCE MODE INITIATED\n>>> TOPIC: ${topic}`, "system");

    // --- Round 1: Initial Analysis (Parallel) ---
    appendDiscussionLog("SYSTEM", "--- PHASE 1: INITIAL ANALYSIS ---", "phase");

    const round1Results = [];
    const round1Promises = activeCores.map(async (core) => {
        setActiveSpeaker(core, activeCores);
        const result = await processCore(core, client, topic, true); // true = discussion mode (no decision yet)
        round1Results.push({ coreId: core.id, result: result });

        // Log to overlay
        const personaName = core.select.options[core.select.selectedIndex].text;
        appendDiscussionLog(personaName, result.reason, "ai", core.id);

        return result;
    });

    try {
        await Promise.all(round1Promises);
    } catch (error) {
        console.error("Round 1 failed:", error);
        alert("議論フェーズ1でエラーが発生しました。");
        return;
    }

    await waitForNextPhase();

    // --- Round 2: Cross Review (Sequential or Parallel with context) ---
    finalResultText.textContent = "DISCUSSION PHASE 2";
    appendDiscussionLog("SYSTEM", "--- PHASE 2: CROSS REVIEW ---", "phase");

    // Prepare context for each core (what others said)
    const round2Promises = activeCores.map(async (core) => {
        setActiveSpeaker(core, activeCores);

        // Gather other cores' opinions
        const othersOpinions = round1Results
            .filter(r => r.coreId !== core.id)
            .map(r => {
                const personaName = cores.find(c => c.id === r.coreId).select.options[cores.find(c => c.id === r.coreId).select.selectedIndex].text;
                return `[${personaName}]: ${r.result.reason}`; // Assuming result has 'reason'
            })
            .join("\n\n");

        const discussionPrompt = `
議題: ${topic}

他の参加者の意見:
${othersOpinions}

これらを踏まえて、あなたの立場から意見を述べてください。
他の意見への賛成、反論、または補足を行ってください。
まだ最終的な結論（承認/否定）は出さなくて構いません。議論を深めてください。
回答は${maxResponseLength}文字以内で簡潔にお願いします。
`;

        core.element.classList.add('processing');
        core.status.textContent = "DEBATING...";

        core.history.push({ role: "user", content: discussionPrompt });

        const personaId = core.select.value;
        const persona = PERSONAS.find(p => p.id === personaId);

        try {
            const result = await client.analyze(core.history, persona.systemPrompt);

            core.element.classList.remove('processing');
            core.status.textContent = "OPINION";

            core.history.push({ role: "assistant", content: JSON.stringify(result) });
            appendMessageToDisplay(core, "ai", result.reason);

            // Log to overlay
            const personaName = core.select.options[core.select.selectedIndex].text;
            appendDiscussionLog(personaName, result.reason, "ai", core.id);

            return result;
        } catch (error) {
            console.error(`Core ${core.id} Round 2 failed`, error);
            core.element.classList.remove('processing');
            return null;
        }
    });

    try {
        await Promise.all(round2Promises);
    } catch (error) {
        console.error("Round 2 failed:", error);
    }

    await waitForNextPhase();

    // --- Round 3: Final Decision ---
    finalResultText.textContent = "FINAL JUDGMENT";
    appendDiscussionLog("SYSTEM", "--- PHASE 3: FINAL JUDGMENT ---", "phase");

    const round3Promises = activeCores.map(async (core) => {
        setActiveSpeaker(core, activeCores);

        const finalPrompt = `議論を踏まえて、最終的な結論（承認 または 否定）とその理由を述べてください。回答は${maxResponseLength}文字以内で簡潔にお願いします。`;

        core.element.classList.add('processing');
        core.status.textContent = "JUDGING...";

        core.history.push({ role: "user", content: finalPrompt });

        const personaId = core.select.value;
        const persona = PERSONAS.find(p => p.id === personaId);

        try {
            const result = await client.analyze(core.history, persona.systemPrompt);

            core.element.classList.remove('processing');
            core.status.textContent = result.decision;

            core.history.push({ role: "assistant", content: JSON.stringify(result) });
            appendMessageToDisplay(core, "ai", result.reason);

            // Log to overlay
            const personaName = core.select.options[core.select.selectedIndex].text;
            appendDiscussionLog(personaName, `[${result.decision}] ${result.reason}`, "ai", core.id);

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
            console.error(`Core ${core.id} Round 3 failed`, error);
            return "ERROR";
        }
    });

    try {
        const results = await Promise.all(round3Promises);
        determineFinalResult(results);
        resetActiveSpeakers(activeCores);
        appendDiscussionLog("SYSTEM", `>>> FINAL DECISION: ${finalResultText.textContent}`, "system");

        await waitForNextPhase();

        // --- Phase 4: Consensus (New) ---
        appendDiscussionLog("SYSTEM", "--- PHASE 4: CONSENSUS REPORT ---", "phase");

        const allDiscussions = activeCores.map(core => {
            const personaName = core.select.options[core.select.selectedIndex].text;
            // Get the last assistant message (Round 3 result)
            const lastMsg = core.history[core.history.length - 1];
            const content = JSON.parse(lastMsg.content);
            return `[${personaName}] (${content.decision}): ${content.reason}`;
        }).join("\n\n");

        const summaryPrompt = `
議題: ${topic}

最終判定結果: ${finalResultText.textContent}

各コアの最終意見:
${allDiscussions}

上記を踏まえて、MAGIシステムとしての「最終合意形成レポート」を作成してください。
以下の形式のJSONで出力してください：
{
  "summary": "議論の要約（対立点や合意点）",
  "reason": "最終結論に至った主な理由",
  "action": "今後の推奨アクション（あれば）"
}

簡潔にまとめてください。
`;

        const summarySystemPrompt = "あなたはMAGIシステムのメインオペレーティングシステムです。複数のAI人格による議論を統括し、客観的で簡潔な最終レポートを作成します。出力は必ずJSON形式で行ってください。";

        const summaryResult = await client.analyze([
            { role: "user", content: summaryPrompt }
        ], summarySystemPrompt);

        // Since summaryResult is already parsed JSON from client.analyze
        const reportText = `【要約】\n${summaryResult.summary}\n\n【理由】\n${summaryResult.reason}\n\n【推奨アクション】\n${summaryResult.action}`;

        appendDiscussionLog("MAGI SYSTEM", reportText, "final-report");

    } catch (error) {
        console.error("Round 3/4 failed:", error);
    }
} function appendDiscussionLog(speaker, text, type, coreId = null) {
    const entry = document.createElement('div');

    if (type === 'phase') {
        entry.className = 'timeline-phase';
        entry.textContent = text;
    } else {
        entry.className = 'timeline-entry';
        if (coreId) {
            entry.classList.add(`core-${coreId}`);
        }
        if (type === 'final-report') {
            entry.classList.add('final-report');
        }

        const header = document.createElement('div');
        header.className = 'timeline-header';
        header.textContent = speaker;

        const content = document.createElement('div');
        content.className = 'timeline-content';
        content.textContent = text;

        entry.appendChild(header);
        entry.appendChild(content);
    }

    discussionTimeline.appendChild(entry);
    // Scroll the new entry into view smoothly
    entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setActiveSpeaker(activeCore, allCores) {
    allCores.forEach(core => {
        if (core.id === activeCore.id) {
            core.element.classList.add('active-speaker');
            core.element.classList.remove('dimmed');
        } else {
            core.element.classList.remove('active-speaker');
            core.element.classList.add('dimmed');
        }
    });
}

function resetActiveSpeakers(allCores) {
    allCores.forEach(core => {
        core.element.classList.remove('active-speaker');
        core.element.classList.remove('dimmed');
    });
}

async function processCore(core, client, topic, isDiscussion = false) {
    // Set Loading State
    core.element.classList.add('processing');
    core.status.textContent = "PROCESSING...";

    // Add user message to history with length constraint
    const promptWithLimit = `${topic}\n\n(回答は${maxResponseLength}文字以内で簡潔にお願いします)`;
    core.history.push({ role: "user", content: promptWithLimit });

    // Display original topic to user (without the system instruction)
    appendMessageToDisplay(core, "user", topic);

    const personaId = core.select.value;
    const persona = PERSONAS.find(p => p.id === personaId);

    try {
        const result = await client.analyze(core.history, persona.systemPrompt);

        // Update UI with Result
        core.element.classList.remove('processing');

        if (isDiscussion) {
            core.status.textContent = "OPINION";
        } else {
            core.status.textContent = result.decision; // "承認" or "否定"
        }

        // Add AI response to history
        core.history.push({ role: "assistant", content: JSON.stringify(result) });
        appendMessageToDisplay(core, "ai", result.reason);

        // Apply Color Style (Only if not discussion mode, or if it's the final round)
        // For now, processCore is used for Round 1 of discussion, where we don't want to color yet
        if (!isDiscussion) {
            if (result.decision.includes("承認")) {
                core.element.classList.add('approved');
                core.element.classList.remove('denied');
            } else {
                core.element.classList.add('denied');
                core.element.classList.remove('approved');
            }
        }

        // Return full result object if discussion mode, else just decision string
        return isDiscussion ? result : result.decision;
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
    // Scroll the new message into view smoothly
    msgDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
