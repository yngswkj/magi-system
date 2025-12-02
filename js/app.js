import { PERSONAS } from './personas.js';
import { OpenAIClient } from './api.js';

// DOM Elements
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const saveSettingsBtn = document.getElementById('save-settings');
const cancelSettingsBtn = document.getElementById('cancel-settings');
// apiKeyInput removed
const modelSelect = document.getElementById('model-select');
const themeSelect = document.getElementById('theme-select');
const analyzeBtn = document.getElementById('analyze-btn');
const topicInput = document.getElementById('topic-input');
const randomPersonaBtn = document.getElementById('random-persona-btn');
const randomPersonaBtnDesktop = document.getElementById('random-persona-btn-desktop');
const finalResultDisplay = document.getElementById('final-result');
const finalResultText = finalResultDisplay.querySelector('.result-text');
const discussionOverlay = document.getElementById('discussion-overlay');
const discussionTimeline = document.getElementById('discussion-timeline');
const closeDiscussionBtn = document.getElementById('close-discussion');
const exportDiscussionBtn = document.getElementById('export-discussion');
const copyDiscussionBtn = document.getElementById('copy-discussion');
const nextPhaseBtn = document.getElementById('next-phase-btn');
const resetBtn = document.getElementById('reset-btn');
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
// apiKey removed
let selectedModel = localStorage.getItem('magi_model') || 'gpt-5.1';
let reasoningEffort = localStorage.getItem('magi_reasoning_effort') || 'none';
let selectedTheme = localStorage.getItem('magi_theme') || 'random';
let maxResponseLength = localStorage.getItem('magi_max_length') || 300;
let customPersonas = JSON.parse(localStorage.getItem('magi_custom_personas') || '[]');
let discussionHistory = JSON.parse(localStorage.getItem('magi_history') || '[]');
let isMuted = localStorage.getItem('magi_muted') === 'true';
let editingPersonaId = null;

// Sound Manager
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SoundManager = {
    playTone: (freq, type, duration, vol = 0.1) => {
        if (isMuted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },

    playPhaseChange: () => {
        SoundManager.playTone(880, 'square', 0.1, 0.05);
        setTimeout(() => SoundManager.playTone(1760, 'square', 0.3, 0.05), 100);
    },

    playDecision: (isApproved) => {
        if (isApproved) {
            SoundManager.playTone(440, 'sine', 0.1);
            setTimeout(() => SoundManager.playTone(554, 'sine', 0.1), 100);
            setTimeout(() => SoundManager.playTone(659, 'sine', 0.4), 200);
        } else {
            SoundManager.playTone(150, 'sawtooth', 0.3, 0.1);
            setTimeout(() => SoundManager.playTone(100, 'sawtooth', 0.4, 0.1), 100);
        }
    },

    playClick: () => {
        SoundManager.playTone(1200, 'sine', 0.05, 0.02);
    }
};

function getAllPersonas() {
    return [...PERSONAS, ...customPersonas];
}

function getSystemPromptWithJsonInstruction(persona) {
    const instruction = `
出力フォーマットは必ず以下のJSON形式にしてください:
{
  "decision": "承認" または "否定",
  "reason": "理由"
}`;

    // If the prompt already seems to have JSON instructions, trust it (or append anyway to be safe about fields)
    // To be safe and ensure compatibility with the app's logic (which expects decision/reason keys),
    // we should probably append it unless we are sure.
    // However, appending it to the standard personas (which already have it) might be redundant but harmless.
    // The standard personas have: "出力フォーマットはJSONで { "decision": "承認" or "否定", "reason": "理由" } としてください。"

    if (persona.systemPrompt.includes("JSON") && persona.systemPrompt.includes("decision")) {
        return persona.systemPrompt;
    }
    return persona.systemPrompt + "\n" + instruction;
}

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
    // apiKey initialization removed
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

        getAllPersonas().forEach(persona => {
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

    if (exportDiscussionBtn) {
        exportDiscussionBtn.addEventListener('click', exportDiscussionLog);
    }

    if (copyDiscussionBtn) {
        copyDiscussionBtn.addEventListener('click', copyDiscussionLog);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetSession);
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
    if (randomPersonaBtnDesktop) {
        randomPersonaBtnDesktop.addEventListener('click', randomizePersonas);
    }

    // API Key check removed

    // Mode Switch Listener
    const discussionModeCheckbox = document.getElementById('discussion-mode');
    if (discussionModeCheckbox) {
        discussionModeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('discussion-active');
                SoundManager.playPhaseChange();
            } else {
                document.body.classList.remove('discussion-active');
                SoundManager.playClick();
            }
        });
    }

    // Sound Mute Toggle
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? "SOUND: OFF" : "SOUND: ON";
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            localStorage.setItem('magi_muted', isMuted);
            muteBtn.textContent = isMuted ? "SOUND: OFF" : "SOUND: ON";
            if (!isMuted) SoundManager.playClick();
        });
    }

    // Add click sounds to all buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => SoundManager.playClick());
    });

    // Tab Switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission if inside form
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');

            // Re-render list if switching to personas tab
            if (btn.dataset.tab === 'custom-personas') {
                renderCustomPersonaList();
                resetPersonaForm();
            } else if (btn.dataset.tab === 'history-tab') {
                renderHistoryList();
            }
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            applyTheme(selectedTheme);
            settingsModal.style.display = 'none';
            resetPersonaForm();
        }
    });

    // Custom Persona Logic
    renderCustomPersonaList();
    const addPersonaBtn = document.getElementById('add-persona-btn');
    if (addPersonaBtn) {
        addPersonaBtn.addEventListener('click', addCustomPersona);
    }

    // History Logic
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearAllHistory);
    }
}

