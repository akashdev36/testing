/**
 * EZUI Client Script
 * Loads all content and styles from data.json
 * Enables visual editing when inside an iframe
 */

(function () {
    'use strict';

    const isInIframe = window.self !== window.top;
    let componentsData = null;
    let currentLang = 'en';

    // Initialize
    async function init() {
        console.log('[EZUI] Loading content from data.json...');

        // Load and apply all content/styles from JSON
        await loadAndApplyFromJSON();

        // If in iframe, enable edit mode
        if (isInIframe) {
            enableEditMode();
        }
    }

    // Load data.json and apply to DOM
    async function loadAndApplyFromJSON() {
        try {
            const response = await fetch('./data.json');
            componentsData = await response.json();
            currentLang = componentsData.language || 'en';

            if (!componentsData.components) {
                console.error('[EZUI] No components in data.json');
                return;
            }

            // Apply content and styles to each element
            componentsData.components.forEach(comp => {
                const el = document.querySelector(`[data-id="${comp.id}"]`);
                if (!el) return;

                // Apply styles
                if (comp.styles) {
                    Object.entries(comp.styles).forEach(([key, value]) => {
                        el.style[key] = value;
                    });
                }

                // Apply content (only for leaf elements without child data-id elements)
                if (comp.content && comp.content[currentLang]) {
                    const hasChildDataId = el.querySelector('[data-id]');
                    if (!hasChildDataId) {
                        el.textContent = comp.content[currentLang];
                    }
                }

                // Apply attributes (like href)
                if (comp.attributes) {
                    Object.entries(comp.attributes).forEach(([key, value]) => {
                        el.setAttribute(key, value);
                    });
                }
            });

            console.log('[EZUI] Loaded', componentsData.components.length, 'components from JSON');
        } catch (err) {
            console.error('[EZUI] Failed to load data.json:', err);
        }
    }

    // Enable edit mode (when in iframe)
    function enableEditMode() {
        console.log('[EZUI] Edit mode enabled');

        // Inject selection styles
        const style = document.createElement('style');
        style.textContent = `
            [data-id] { transition: outline 0.15s ease !important; }
            [data-id]:hover {
                outline: 2px dashed #8B5CF6 !important;
                outline-offset: 2px !important;
                cursor: pointer !important;
            }
            [data-id].ezui-selected {
                outline: 3px solid #3B82F6 !important;
                outline-offset: 2px !important;
            }
        `;
        document.head.appendChild(style);

        // Handle clicks
        document.addEventListener('click', handleClick, true);

        // Listen for messages from editor
        window.addEventListener('message', handleMessage);

        // Notify parent
        window.parent.postMessage({
            source: 'ezui-cms',
            type: 'ezui-ready',
            data: { elementsCount: document.querySelectorAll('[data-id]').length }
        }, '*');
    }

    // Handle click on element
    function handleClick(e) {
        let el = e.target;
        while (el && !el.dataset?.id) {
            el = el.parentElement;
        }
        if (!el || !el.dataset.id) return;

        e.preventDefault();
        e.stopPropagation();

        // Clear previous selection
        document.querySelectorAll('.ezui-selected').forEach(s => s.classList.remove('ezui-selected'));
        el.classList.add('ezui-selected');

        // Send to parent
        window.parent.postMessage({
            source: 'ezui-cms',
            type: 'element-selected',
            data: {
                id: parseInt(el.dataset.id),
                ezuiCms: el.dataset.ezuiCms || '',
                tagName: el.tagName.toLowerCase(),
                textContent: el.textContent || ''
            }
        }, '*');

        console.log('[EZUI] Selected #' + el.dataset.id);
    }

    // Handle messages from parent editor
    function handleMessage(e) {
        if (e.data?.source !== 'visual-editor') return;

        const { type, data } = e.data;
        const el = document.querySelector(`[data-id="${data.id}"]`);
        if (!el && type !== 'clear-highlight') return;

        switch (type) {
            case 'update-content':
                if (!el.querySelector('[data-id]')) {
                    el.textContent = data.content;
                }
                break;
            case 'update-style':
                el.style[data.styleKey] = data.value;
                break;
            case 'highlight':
                document.querySelectorAll('.ezui-selected').forEach(s => s.classList.remove('ezui-selected'));
                el.classList.add('ezui-selected');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
            case 'clear-highlight':
                document.querySelectorAll('.ezui-selected').forEach(s => s.classList.remove('ezui-selected'));
                break;
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
