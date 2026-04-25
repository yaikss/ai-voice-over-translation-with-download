// ==UserScript==
// @name         VOT-Fork-Test
// @namespace    vot-fork-test
// @version      1.0
// @description  Test version
// @match        *://*.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log('[VOT-FORK-TEST] Script loaded!');
    
    // Add a visible button
    const btn = document.createElement('button');
    btn.textContent = 'VOT FORK TEST';
    btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:red;color:white;padding:10px;font-weight:bold;';
    document.body.appendChild(btn);
    
    console.log('[VOT-FORK-TEST] Button added!');
})();
