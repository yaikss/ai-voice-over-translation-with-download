// ==UserScript==
// @name         VOT YouTube Translator
// @namespace    http://tampermonkey.net/
// @version      2.0
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

    console.log('[VOT] Script loaded v2.0');

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
    // UI STYLES - VOT-style segmented button
    // ============================================
    const STYLES = `
        .vot-segmented-button {
            --vot-primary-rgb: 33, 150, 243;
            --vot-surface-rgb: 255, 255, 255;
            --vot-onsurface-rgb: 0, 0, 0;
            --vot-border-color: rgba(0, 0, 0, 0.1);
            --vot-radius-s: 8px;
            --vot-shadow-1: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
            --vot-space-2: 8px;

            opacity: 1 !important;
            pointer-events: auto !important;
            overflow: hidden;
            display: inline-flex !important;
            align-items: center;
            height: 36px;
            background: rgb(var(--vot-surface-rgb));
            color: rgba(var(--vot-onsurface-rgb), 0.87);
            fill: rgba(var(--vot-onsurface-rgb), 0.87);
            border: 1px solid var(--vot-border-color) !important;
            border-radius: var(--vot-radius-s) !important;
            box-shadow: var(--vot-shadow-1) !important;
            font-family: "YouTube Noto", Roboto, Arial, sans-serif !important;
            font-size: 14px;
            line-height: 1.5;
            vertical-align: middle;
            margin-left: 8px;
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
            border: none !important;
            outline: none;
            cursor: pointer;
            font: inherit;
        }

        .vot-segmented-button .vot-segment:hover {
            background-color: rgba(var(--vot-onsurface-rgb), 0.04);
        }

        .vot-segmented-button .vot-segment-only-icon {
            min-width: 36px;
            padding: 0 !important;
        }

        .vot-segmented-button .vot-segment-label {
            margin-left: var(--vot-space-2) !important;
            white-space: nowrap;
            font-weight: 400 !important;
        }

        .vot-segmented-button[data-status="success"] .vot-translate-button {
            color: rgb(var(--vot-primary-rgb));
            fill: rgb(var(--vot-primary-rgb));
        }

        .vot-segmented-button[data-status="error"] .vot-translate-button {
            color: #f28b82;
            fill: #f28b82;
        }

        .vot-segmented-button[data-loading="true"] .vot-spinner {
            display: block !important;
        }

        .vot-segmented-button[data-loading="true"] .vot-translate-icon {
            display: none !important;
        }

        .vot-segmented-button svg {
            width: 20px;
            height: 20px;
            fill: inherit;
        }

        .vot-spinner {
            width: 16px;
            height: 16px;
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
        }

        .vot-quality-option:hover {
            background: #3a3a3a;
        }

        .vot-quality-option input {
            margin-right: 12px;
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
    }

    function getVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    // ============================================
    // SERVER API (MOCK)
    // ============================================
    async function requestTranslation(videoId) {
        return { job_id: 'mock-' + Date.now() };
    }

    async function checkTranslationStatus(jobId) {
        await new Promise(r => setTimeout(r, 1500));
        return { status: 'completed', audio_url: 'https://example.com/audio.mp3' };
    }

    async function getAvailableQualities(videoId) {
        return [
            { label: '1080p', format: '137+140', resolution: '1920x1080', fps: 60 },
            { label: '720p', format: '22', resolution: '1280x720', fps: 30 },
            { label: '480p', format: '135+140', resolution: '854x480', fps: 30 }
        ];
    }

    async function startVideoDownload(videoId, quality) {
        return { download_id: 'mock-dl-' + Date.now() };
    }

    async function checkDownloadProgress(downloadId) {
        await new Promise(r => setTimeout(r, 500));
        currentState.downloadProgress = Math.min(currentState.downloadProgress + 20, 100);
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
        const container = document.createElement('div');
        container.className = 'vot-segmented-button';
        container.id = 'vot-segmented-button';
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

        // Download audio
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'vot-segment vot-segment-only-icon';
        downloadBtn.innerHTML = DOWNLOAD_ICON;
        downloadBtn.title = 'Download audio';
        downloadBtn.style.display = 'none';
        downloadBtn.onclick = () => {
            if (currentState.translationAudioUrl) {
                window.open(currentState.translationAudioUrl, '_blank');
            }
        };

        // Download video
        const downloadVideoBtn = document.createElement('button');
        downloadVideoBtn.className = 'vot-segment';
        downloadVideoBtn.id = 'vot-download-video-btn';
        downloadVideoBtn.innerHTML = `<span class="vot-segment-label">Download Video</span>`;
        downloadVideoBtn.style.display = 'none';
        downloadVideoBtn.onclick = handleDownloadVideoClick;

        // Separator
        const sep2 = document.createElement('div');
        sep2.className = 'vot-separator';
        sep2.id = 'vot-separator-dl';
        sep2.style.display = 'none';

        // PiP
        const pipBtn = document.createElement('button');
        pipBtn.className = 'vot-segment vot-segment-only-icon';
        pipBtn.innerHTML = PIP_ICON;
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

        // Separator
        const sep3 = document.createElement('div');
        sep3.className = 'vot-separator';

        // Menu
        const menuBtn = document.createElement('button');
        menuBtn.className = 'vot-segment vot-segment-only-icon';
        menuBtn.innerHTML = MENU_ICON;
        menuBtn.onclick = () => alert('Settings: Use Tampermonkey menu');

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

    function showQualityDialog(qualities) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'vot-quality-dialog';

            const qualityList = qualities.map((q, i) => `
                <label class="vot-quality-option">
                    <input type="radio" name="quality" value="${i}" ${i === 0 ? 'checked' : ''}>
                    <div style="flex:1">${q.label}</div>
                    <div style="font-size:12px;color:#aaa">${q.resolution}</div>
                </label>
            `).join('');

            dialog.innerHTML = `
                <div class="vot-quality-dialog-content">
                    <h3>Select Video Quality</h3>
                    <div class="vot-quality-list">${qualityList}</div>
                    <div class="vot-dialog-buttons">
                        <button class="vot-dialog-btn secondary" id="vot-cancel">Cancel</button>
                        <button class="vot-dialog-btn primary" id="vot-confirm">Download</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            document.getElementById('vot-cancel').onclick = () => {
                dialog.remove();
                resolve(null);
            };

            document.getElementById('vot-confirm').onclick = () => {
                const selected = document.querySelector('input[name="quality"]:checked');
                const quality = selected ? qualities[parseInt(selected.value)] : null;
                dialog.remove();
                resolve(quality);
            };
        });
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================
    async function handleTranslateClick() {
        const videoId = getVideoId();
        if (!videoId) return;

        currentState.isTranslating = true;
        currentState.videoId = videoId;
        updateButtonState();

        try {
            const response = await requestTranslation(videoId);
            if (response?.job_id) {
                await pollTranslationStatus(response.job_id);
            }
        } catch (error) {
            console.error(error);
            document.getElementById('vot-segmented-button').dataset.status = 'error';
        } finally {
            currentState.isTranslating = false;
            updateButtonState();
        }
    }

    async function pollTranslationStatus(jobId) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                const status = await checkTranslationStatus(jobId);
                if (status.status === 'completed') {
                    clearInterval(interval);
                    currentState.translationAudioUrl = status.audio_url;
                    resolve(status);
                } else if (status.status === 'failed') {
                    clearInterval(interval);
                    reject(new Error('Failed'));
                }
            }, 2000);
        });
    }

    async function handleDownloadVideoClick() {
        if (currentState.isMakingVideo || currentState.isTranslating) return;

        const qualities = await getAvailableQualities(currentState.videoId);
        const selected = await showQualityDialog(qualities);
        if (!selected) return;

        currentState.isMakingVideo = true;
        currentState.downloadProgress = 0;
        updateButtonState();

        try {
            const response = await startVideoDownload(currentState.videoId, selected);
            if (response?.download_id) {
                await pollDownloadProgress(response.download_id);
            }
        } catch (error) {
            console.error(error);
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
                currentState.downloadProgress = Math.round(progress.percent);
                updateButtonState();

                if (progress.status === 'completed') {
                    clearInterval(interval);
                    if (progress.download_url) {
                        window.open(progress.download_url, '_blank');
                    }
                    resolve(progress);
                } else if (progress.status === 'failed') {
                    clearInterval(interval);
                    reject(new Error('Failed'));
                }
            }, 1000);
        });
    }

    // ============================================
    // INJECTION - Proven method from working version
    // ============================================
    function injectVOTButton() {
        const videoId = getVideoId();
        if (!videoId) return false;

        if (document.getElementById('vot-segmented-button')) return true;

        // Try YouTube menu bar targets (where Share/Save buttons are)
        const targets = [
            '#menu ytd-button-renderer',
            '#top-level-buttons-computed',
            '#menu > ytd-menu-renderer > #top-level-buttons',
            'ytd-watch-metadata #menu',
            '#actions > #menu',
            'ytd-menu-renderer[has-items]'
        ];

        for (const selector of targets) {
            const target = document.querySelector(selector);
            if (target) {
                const button = createVOTButton();
                target.appendChild(button);
                console.log('[VOT] Injected into', selector);
                return true;
            }
        }

        // Fallback: inject near title
        const titleArea = document.querySelector('ytd-watch-metadata #title, h1.ytd-watch-metadata');
        if (titleArea) {
            const button = createVOTButton();
            button.style.marginTop = '12px';
            titleArea.parentNode.insertBefore(button, titleArea.nextSibling);
            console.log('[VOT] Injected near title');
            return true;
        }

        return false;
    }

    // ============================================
    // INIT
    // ============================================
    let lastVideoId = null;

    function onPageChange() {
        const videoId = getVideoId();

        if (videoId && videoId !== lastVideoId) {
            lastVideoId = videoId;
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

            const old = document.getElementById('vot-segmented-button');
            if (old) old.remove();

            // Retry injection
            let attempts = 0;
            const tryInject = () => {
                if (attempts++ > 15) return;
                if (!injectVOTButton()) {
                    setTimeout(tryInject, 500);
                }
            };
            tryInject();
        } else if (videoId && !document.getElementById('vot-segmented-button')) {
            injectVOTButton();
        }
    }

    function init() {
        injectStyles();

        // Watch for changes
        new MutationObserver(onPageChange).observe(document.body, {
            childList: true,
            subtree: true
        });

        // Watch for URL changes (SPA)
        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(onPageChange, 500);
            }
        }).observe(document, { subtree: true, childList: true });

        // Initial
        setTimeout(onPageChange, 1500);
    }

    // Menu commands
    GM_registerMenuCommand('Position: Default', () => {
        GM_setValue('vot_button_position', 'default');
        location.reload();
    });
    GM_registerMenuCommand('Position: Left', () => {
        GM_setValue('vot_button_position', 'left');
        location.reload();
    });
    GM_registerMenuCommand('Position: Right', () => {
        GM_setValue('vot_button_position', 'right');
        location.reload();
    });
    GM_registerMenuCommand('Position: Bottom', () => {
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
