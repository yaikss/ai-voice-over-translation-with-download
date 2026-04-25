// ==UserScript==
// @name         VOT YouTube Translator
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  YouTube video translation with download feature - matches original VOT position
// @author       You
// @match        https://www.youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('[VOT] Script loaded');

    // ============================================
    // CONFIGURATION & STATE
    // ============================================
    const CONFIG = {
        serverUrl: GM_getValue('vot_server_url', 'https://api.vot-translator.com'),
        buttonPosition: GM_getValue('vot_button_position', 'default'),
        autoTranslate: GM_getValue('vot_auto_translate', false),
        targetLanguage: GM_getValue('vot_target_language', 'en')
    };

    let currentState = {
        videoId: null,
        isTranslating: false,
        isMakingVideo: false,
        downloadProgress: 0,
        translationAudioUrl: null,
        translatedSegments: [],
        availableQualities: [],
        selectedQuality: null
    };

    // ============================================
    // UI STYLES - Exact VOT positioning
    // ============================================
    const STYLES = `
        .vot-segmented-button {
            --vot-primary-rgb: 33, 150, 243;
            --vot-surface-rgb: 255, 255, 255;
            --vot-onsurface-rgb: 0, 0, 0;
            --vot-border-color: rgba(0, 0, 0, 0.1);
            --vot-radius-s: 8px;
            --vot-shadow-1: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
            --vot-duration-slow: 0.3s;
            --vot-duration-fast: 0.15s;
            --vot-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
            --vot-space-2: 8px;
            --vot-focus-ring-color: rgba(33, 150, 243, 0.5);

            opacity: 1 !important;
            pointer-events: auto !important;
            touch-action: none !important;
            overflow: hidden;
            position: absolute !important;
            left: 50% !important;
            top: 5rem !important;
            transform: translateX(-50%) !important;
            user-select: none;
            display: flex !important;
            align-items: center;
            height: 36px;
            max-width: 100vw;
            background: rgb(var(--vot-surface-rgb));
            color: rgba(var(--vot-onsurface-rgb), 0.87);
            fill: rgba(var(--vot-onsurface-rgb), 0.87);
            border: 1px solid var(--vot-border-color) !important;
            border-radius: var(--vot-radius-s) !important;
            box-shadow: var(--vot-shadow-1) !important;
            font-family: "YouTube Noto", Roboto, "Segoe UI", system-ui, sans-serif !important;
            font-size: 16px;
            line-height: 1.5;
            cursor: default;
            transition: opacity var(--vot-duration-slow) var(--vot-easing-standard);
            z-index: 2147483647 !important;
        }

        .vot-segmented-button.vot-segmented-button--hidden {
            opacity: 0 !important;
            pointer-events: none !important;
        }

        .vot-segmented-button * {
            box-sizing: border-box !important;
        }

        .vot-segmented-button .vot-separator {
            width: 1px;
            height: 50%;
            background: rgba(var(--vot-onsurface-rgb), 0.1);
        }

        .vot-segmented-button .vot-segment {
            position: relative;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            padding: 0 var(--vot-space-2) !important;
            background-color: transparent;
            color: inherit;
            transition: background-color var(--vot-duration-fast) var(--vot-easing-standard);
            border: none !important;
            outline: none;
            -webkit-tap-highlight-color: transparent;
            cursor: pointer;
        }

        .vot-segmented-button .vot-segment:hover {
            background-color: rgba(var(--vot-onsurface-rgb), 0.04);
        }

        .vot-segmented-button .vot-segment:active {
            background-color: rgba(var(--vot-onsurface-rgb), 0.16);
        }

        .vot-segmented-button .vot-segment-only-icon {
            min-width: 36px;
            padding: 0 !important;
        }

        .vot-segmented-button .vot-segment-label {
            margin-left: var(--vot-space-2) !important;
            white-space: nowrap;
            color: inherit;
            font-weight: 400 !important;
        }

        /* Status colors */
        .vot-segmented-button[data-status="success"] .vot-translate-button {
            color: rgb(var(--vot-primary-rgb));
            fill: rgb(var(--vot-primary-rgb));
        }

        .vot-segmented-button[data-status="error"] .vot-translate-button {
            color: #f28b82;
            fill: #f28b82;
        }

        /* Loading state */
        .vot-segmented-button[data-loading="true"] .vot-spinner {
            display: block !important;
        }

        .vot-segmented-button[data-loading="true"] .vot-translate-icon {
            display: none !important;
        }

        /* Position variants */
        .vot-segmented-button[data-position="left"] {
            left: 50px !important;
            top: 12.5vh !important;
            transform: none !important;
        }

        .vot-segmented-button[data-position="right"] {
            left: auto !important;
            right: 0 !important;
            top: 12.5vh !important;
            transform: none !important;
        }

        .vot-segmented-button[data-position="bottom"] {
            left: 50% !important;
            top: auto !important;
            bottom: 80px !important;
            transform: translateX(-50%) !important;
        }

        /* Direction: column (for left/right positions) */
        .vot-segmented-button[data-direction="column"] {
            flex-direction: column;
            height: fit-content;
        }

        .vot-segmented-button[data-direction="column"] .vot-segment-label {
            display: none;
        }

        .vot-segmented-button[data-direction="column"] > .vot-segment-only-icon,
        .vot-segmented-button[data-direction="column"] > .vot-segment {
            padding: 8px !important;
        }

        .vot-segmented-button[data-direction="column"] .vot-separator {
            height: 1px;
            width: 50%;
        }

        /* Icons */
        .vot-segmented-button svg {
            width: 24px;
            height: 24px;
            fill: inherit;
            stroke: inherit;
            flex-shrink: 0;
        }

        /* Spinner */
        .vot-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(var(--vot-onsurface-rgb), 0.2);
            border-top-color: rgb(var(--vot-primary-rgb));
            border-radius: 50%;
            animation: vot-spin 1s linear infinite;
            display: none;
        }

        @keyframes vot-spin {
            to { transform: rotate(360deg); }
        }

        /* Quality Dialog */
        .vot-quality-dialog {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2147483647;
        }

        .vot-quality-dialog-content {
            background: #1f1f1f;
            border-radius: 12px;
            padding: 24px;
            min-width: 320px;
            max-width: 90vw;
            color: white;
            font-family: "YouTube Noto", Roboto, Arial, sans-serif;
        }

        .vot-quality-dialog h3 {
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 500;
        }

        .vot-quality-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
            max-height: 300px;
            overflow-y: auto;
        }

        .vot-quality-option {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: #2a2a2a;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .vot-quality-option:hover {
            background: #3a3a3a;
        }

        .vot-quality-option input {
            margin-right: 12px;
        }

        .vot-quality-label {
            flex: 1;
            font-size: 14px;
        }

        .vot-quality-info {
            font-size: 12px;
            color: #aaa;
        }

        .vot-dialog-buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }

        .vot-dialog-btn {
            padding: 10px 20px;
            border-radius: 20px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }

        .vot-dialog-btn.primary {
            background: #ff0000;
            color: white;
        }

        .vot-dialog-btn.secondary {
            background: transparent;
            color: #aaa;
        }
    `;

    // ============================================
    // SVG ICONS
    // ============================================
    const TRANSLATE_ICON = `<svg class="vot-translate-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
    const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
    const PIP_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`;
    const MENU_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function injectStyles() {
        if (document.getElementById('vot-styles')) return;
        const style = document.createElement('style');
        style.id = 'vot-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
        console.log('[VOT] Styles injected');
    }

    function getVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    function extractVideoInfo() {
        const video = document.querySelector('video');
        const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title')?.textContent?.trim() || 'Unknown';
        return {
            videoId: getVideoId(),
            title: title,
            duration: video?.duration || 0,
            src: video?.src
        };
    }

    // ============================================
    // SERVER API (MOCK - Replace with real endpoints)
    // ============================================
    async function requestTranslation(videoId, targetLang = 'en') {
        return { job_id: 'mock-job-' + Date.now() };
    }

    async function checkTranslationStatus(jobId) {
        await new Promise(r => setTimeout(r, 1000));
        return { status: 'completed', audio_url: 'https://example.com/audio.mp3', segments: [] };
    }

    async function getAvailableQualities(videoId) {
        return [
            { label: '1080p', format: '137+140', resolution: '1920x1080', fps: 60 },
            { label: '1080p', format: '137+140', resolution: '1920x1080', fps: 30 },
            { label: '720p', format: '22', resolution: '1280x720', fps: 60 },
            { label: '720p', format: '22', resolution: '1280x720', fps: 30 },
            { label: '480p', format: '135+140', resolution: '854x480', fps: 30 },
            { label: '360p', format: '18', resolution: '640x360', fps: 30 }
        ];
    }

    async function startVideoDownload(videoId, quality) {
        return { download_id: 'mock-dl-' + Date.now() };
    }

    async function checkDownloadProgress(downloadId) {
        await new Promise(r => setTimeout(r, 500));
        currentState.downloadProgress = Math.min(currentState.downloadProgress + 10, 100);
        return {
            status: currentState.downloadProgress >= 100 ? 'completed' : 'processing',
            percent: currentState.downloadProgress,
            download_url: currentState.downloadProgress >= 100 ? 'https://example.com/video.mp4' : null
        };
    }

    // ============================================
    // UI COMPONENTS
    // ============================================
    function createVOTButton() {
        const existing = document.getElementById('vot-segmented-button');
        if (existing) return existing;

        const container = document.createElement('div');
        container.className = 'vot-segmented-button';
        container.id = 'vot-segmented-button';
        container.dataset.position = CONFIG.buttonPosition;
        container.dataset.direction = 'row';
        container.dataset.status = 'none';
        container.dataset.loading = 'false';

        // Translate button
        const translateBtn = document.createElement('button');
        translateBtn.className = 'vot-segment vot-translate-button';
        translateBtn.innerHTML = `<div class="vot-spinner"></div>${TRANSLATE_ICON}<span class="vot-segment-label">Translate</span>`;
        translateBtn.onclick = handleTranslateClick;

        // Separator
        const sep1 = document.createElement('div');
        sep1.className = 'vot-separator';

        // Download audio button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'vot-segment vot-segment-only-icon';
        downloadBtn.innerHTML = DOWNLOAD_ICON;
        downloadBtn.title = 'Download audio';
        downloadBtn.style.display = 'none';
        downloadBtn.onclick = handleDownloadAudioClick;

        // Download video button
        const downloadVideoBtn = document.createElement('button');
        downloadVideoBtn.className = 'vot-segment';
        downloadVideoBtn.id = 'vot-download-video-btn';
        downloadVideoBtn.innerHTML = `<span class="vot-segment-label">Download Video</span>`;
        downloadVideoBtn.style.display = 'none';
        downloadVideoBtn.onclick = handleDownloadVideoClick;

        // Separator 2
        const sep2 = document.createElement('div');
        sep2.className = 'vot-separator';
        sep2.id = 'vot-separator-dl';
        sep2.style.display = 'none';

        // PiP button
        const pipBtn = document.createElement('button');
        pipBtn.className = 'vot-segment vot-segment-only-icon';
        pipBtn.innerHTML = PIP_ICON;
        pipBtn.title = 'Picture in Picture';
        pipBtn.onclick = async () => {
            const video = document.querySelector('video');
            if (video) {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await video.requestPictureInPicture();
                }
            }
        };

        // Separator 3
        const sep3 = document.createElement('div');
        sep3.className = 'vot-separator';

        // Menu button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'vot-segment vot-segment-only-icon';
        menuBtn.innerHTML = MENU_ICON;
        menuBtn.title = 'Settings';
        menuBtn.onclick = () => alert('Settings: Use GM menu (Tampermonkey icon) to configure');

        container.append(translateBtn, sep1, downloadBtn, downloadVideoBtn, sep2, pipBtn, sep3, menuBtn);

        return container;
    }

    function updateButtonState() {
        const btn = document.getElementById('vot-segmented-button');
        if (!btn) return;

        const downloadVideoBtn = document.getElementById('vot-download-video-btn');
        const sepDl = document.getElementById('vot-separator-dl');

        if (currentState.isTranslating) {
            btn.dataset.loading = 'true';
            btn.dataset.status = 'none';
            if (downloadVideoBtn) {
                downloadVideoBtn.style.display = 'flex';
                downloadVideoBtn.querySelector('.vot-segment-label').textContent = 'Translating...';
            }
            if (sepDl) sepDl.style.display = 'block';
        } else if (currentState.isMakingVideo) {
            btn.dataset.loading = 'false';
            if (downloadVideoBtn) {
                downloadVideoBtn.style.display = 'flex';
                downloadVideoBtn.querySelector('.vot-segment-label').textContent = `Making Video ${currentState.downloadProgress}%`;
            }
        } else if (currentState.translationAudioUrl) {
            btn.dataset.loading = 'false';
            btn.dataset.status = 'success';
            if (downloadVideoBtn) {
                downloadVideoBtn.style.display = 'flex';
                downloadVideoBtn.querySelector('.vot-segment-label').textContent = 'Download Video';
            }
            if (sepDl) sepDl.style.display = 'block';
        } else {
            btn.dataset.loading = 'false';
            btn.dataset.status = 'none';
            if (downloadVideoBtn) downloadVideoBtn.style.display = 'none';
            if (sepDl) sepDl.style.display = 'none';
        }
    }

    function showQualitySelectionDialog(qualities) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'vot-quality-dialog';
            dialog.id = 'vot-quality-dialog';

            const qualityList = qualities.map((q, i) => `
                <label class="vot-quality-option">
                    <input type="radio" name="quality" value="${i}" ${i === 0 ? 'checked' : ''}>
                    <div class="vot-quality-label">${q.label}</div>
                    <div class="vot-quality-info">${q.resolution} @ ${q.fps}fps</div>
                </label>
            `).join('');

            dialog.innerHTML = `
                <div class="vot-quality-dialog-content">
                    <h3>Select Video Quality</h3>
                    <div class="vot-quality-list">
                        ${qualityList}
                    </div>
                    <div class="vot-dialog-buttons">
                        <button class="vot-dialog-btn secondary" id="vot-cancel-quality">Cancel</button>
                        <button class="vot-dialog-btn primary" id="vot-confirm-quality">Download</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            document.getElementById('vot-cancel-quality').onclick = () => {
                dialog.remove();
                resolve(null);
            };

            document.getElementById('vot-confirm-quality').onclick = () => {
                const selected = document.querySelector('input[name="quality"]:checked');
                const quality = selected ? qualities[parseInt(selected.value)] : null;
                dialog.remove();
                resolve(quality);
            };

            dialog.onclick = (e) => {
                if (e.target === dialog) {
                    dialog.remove();
                    resolve(null);
                }
            };
        });
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================
    async function handleTranslateClick() {
        const videoInfo = extractVideoInfo();
        if (!videoInfo.videoId) {
            alert('Could not detect video ID');
            return;
        }

        currentState.isTranslating = true;
        currentState.videoId = videoInfo.videoId;
        updateButtonState();

        try {
            const response = await requestTranslation(videoInfo.videoId, CONFIG.targetLanguage);

            if (response && response.job_id) {
                await pollTranslationStatus(response.job_id);
            } else {
                throw new Error('Failed to start translation');
            }
        } catch (error) {
            console.error('Translation error:', error);
            alert('Translation failed: ' + error.message);
            const btn = document.getElementById('vot-segmented-button');
            if (btn) btn.dataset.status = 'error';
        } finally {
            currentState.isTranslating = false;
            updateButtonState();
        }
    }

    async function pollTranslationStatus(jobId) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                const status = await checkTranslationStatus(jobId);

                if (!status) {
                    clearInterval(interval);
                    reject(new Error('Failed to check status'));
                    return;
                }

                if (status.status === 'completed') {
                    clearInterval(interval);
                    currentState.translationAudioUrl = status.audio_url;
                    currentState.translatedSegments = status.segments || [];
                    resolve(status);
                } else if (status.status === 'failed') {
                    clearInterval(interval);
                    reject(new Error(status.error || 'Translation failed'));
                }
            }, 2000);
        });
    }

    async function handleDownloadVideoClick() {
        if (currentState.isMakingVideo || currentState.isTranslating) return;

        const qualities = await getAvailableQualities(currentState.videoId);
        if (qualities.length === 0) {
            alert('Could not fetch video qualities');
            return;
        }

        const selectedQuality = await showQualitySelectionDialog(qualities);
        if (!selectedQuality) return;

        currentState.selectedQuality = selectedQuality;
        currentState.isMakingVideo = true;
        currentState.downloadProgress = 0;
        updateButtonState();

        try {
            const response = await startVideoDownload(currentState.videoId, selectedQuality);
            if (response && response.download_id) {
                await pollDownloadProgress(response.download_id);
            } else {
                throw new Error('Failed to start download');
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('Download failed: ' + error.message);
        } finally {
            currentState.isMakingVideo = false;
            currentState.downloadProgress = 0;
            updateButtonState();
        }
    }

    async function pollDownloadProgress(downloadId) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                const progress = await checkDownloadProgress(downloadId);

                if (!progress) {
                    clearInterval(interval);
                    reject(new Error('Failed to check progress'));
                    return;
                }

                currentState.downloadProgress = Math.round(progress.percent || 0);
                updateButtonState();

                if (progress.status === 'completed') {
                    clearInterval(interval);
                    if (progress.download_url) {
                        window.open(progress.download_url, '_blank');
                    }
                    resolve(progress);
                } else if (progress.status === 'failed') {
                    clearInterval(interval);
                    reject(new Error(progress.error || 'Download failed'));
                }
            }, 1000);
        });
    }

    async function handleDownloadAudioClick() {
        if (!currentState.translationAudioUrl) {
            alert('No translation available. Please translate first.');
            return;
        }
        window.open(currentState.translationAudioUrl, '_blank');
    }

    // ============================================
    // MAIN UI INJECTION - Like original VOT
    // ============================================
    function findVideoContainer() {
        // For YouTube, VOT uses the video's parent container
        const selectors = [
            '#movie_player',
            '.html5-video-player',
            '#player-container .ytd-player',
            'ytd-player #container'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) return el;
        }

        // Fallback: find video and use its parent
        const video = document.querySelector('video');
        if (video) {
            return video.closest('#movie_player, .html5-video-player') || video.parentElement;
        }
        return null;
    }

    function injectVOTButton() {
        const videoId = getVideoId();
        if (!videoId) {
            console.log('[VOT] No video ID, skipping injection');
            return false;
        }

        // Check if already injected
        if (document.getElementById('vot-segmented-button')) {
            console.log('[VOT] Already injected');
            return true;
        }

        console.log('[VOT] Attempting injection for video:', videoId);

        const container = findVideoContainer();
        if (container) {
            const button = createVOTButton();
            // Make container position-relative if it isn't
            const computedStyle = window.getComputedStyle(container);
            if (computedStyle.position === 'static') {
                container.style.position = 'relative';
            }
            container.appendChild(button);
            console.log('[VOT] Successfully injected into:', container.tagName, container.id || container.className);
            return true;
        }

        console.log('[VOT] Could not find video container');
        return false;
    }

    // ============================================
    // OBSERVER & INIT
    // ============================================
    let lastVideoId = null;
    let injectionAttempts = 0;
    const MAX_ATTEMPTS = 15;

    function tryInjectWithRetry() {
        if (injectionAttempts >= MAX_ATTEMPTS) {
            console.log('[VOT] Max injection attempts reached');
            return;
        }

        injectionAttempts++;
        const success = injectVOTButton();

        if (!success) {
            console.log(`[VOT] Retry ${injectionAttempts}/${MAX_ATTEMPTS} in 500ms...`);
            setTimeout(tryInjectWithRetry, 500);
        } else {
            injectionAttempts = 0;
        }
    }

    function onPageChange() {
        const videoId = getVideoId();

        if (videoId && videoId !== lastVideoId) {
            console.log('[VOT] Video changed to:', videoId);
            lastVideoId = videoId;
            injectionAttempts = 0;

            // Reset state
            currentState = {
                videoId: videoId,
                isTranslating: false,
                isMakingVideo: false,
                downloadProgress: 0,
                translationAudioUrl: null,
                translatedSegments: [],
                availableQualities: [],
                selectedQuality: null
            };

            // Remove old button
            const old = document.getElementById('vot-segmented-button');
            if (old) old.remove();

            // Try to inject with retries
            tryInjectWithRetry();
        } else if (videoId && !document.getElementById('vot-segmented-button')) {
            // Video hasn't changed but button is missing - reinject
            console.log('[VOT] Button missing, reinjecting...');
            tryInjectWithRetry();
        }
    }

    function init() {
        console.log('[VOT] Init started');
        injectStyles();

        // Watch for URL and DOM changes
        const observer = new MutationObserver(() => {
            onPageChange();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also watch for navigation (YouTube SPA)
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                console.log('[VOT] URL changed');
                setTimeout(onPageChange, 500);
            }
        }).observe(document, { subtree: true, childList: true });

        // Initial check
        setTimeout(onPageChange, 1500);
        console.log('[VOT] Init complete');
    }

    // GM menu commands
    GM_registerMenuCommand('Set Button Position: Default', () => {
        GM_setValue('vot_button_position', 'default');
        location.reload();
    });
    GM_registerMenuCommand('Set Button Position: Left', () => {
        GM_setValue('vot_button_position', 'left');
        location.reload();
    });
    GM_registerMenuCommand('Set Button Position: Right', () => {
        GM_setValue('vot_button_position', 'right');
        location.reload();
    });
    GM_registerMenuCommand('Set Button Position: Bottom', () => {
        GM_setValue('vot_button_position', 'bottom');
        location.reload();
    });

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