// Core logic unchanged...

async function randomizePersonas() {
    if (randomPersonaBtn) randomPersonaBtn.disabled = true;
    if (randomPersonaBtnDesktop) randomPersonaBtnDesktop.disabled = true;

    // 1. Determine target personas (Unique shuffle)
    const activeCores = cores.filter(core => core.toggle.checked);
    if (activeCores.length === 0) {
        if (randomPersonaBtn) randomPersonaBtn.disabled = false;
        if (randomPersonaBtnDesktop) randomPersonaBtnDesktop.disabled = false;
        return;
    }

    const allPersonas = getAllPersonas();
    const shuffled = [...allPersonas].sort(() => 0.5 - Math.random());

    // Assign unique personas to active cores
    const assignments = activeCores.map((core, index) => {
        // If we have more cores than personas, loop around (though unlikely with 3 cores / 6 personas)
        const targetPersona = shuffled[index % shuffled.length];
        return { core, targetPersona };
    });

    // 2. Start Slot Animation for each core
    const animations = assignments.map(({ core, targetPersona }, index) => {
        return runSlotAnimation(core, targetPersona, index * 200); // Stagger start times
    });

    await Promise.all(animations);

    if (randomPersonaBtn) randomPersonaBtn.disabled = false;
    if (randomPersonaBtnDesktop) randomPersonaBtnDesktop.disabled = false;
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

        for (let i = 0; i < spinCount; i++) {
            const randomP = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
            const item = document.createElement('div');
            item.className = 'slot-item';
            item.textContent = randomP.name;
            strip.appendChild(item);
        }
        // Add target at the end
        const targetItem = document.createElement('div');
        targetItem.className = 'slot-item';
        targetItem.textContent = targetPersona.name;
        strip.appendChild(targetItem);

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
    // apiKey handling removed
    selectedModel = modelSelect.value;
    reasoningEffort = document.getElementById('reasoning-effort').value;
    selectedTheme = themeSelect.value;
    maxResponseLength = maxLengthInput ? maxLengthInput.value.trim() : 300;

    // apiKey check removed
    localStorage.setItem('magi_model', selectedModel);
    localStorage.setItem('magi_reasoning_effort', reasoningEffort);
    localStorage.setItem('magi_theme', selectedTheme);
    localStorage.setItem('magi_max_length', maxResponseLength);

    applyTheme(selectedTheme);
    settingsModal.style.display = 'none';
}

