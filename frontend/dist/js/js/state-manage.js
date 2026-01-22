const api = window.eventixApi;

const defaultPayload = {
    data: {
        cart: { items: [] },
        preferences: { currency: 'USD' },
        uploads: []
    },
    note: 'Optional note about this state'
};

const uiState = {
    activeTab: 'manage',
    hasLoaded: false
};

function setMessage(text, isError = false) {
    const messageEl = document.getElementById('stateMessage');
    messageEl.textContent = text;
    messageEl.classList.toggle('error', isError);
}

function setActiveTab(tabId) {
    uiState.activeTab = tabId;
    document.querySelectorAll('.state-tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.state-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.panel !== tabId);
    });
}

function updateMeta(state) {
    const userEl = document.getElementById('stateUser');
    const apiEl = document.getElementById('stateApi');
    const updatedEl = document.getElementById('stateUpdated');
    const userId = state?.user_id || 'pending';
    const updatedAt = state?.state?.meta?.updated_at || 'not synced yet';
    userEl.textContent = `User cookie: ${userId}`;
    apiEl.textContent = `API base: ${api.baseUrl()}`;
    updatedEl.textContent = `Last update: ${updatedAt}`;
}

function serializeState(state) {
    return JSON.stringify(state, null, 2);
}

async function refreshState({ syncEditor = false } = {}) {
    setMessage('');
    try {
        const next = await api.getState();
        updateMeta(next);
        const viewer = document.getElementById('stateViewer');
        viewer.textContent = serializeState(next.state || {});
        if (!uiState.hasLoaded || syncEditor) {
            const editor = document.getElementById('stateEditor');
            editor.value = serializeState(next.state || {});
        }
        uiState.hasLoaded = true;
    } catch (error) {
        setMessage(error.message || 'Failed to load state.', true);
    }
}

function parseEditor() {
    const editor = document.getElementById('stateEditor');
    const raw = editor.value.trim();
    if (!raw) {
        throw new Error('Editor is empty.');
    }
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('State must be a JSON object.');
    }
    return payload;
}

function normalizePayload(payload) {
    const hasData = Object.prototype.hasOwnProperty.call(payload, 'data');
    const data = hasData ? payload.data : payload;
    const note = Object.prototype.hasOwnProperty.call(payload, 'note') ? payload.note : undefined;
    const meta = Object.prototype.hasOwnProperty.call(payload, 'meta') ? payload.meta : undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('State must include a data object.');
    }
    return { data, note, meta };
}

async function handlePatch() {
    setMessage('');
    try {
        const payload = parseEditor();
        const normalized = normalizePayload(payload);
        const next = await api.patchState(normalized.data, normalized.note);
        updateMeta(next);
        document.getElementById('stateViewer').textContent = serializeState(next.state || {});
        setMessage('State patched.');
    } catch (error) {
        setMessage(error.message || 'Patch failed.', true);
    }
}

async function handlePut() {
    setMessage('');
    try {
        const payload = parseEditor();
        const normalized = normalizePayload(payload);
        const next = await api.replaceState(normalized.data, normalized.note, normalized.meta);
        updateMeta(next);
        document.getElementById('stateViewer').textContent = serializeState(next.state || {});
        setMessage('State replaced.');
    } catch (error) {
        setMessage(error.message || 'Save failed.', true);
    }
}

async function handleReset() {
    setMessage('');
    try {
        const next = await api.resetState();
        updateMeta(next);
        document.getElementById('stateViewer').textContent = serializeState(next.state || {});
        document.getElementById('stateEditor').value = serializeState(next.state || {});
        setMessage('State reset.');
    } catch (error) {
        setMessage(error.message || 'Reset failed.', true);
    }
}

function handleDownload() {
    setMessage('');
    try {
        const payload = parseEditor();
        const blob = new Blob([serializeState(payload)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'state.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    } catch (error) {
        setMessage(error.message || 'Download failed.', true);
    }
}

function initStateManage() {
    document.querySelectorAll('.state-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    document.getElementById('refreshStateBtn').addEventListener('click', () => {
        refreshState({ syncEditor: true });
    });

    document.getElementById('patchStateBtn').addEventListener('click', handlePatch);
    document.getElementById('putStateBtn').addEventListener('click', handlePut);
    document.getElementById('resetStateBtn').addEventListener('click', handleReset);
    document.getElementById('downloadStateBtn').addEventListener('click', handleDownload);

    document.getElementById('stateEditor').value = JSON.stringify(defaultPayload, null, 2);
    refreshState();
}

document.addEventListener('DOMContentLoaded', initStateManage);
