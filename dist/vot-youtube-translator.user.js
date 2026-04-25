// ==UserScript==
// @name         VOT YouTube Translator
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  YouTube video translation with download feature
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
    // UI STYLES
    // ============================================
    const STYLES = `
        .vot-container {
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-left: 8px !important;
        }

        .vot-container[data-position="bottom"] {
            position: fixed !important;
            bottom: 80px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 999999 !important;
            margin-left: 0 !important;
        }

        .vot-container[data-position="bottom"] .vot-btn {
            box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
        }

        .vot-btn {
            background: #ff0000 !important;
            color: white !important;
            border: none !important;
            border-radius: 18px !important;
            padding: 8px 16px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            transition: all 0.2s !important;
            font-family: "YouTube Noto", Roboto, Arial, sans-serif !important;
            height: 36px !important;
        }

        .vot-btn:hover {
            background: #cc0000 !important;
            transform: scale(1.05) !important;
        }

        .vot-btn:disabled {
            background: #666 !important;
            cursor: not-allowed !important;
            transform: none !important;
        }

        .vot-btn.secondary {
            background: #3ea6ff !important;
        }

        .vot-btn.secondary:hover {
            background: #2a8fd8 !important;
        }

        .vot-btn.processing {
            background: #ff9500 !important;
        }

        .vot-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: vot-spin 1s linear infinite;
        }

        @keyframes vot-spin {
            to { transform: rotate(360deg); }
        }

        /* Quality Selection Dialog */
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
            z-index: 999999;
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
    function createTranslateButton() {
        const btn = document.createElement('button');
        btn.className = 'vot-btn';
        btn.id = 'vot-translate-btn';
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
            </svg>
            <span>Translate</span>
        `;
        btn.onclick = handleTranslateClick;
        return btn;
    }

    function createDownloadVideoButton() {
        const btn = document.createElement('button');
        btn.className = 'vot-btn secondary';
        btn.id = 'vot-download-video-btn';
        btn.innerHTML = '<span>Download Video</span>';
        btn.style.display = 'none';
        btn.onclick = handleDownloadVideoClick;
        return btn;
    }

    function createDownloadAudioButton() {
        const btn = document.createElement('button');
        btn.className = 'vot-btn secondary';
        btn.id = 'vot-download-audio-btn';
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
            </svg>
            <span>Audio</span>
        `;
        btn.style.display = 'none';
        btn.onclick = handleDownloadAudioClick;
        return btn;
    }

    function updateTranslateButtonState() {
        const btn = document.getElementById('vot-translate-btn');
        if (!btn) return;

        if (currentState.isTranslating) {
            btn.disabled = true;
            btn.innerHTML = `<div class="vot-spinner"></div><span>Translating...</span>`;
            btn.classList.add('processing');
        } else {
            btn.disabled = false;
            btn.classList.remove('processing');
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                </svg>
                <span>Translate</span>
            `;
        }
    }

    function updateDownloadVideoButtonState() {
        const btn = document.getElementById('vot-download-video-btn');
        if (!btn) return;

        if (currentState.isMakingVideo) {
            btn.disabled = true;
            btn.classList.add('processing');
            btn.innerHTML = `
                <div class="vot-spinner" style="width:12px;height:12px;"></div>
                <span>Making Video ${currentState.downloadProgress}%</span>
            `;
        } else if (currentState.isTranslating) {
            btn.disabled = true;
            btn.classList.add('processing');
            btn.innerHTML = `<span>Translating...</span>`;
        } else if (currentState.translationAudioUrl) {
            btn.disabled = false;
            btn.classList.remove('processing');
            btn.innerHTML = `<span>Download Video</span>`;
            btn.style.display = 'inline-flex';
        } else {
            btn.style.display = 'none';
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
        updateTranslateButtonState();
        updateDownloadVideoButtonState();

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
        } finally {
            currentState.isTranslating = false;
            updateTranslateButtonState();
            updateDownloadVideoButtonState();
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
        updateDownloadVideoButtonState();

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
            updateDownloadVideoButtonState();
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
                updateDownloadVideoButtonState();

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
    // MAIN UI INJECTION - ROBUST VERSION
    // ============================================
    function createVOTContainer() {
        const existing = document.getElementById('vot-container');
        if (existing) {
            console.log('[VOT] Container already exists');
            return existing;
        }

        const container = document.createElement('div');
        container.className = 'vot-container';
        container.id = 'vot-container';
        container.setAttribute('data-position', CONFIG.buttonPosition);

        container.appendChild(createTranslateButton());
        container.appendChild(createDownloadVideoButton());
        container.appendChild(createDownloadAudioButton());

        console.log('[VOT] Container created');
        return container;
    }

    function updateButtonPosition() {
        const container = document.getElementById('vot-container');
        if (container) {
            container.setAttribute('data-position', CONFIG.buttonPosition);
        }
    }

    function findBestInjectionTarget() {
        // YouTube's button bar selectors - order matters
        const selectors = [
            // New 2024 layout - actions bar
            '#actions ytd-menu-renderer',
            '#actions #menu',
            'ytd-watch-metadata #actions #menu',
            // Alternative layouts
            '#top-level-buttons-computed',
            '#menu > ytd-menu-renderer',
            '#menu ytd-button-renderer:first-child',
            // Older layouts
            'ytd-menu-renderer[has-items]',
            '#info #menu',
            // Video primary info
            'ytd-watch-metadata #top-level-buttons',
            'ytd-video-primary-info-renderer #menu',
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                console.log('[VOT] Found target:', selector);
                return el;
            }
        }

        // Try to find by text content (Share button area)
        const allMenus = document.querySelectorAll('ytd-menu-renderer');
        for (const menu of allMenus) {
            if (menu.textContent.includes('Share') || menu.textContent.includes('Clip')) {
                console.log('[VOT] Found target by content: ytd-menu-renderer');
                return menu;
            }
        }

        console.log('[VOT] No standard target found');
        return null;
    }

    function injectVOTButtons() {
        const videoId = getVideoId();
        if (!videoId) {
            console.log('[VOT] No video ID, skipping injection');
            return false;
        }

        // Check if already injected
        if (document.getElementById('vot-container')) {
            console.log('[VOT] Already injected');
            return true;
        }

        console.log('[VOT] Attempting injection for video:', videoId);

        const target = findBestInjectionTarget();
        if (target) {
            const container = createVOTContainer();
            target.appendChild(container);
            updateButtonPosition();
            console.log('[VOT] Successfully injected!');
            return true;
        }

        // Fallback: inject below title
        const titleArea = document.querySelector('ytd-watch-metadata #title, h1.ytd-watch-metadata, #container h1');
        if (titleArea) {
            const container = createVOTContainer();
            container.style.marginTop = '12px';
            titleArea.parentNode.insertBefore(container, titleArea.nextSibling);
            updateButtonPosition();
            console.log('[VOT] Injected in fallback position');
            return true;
        }

        console.log('[VOT] Could not find injection point');
        return false;
    }

    // ============================================
    // OBSERVER & INIT
    // ============================================
    let lastVideoId = null;
    let injectionAttempts = 0;
    const MAX_ATTEMPTS = 10;

    function tryInjectWithRetry() {
        if (injectionAttempts >= MAX_ATTEMPTS) {
            console.log('[VOT] Max injection attempts reached');
            return;
        }

        injectionAttempts++;
        const success = injectVOTButtons();

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

            // Remove old container
            const old = document.getElementById('vot-container');
            if (old) old.remove();

            // Try to inject with retries
            tryInjectWithRetry();
        } else if (videoId && !document.getElementById('vot-container')) {
            // Video hasn't changed but buttons are missing - reinject
            console.log('[VOT] Buttons missing, reinjecting...');
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
        setTimeout(onPageChange, 1000);
        console.log('[VOT] Init complete');
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
