/**
 * EZUI Client Script - Dynamic DOM Builder
 * Builds entire page from data.json
 * Enables: reordering, adding, deleting components
 */

(function () {
    'use strict';

    const isInIframe = window.self !== window.top;
    let componentsData = null;
    let currentLang = 'en';

    // Initialize
    async function init() {
        console.log('[EZUI] Initializing dynamic DOM builder...');

        // Load data.json
        try {
            const response = await fetch('./data.json');
            componentsData = await response.json();
            currentLang = componentsData.language || 'en';
        } catch (err) {
            console.error('[EZUI] Failed to load data.json:', err);
            document.getElementById('root').innerHTML = '<p style="padding:20px;color:red;">Error loading data.json</p>';
            return;
        }

        // Build the DOM from JSON
        buildDOM();

        // Enable edit mode if in iframe
        if (isInIframe) {
            enableEditMode();
        }

        console.log('[EZUI] Ready! Built', componentsData.components.length, 'components');
    }

    // Build entire DOM from JSON
    function buildDOM() {
        const root = document.getElementById('root');
        if (!root) return;

        // Clear existing content
        root.innerHTML = '';

        // Find root component (parentId: null)
        const rootComponent = componentsData.components.find(c => c.parentId === null);
        if (!rootComponent) {
            console.error('[EZUI] No root component found (parentId: null)');
            return;
        }

        // Recursively build elements
        const rootElement = buildElement(rootComponent);
        if (rootElement) {
            root.appendChild(rootElement);
        }
    }

    // Build single element and its children
    function buildElement(component) {
        // Create element
        const el = document.createElement(component.elementType || 'div');

        // Set data attributes
        el.dataset.id = component.id;
        el.dataset.ezuiCms = component.ezuiCms;

        // Apply styles
        if (component.styles) {
            Object.entries(component.styles).forEach(([key, value]) => {
                el.style[key] = value;
            });
        }

        // Apply attributes (href, src, etc.)
        if (component.attributes) {
            Object.entries(component.attributes).forEach(([key, value]) => {
                el.setAttribute(key, value);
            });
        }

        // Find children (components with parentId === this component's id)
        const children = componentsData.components
            .filter(c => c.parentId === component.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // If no children, set text content
        if (children.length === 0) {
            if (component.content && component.content[currentLang]) {
                el.textContent = component.content[currentLang];
            }
        } else {
            // Build children recursively
            children.forEach(child => {
                const childEl = buildElement(child);
                if (childEl) {
                    el.appendChild(childEl);
                }
            });
        }

        return el;
    }

    // Enable edit mode (when in iframe)
    function enableEditMode() {
        console.log('[EZUI] Edit mode enabled');

        // Inject selection styles
        const style = document.createElement('style');
        style.textContent = `
            [data-id] {
                transition: outline 0.15s ease !important;
            }
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

        // Listen for messages from parent editor
        window.addEventListener('message', handleMessage);

        // Notify parent that we're ready
        window.parent.postMessage({
            source: 'ezui-cms',
            type: 'ezui-ready',
            data: {
                elementsCount: componentsData.components.length,
                language: currentLang
            }
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

        // Find component data
        const componentId = parseInt(el.dataset.id);
        const component = componentsData.components.find(c => c.id === componentId);

        // Send to parent editor
        window.parent.postMessage({
            source: 'ezui-cms',
            type: 'element-selected',
            data: {
                id: componentId,
                ezuiCms: el.dataset.ezuiCms || '',
                tagName: el.tagName.toLowerCase(),
                textContent: el.textContent || '',
                parentId: component?.parentId,
                order: component?.order
            }
        }, '*');

        console.log('[EZUI] Selected #' + componentId);
    }

    // Handle messages from parent editor
    function handleMessage(e) {
        if (e.data?.source !== 'visual-editor') return;

        const { type, data } = e.data;
        console.log('[EZUI] Received:', type, data);

        switch (type) {
            case 'update-content':
                updateContent(data.id, data.content);
                break;
            case 'update-style':
                updateStyle(data.id, data.styleKey, data.value);
                break;
            case 'highlight':
                highlightElement(data.id);
                break;
            case 'clear-highlight':
                clearHighlight();
                break;
            case 'reorder':
                reorderComponent(data.id, data.newOrder);
                break;
            case 'add-component':
                addComponent(data);
                break;
            case 'delete-component':
                deleteComponent(data.id);
                break;
            case 'rebuild':
                // Rebuild entire DOM (after major changes)
                if (data.components) {
                    componentsData.components = data.components;
                }
                buildDOM();
                enableEditModeStyles();
                break;
        }
    }

    // Update content
    function updateContent(id, content) {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el && !el.querySelector('[data-id]')) {
            el.textContent = content;
        }
    }

    // Update style
    function updateStyle(id, styleKey, value) {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el) {
            el.style[styleKey] = value;
        }
    }

    // Highlight element
    function highlightElement(id) {
        clearHighlight();
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el) {
            el.classList.add('ezui-selected');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Clear highlight
    function clearHighlight() {
        document.querySelectorAll('.ezui-selected').forEach(s => s.classList.remove('ezui-selected'));
    }

    // Reorder component (change its order within parent)
    function reorderComponent(id, newOrder) {
        const comp = componentsData.components.find(c => c.id === id);
        if (!comp) return;

        comp.order = newOrder;
        buildDOM();
        enableEditModeStyles();
    }

    // Add new component
    function addComponent(newComp) {
        componentsData.components.push(newComp);
        buildDOM();
        enableEditModeStyles();
    }

    // Delete component
    function deleteComponent(id) {
        // Remove component and all its children
        const idsToRemove = [id];
        const findChildren = (parentId) => {
            componentsData.components
                .filter(c => c.parentId === parentId)
                .forEach(c => {
                    idsToRemove.push(c.id);
                    findChildren(c.id);
                });
        };
        findChildren(id);

        componentsData.components = componentsData.components.filter(c => !idsToRemove.includes(c.id));
        buildDOM();
        enableEditModeStyles();
    }

    // Re-enable edit mode styles after rebuild
    function enableEditModeStyles() {
        if (!isInIframe) return;
        // Styles are already in head, just need to re-attach handlers
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