function applyTheme(themeName) {
    let targetTheme = themeName;

    if (themeName === 'random') {
        const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
        const now = Date.now();
        const cached = JSON.parse(localStorage.getItem('magi_random_theme_cache'));

        if (cached && (now - cached.timestamp < CACHE_DURATION)) {
            targetTheme = cached.color;
        } else {
            const keys = Object.keys(THEMES);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];

            localStorage.setItem('magi_random_theme_cache', JSON.stringify({
                color: randomKey,
                timestamp: now
            }));
            targetTheme = randomKey;
        }
    }

    const theme = THEMES[targetTheme] || THEMES.orange;
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

    // apiKey check removed

    // Reset UI for new turn (don't clear history, just status)
    resetStatusUI();

    const client = new OpenAIClient(selectedModel, reasoningEffort);

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

    const round1Promises = activeCores.map(async (core) => {
        setActiveSpeaker(core, activeCores);
        const result = await processCore(core, client, topic, true); // true = discussion mode (no decision yet)
        return { core, result };
    });

    try {
        const round1Results = await Promise.all(round1Promises);

        // Sort by Core ID to ensure fixed order
        round1Results.sort((a, b) => a.core.id - b.core.id);

        round1Results.forEach(({ core, result }) => {
            // Log to overlay
            const personaName = getPersonaNameWithSuffix(core);
            appendDiscussionLog(personaName, result.reason, "ai", core.id);
        });

    } catch (error) {
        console.error("Round 1 failed:", error);
        alert("議論フェーズ1でエラーが発生しました。");
        return;
    }

    await waitForNextPhase();
    SoundManager.playPhaseChange();

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
        const persona = getAllPersonas().find(p => p.id === personaId);
        const systemPrompt = getSystemPromptWithJsonInstruction(persona);

        try {
            const result = await client.analyze(core.history, systemPrompt);

            core.element.classList.remove('processing');
            core.status.textContent = "OPINION";

            core.history.push({ role: "assistant", content: JSON.stringify(result) });
            appendMessageToDisplay(core, "ai", result.reason);

            return { core, result };
        } catch (error) {
            console.error(`Core ${core.id} Round 2 failed`, error);
            core.element.classList.remove('processing');
            return { core, result: { decision: "Error", reason: "Error processing request." } };
        }
    });

    try {
        const round2Results = await Promise.all(round2Promises);

        // Sort by Core ID
        round2Results.sort((a, b) => a.core.id - b.core.id);

        round2Results.forEach(({ core, result }) => {
            const personaName = getPersonaNameWithSuffix(core);
            appendDiscussionLog(personaName, result.reason, "ai", core.id);
        });
    } catch (error) {
        console.error("Round 2 failed:", error);
    }

    await waitForNextPhase();
    SoundManager.playPhaseChange();

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
        const persona = getAllPersonas().find(p => p.id === personaId);
        const systemPrompt = getSystemPromptWithJsonInstruction(persona);

        try {
            const result = await client.analyze(core.history, systemPrompt);

            core.element.classList.remove('processing');
            core.status.textContent = result.decision;

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

            return { core, result };
        } catch (error) {
            console.error(`Core ${core.id} Round 3 failed`, error);
            return { core, result: { decision: "ERROR", reason: "Error processing request." } };
        }
    });

    try {
        const round3Results = await Promise.all(round3Promises);

        // Sort by Core ID
        round3Results.sort((a, b) => a.core.id - b.core.id);

        round3Results.forEach(({ core, result }) => {
            const personaName = getPersonaNameWithSuffix(core);
            appendDiscussionLog(personaName, `[${result.decision}] ${result.reason}`, "ai", core.id);
        });

        const results = round3Results.map(r => r.result.decision);
        determineFinalResult(results, topic); // Pass topic here
        resetActiveSpeakers(activeCores);
        appendDiscussionLog("SYSTEM", `>>> FINAL DECISION: ${finalResultText.textContent}`, "system");

        await waitForNextPhase();

        // --- Phase 4: Consensus (New) ---
        appendDiscussionLog("SYSTEM", "--- PHASE 4: CONSENSUS REPORT ---", "phase");

        const allDiscussions = round3Results.map(({ core, result }) => {
            const personaName = getPersonaNameWithSuffix(core);
            return `[${personaName}] (${result.decision}): ${result.reason}`;
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
    } else if (type === 'final-report') {
        entry.className = 'timeline-entry final-report';

        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.textContent = '**MAGI SYSTEM 最終合意形成レポート**';

        const content = document.createElement('div');
        content.style.whiteSpace = 'pre-wrap';
        content.textContent = text;

        entry.appendChild(title);
        entry.appendChild(content);
    } else {
        entry.className = 'timeline-entry';
        if (coreId) {
            entry.classList.add(`core-${coreId}`);
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
    const persona = getAllPersonas().find(p => p.id === personaId);
    const systemPrompt = getSystemPromptWithJsonInstruction(persona);

    try {
        const result = await client.analyze(core.history, systemPrompt);

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
                SoundManager.playDecision(true);
            } else {
                core.element.classList.add('denied');
                core.element.classList.remove('approved');
                SoundManager.playDecision(false);
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

function determineFinalResult(results, topic = null) {
    const approveCount = results.filter(r => r.includes("承認")).length;
    const denyCount = results.filter(r => r.includes("否定")).length;

    finalResultDisplay.classList.remove('approved', 'denied');

    if (approveCount > denyCount) {
        finalResultText.textContent = "承認 (GRANTED)";
        finalResultDisplay.classList.add('approved');
        SoundManager.playDecision(true);
    } else if (denyCount > approveCount) {
        finalResultText.textContent = "否定 (DENIED)";
        finalResultDisplay.classList.add('denied');
        SoundManager.playDecision(false);
    } else {
        finalResultText.textContent = "審議中 (PENDING)";
    }

    // Save History
    console.log("Saving history...");
    saveDiscussionHistory(finalResultText.textContent, topic);
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

function generateLogText() {
    let logText = "# MAGI SYSTEM CONFERENCE LOG\n";
    logText += `Date: ${new Date().toLocaleString()}\n\n`;

    Array.from(discussionTimeline.children).forEach(entry => {
        if (entry.classList.contains('timeline-phase')) {
            logText += `\n## ${entry.textContent}\n\n`;
        } else if (entry.classList.contains('timeline-entry')) {
            const headerEl = entry.querySelector('.timeline-header');
            const contentEl = entry.querySelector('.timeline-content');

            if (headerEl && contentEl) {
                const header = headerEl.textContent;
                const content = contentEl.textContent;
                logText += `**${header}**\n${content}\n\n`;
            } else {
                // Fallback for final report or other custom entries
                logText += `${entry.innerText}\n\n`;
            }
        }
    });
    return logText;
}

function resetSession() {
    if (!confirm("Reset current session? All unsaved progress will be lost.")) return;

    // Clear Timeline
    discussionTimeline.innerHTML = '';

    // Reset Cores
    cores.forEach(core => {
        core.history = [];
        core.element.classList.remove('approved', 'denied', 'processing');
        core.status.textContent = "STANDBY";
        core.display.innerHTML = '';
    });

    // Reset UI
    document.body.classList.remove('discussion-active');
    finalResultDisplay.classList.remove('approved', 'denied');
    finalResultText.textContent = "ANALYZING...";
    document.getElementById('topic-input').value = '';

    SoundManager.playClick();
}

function exportDiscussionLog() {
    const logText = generateLogText();
    const blob = new Blob([logText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `magi-log-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function copyDiscussionLog() {
    const logText = generateLogText();
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(logText);
        } else {
            // Fallback for insecure contexts (http)
            const textArea = document.createElement("textarea");
            textArea.value = logText;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback copy failed', err);
                throw err;
            }
            document.body.removeChild(textArea);
        }

        const originalText = copyDiscussionBtn.textContent;
        copyDiscussionBtn.textContent = "COPIED!";
        SoundManager.playDecision(true);
        setTimeout(() => {
            copyDiscussionBtn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard');
    }
}

// Custom Persona Functions
function renderCustomPersonaList() {
    const listContainer = document.getElementById('custom-persona-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (customPersonas.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.color = '#888';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.textContent = 'No custom personas yet.';
        listContainer.appendChild(emptyMsg);
        return;
    }

    customPersonas.forEach(p => {
        const item = document.createElement('div');
        item.className = 'persona-item';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'persona-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'persona-name';
        nameDiv.textContent = p.name;

        const descDiv = document.createElement('div');
        descDiv.className = 'persona-desc';
        descDiv.textContent = p.description;

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(descDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'persona-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-persona-btn';
        editBtn.textContent = 'EDIT';
        editBtn.dataset.id = p.id;
        editBtn.addEventListener('click', () => editCustomPersona(p.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-persona-btn';
        deleteBtn.textContent = 'DELETE';
        deleteBtn.dataset.id = p.id;
        deleteBtn.addEventListener('click', () => deleteCustomPersona(p.id));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);

        listContainer.appendChild(item);
    });
}

function addCustomPersona() {
    const nameInput = document.getElementById('new-persona-name');
    const descInput = document.getElementById('new-persona-desc');
    const promptInput = document.getElementById('new-persona-prompt');

    const name = nameInput.value.trim();
    const desc = descInput.value.trim();
    const prompt = promptInput.value.trim();

    if (!name || !prompt) {
        alert("Name and System Prompt are required.");
        return;
    }

    if (editingPersonaId) {
        // Update existing
        const index = customPersonas.findIndex(p => p.id === editingPersonaId);
        if (index !== -1) {
            customPersonas[index] = {
                id: editingPersonaId,
                name: name,
                description: desc,
                systemPrompt: prompt
            };
        }
        resetPersonaForm();
    } else {
        // Create new
        const newPersona = {
            id: 'custom-' + Date.now(),
            name: name,
            description: desc,
            systemPrompt: prompt
        };
        customPersonas.push(newPersona);

        // Reset inputs manually if not using resetPersonaForm (which clears editing state)
        nameInput.value = '';
        descInput.value = '';
        promptInput.value = '';
    }

    localStorage.setItem('magi_custom_personas', JSON.stringify(customPersonas));
    renderCustomPersonaList();
    updatePersonaDropdowns();
}

function editCustomPersona(id) {
    const persona = customPersonas.find(p => p.id === id);
    if (!persona) return;

    document.getElementById('new-persona-name').value = persona.name;
    document.getElementById('new-persona-desc').value = persona.description;
    document.getElementById('new-persona-prompt').value = persona.systemPrompt;

    editingPersonaId = id;

    const btn = document.getElementById('add-persona-btn');
    if (btn) btn.textContent = "UPDATE PERSONA";

    const header = document.querySelector('#custom-personas h3');
    if (header) header.textContent = "EDIT PERSONA";

    // Scroll to form
    header.scrollIntoView({ behavior: 'smooth' });
}

function resetPersonaForm() {
    editingPersonaId = null;
    document.getElementById('new-persona-name').value = '';
    document.getElementById('new-persona-desc').value = '';
    document.getElementById('new-persona-prompt').value = '';

    const btn = document.getElementById('add-persona-btn');
    if (btn) btn.textContent = "ADD PERSONA";

    const header = document.querySelector('#custom-personas h3');
    if (header) header.textContent = "ADD NEW PERSONA";
}

function deleteCustomPersona(id) {
    if (!confirm("Are you sure you want to delete this persona?")) return;
    customPersonas = customPersonas.filter(p => p.id !== id);
    localStorage.setItem('magi_custom_personas', JSON.stringify(customPersonas));
    renderCustomPersonaList();
    updatePersonaDropdowns();
}

function updatePersonaDropdowns() {
    cores.forEach(core => {
        const currentVal = core.select.value;
        core.select.innerHTML = '';
        getAllPersonas().forEach(persona => {
            const option = document.createElement('option');
            option.value = persona.id;
            option.textContent = persona.name;
            core.select.appendChild(option);
        });
        // Restore selection if it still exists, otherwise default
        if (getAllPersonas().some(p => p.id === currentVal)) {
            core.select.value = currentVal;
        } else {
            // Fallback to defaults based on core index
            if (core.id === 1) core.select.value = 'scientist';
            else if (core.id === 2) core.select.value = 'mother';
            else core.select.value = 'woman';
        }
    });
}

function getPersonaNameWithSuffix(core) {
    const personaId = core.select.value;
    const persona = getAllPersonas().find(p => p.id === personaId);
    const baseName = persona ? persona.name : "UNKNOWN";

    let suffix = "";
    if (core.id === 1) suffix = " (MELCHIOR)";
    else if (core.id === 2) suffix = " (BALTHASAR)";
    else if (core.id === 3) suffix = " (CASPER)";

    return baseName + suffix;
}

// History Functions
function saveDiscussionHistory(result, topic = null) {
    const finalTopic = topic || document.getElementById('topic-input').value || "No Topic";
    const logs = [];

    Array.from(discussionTimeline.children).forEach(entry => {
        if (entry.classList.contains('timeline-phase')) {
            logs.push({ type: 'phase', text: entry.textContent });
        } else if (entry.classList.contains('timeline-entry')) {
            if (entry.classList.contains('final-report')) {
                // Extract text content safely
                // Assuming structure: Title Div, Content Div
                let reportText = "";
                if (entry.children.length >= 2) {
                    reportText = entry.children[1].textContent;
                } else {
                    reportText = entry.innerText;
                }
                logs.push({ type: 'final-report', text: reportText });
            } else {
                const headerEl = entry.querySelector('.timeline-header');
                const contentEl = entry.querySelector('.timeline-content');
                if (headerEl && contentEl) {
                    let coreId = null;
                    if (entry.classList.contains('core-0')) coreId = 0;
                    if (entry.classList.contains('core-1')) coreId = 1;
                    if (entry.classList.contains('core-2')) coreId = 2;

                    logs.push({
                        type: 'entry',
                        coreId: coreId,
                        header: headerEl.textContent,
                        content: contentEl.textContent
                    });
                } else {
                    logs.push({ type: 'text', text: entry.innerText });
                }
            }
        }
    });

    const historyItem = {
        id: 'hist-' + Date.now(),
        timestamp: new Date().toISOString(),
        topic: finalTopic,
        result: result,
        logs: logs
    };

    console.log("History item created:", historyItem);

    discussionHistory.unshift(historyItem); // Add to top
    // Limit history to 20 items
    if (discussionHistory.length > 20) {
        discussionHistory = discussionHistory.slice(0, 20);
    }
    localStorage.setItem('magi_history', JSON.stringify(discussionHistory));
    console.log("History saved to localStorage. Total items:", discussionHistory.length);
}

function renderHistoryList() {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (discussionHistory.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.color = '#888';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.textContent = 'No history available.';
        listContainer.appendChild(emptyMsg);
        return;
    }

    discussionHistory.forEach(item => {
        const date = new Date(item.timestamp).toLocaleString();
        const el = document.createElement('div');
        el.className = 'persona-item'; // Reuse style

        const infoDiv = document.createElement('div');
        infoDiv.className = 'persona-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'persona-name';
        nameDiv.textContent = item.topic;

        const descDiv = document.createElement('div');
        descDiv.className = 'persona-desc';
        descDiv.textContent = `${date} - Result: ${item.result}`;

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(descDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'persona-actions';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'edit-persona-btn';
        loadBtn.textContent = 'LOAD';
        loadBtn.addEventListener('click', () => loadHistory(item.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-persona-btn';
        deleteBtn.textContent = 'DELETE';
        deleteBtn.addEventListener('click', () => deleteHistory(item.id));

        actionsDiv.appendChild(loadBtn);
        actionsDiv.appendChild(deleteBtn);

        el.appendChild(infoDiv);
        el.appendChild(actionsDiv);

        listContainer.appendChild(el);
    });
}

function loadHistory(id) {
    const item = discussionHistory.find(h => h.id === id);
    if (!item) return;

    if (document.body.classList.contains('discussion-active')) {
        if (!confirm("Current discussion will be lost. Load history?")) return;
    }

    // Close modal
    document.getElementById('settings-modal').style.display = 'none';

    // Activate discussion mode
    document.body.classList.add('discussion-active');
    discussionTimeline.innerHTML = '';
    finalResultDisplay.classList.remove('approved', 'denied');
    finalResultText.textContent = item.result;

    if (item.result.includes("承認")) finalResultDisplay.classList.add('approved');
    else if (item.result.includes("否定")) finalResultDisplay.classList.add('denied');

    // Reconstruct Timeline
    item.logs.forEach(log => {
        const entry = document.createElement('div');
        if (log.type === 'phase') {
            entry.className = 'timeline-phase';
            entry.textContent = log.text;
        } else if (log.type === 'final-report') {
            entry.className = 'timeline-entry final-report';

            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '10px';
            title.textContent = '**MAGI SYSTEM 最終合意形成レポート**';

            const content = document.createElement('div');
            content.style.whiteSpace = 'pre-wrap';
            // Handle both new (text) and old (html) formats safely
            content.textContent = log.text || log.html || "";

            entry.appendChild(title);
            entry.appendChild(content);
        } else if (log.type === 'entry') {
            entry.className = 'timeline-entry';
            if (log.coreId !== null) entry.classList.add(`core-${log.coreId}`);

            const header = document.createElement('div');
            header.className = 'timeline-header';
            header.textContent = log.header;

            const content = document.createElement('div');
            content.className = 'timeline-content';
            content.textContent = log.content;

            entry.appendChild(header);
            entry.appendChild(content);
        } else if (log.type === 'text') {
            entry.className = 'timeline-entry';
            entry.innerText = log.text;
        }
        discussionTimeline.appendChild(entry);
    });
}

// Expose to global scope removed
// window.loadHistory = loadHistory;
// window.deleteHistory = deleteHistory;

function deleteHistory(id) {
    if (!confirm("Delete this history log?")) return;
    discussionHistory = discussionHistory.filter(h => h.id !== id);
    localStorage.setItem('magi_history', JSON.stringify(discussionHistory));
    renderHistoryList();
}

function clearAllHistory() {
    if (!confirm("Clear ALL history? This cannot be undone.")) return;
    discussionHistory = [];
    localStorage.setItem('magi_history', JSON.stringify(discussionHistory));
    renderHistoryList();
}

init();
