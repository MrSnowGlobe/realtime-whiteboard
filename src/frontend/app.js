import {
    MESSAGE_TYPES,
    TOOL_TYPES,
    ELEMENT_TYPES,
    COLORS,
    HIGHLIGHTER_COLORS,
    CANVAS_CONFIG,
    DRAWING_CONFIG,
    TEXT_CONFIG,
    IMAGE_CONFIG,
    PERFORMANCE
} from './constants.js';

/**
 * Main Application Class
 */
class WhiteboardApp {
    constructor() {
        this.canvas = null;
        this.ws = null;
        this.sessionId = null;
        this.userId = null;
        this.currentUser = null;
        this.currentTool = TOOL_TYPES.PEN;
        this.currentColor = DRAWING_CONFIG.DEFAULT_COLOR;
        this.currentStrokeWidth = DRAWING_CONFIG.DEFAULT_STROKE_WIDTH;
        this.currentOpacity = DRAWING_CONFIG.DEFAULT_OPACITY;
        this.isDrawing = false;
        this.users = new Map();
        this.cursors = new Map();
        this.elements = new Map();
        this.cursorThrottle = null;

        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Get or create session ID
            this.sessionId = this.getSessionId();

            if (!this.sessionId) {
                await this.createSession();
            }

            // Initialize canvas
            this.initCanvas();

            // Setup UI event listeners
            this.setupEventListeners();

            // Connect to WebSocket
            await this.connectWebSocket();

            // Hide loading overlay
            document.getElementById('loading-overlay').style.display = 'none';

        } catch (error) {
            console.error('Error initializing app:', error);
            alert('Failed to initialize whiteboard. Please refresh the page.');
        }
    }

    /**
     * Get session ID from URL or localStorage
     */
    getSessionId() {
        const path = window.location.pathname;
        const match = path.match(/\/board\/([^/]+)/);

        if (match) {
            return match[1];
        }

        return localStorage.getItem('sessionId');
    }

    /**
     * Create a new session
     */
    async createSession() {
        const response = await fetch('/api/session/create', {
            method: 'POST'
        });

        const data = await response.json();
        this.sessionId = data.sessionId;

        localStorage.setItem('sessionId', this.sessionId);
        window.history.pushState({}, '', `/board/${this.sessionId}`);
    }

    /**
     * Initialize Fabric.js canvas
     */
    initCanvas() {
        this.canvas = new fabric.Canvas('canvas', {
            width: window.innerWidth,
            height: window.innerHeight - 60, // Account for toolbar
            backgroundColor: CANVAS_CONFIG.BACKGROUND,
            isDrawingMode: false,
            selection: true
        });

        // Enable free drawing for pen tool
        this.canvas.freeDrawingBrush.color = this.currentColor;
        this.canvas.freeDrawingBrush.width = this.currentStrokeWidth;

        // Handle canvas events
        this.setupCanvasEvents();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.setDimensions({
                width: window.innerWidth,
                height: window.innerHeight - 60
            });
        });
    }

    /**
     * Setup canvas event listeners
     */
    setupCanvasEvents() {
        let startX, startY, currentShape;

        // Mouse down
        this.canvas.on('mouse:down', (event) => {
            this.isDrawing = true;
            const pointer = this.canvas.getPointer(event.e);
            startX = pointer.x;
            startY = pointer.y;

            // Handle different tools
            switch (this.currentTool) {
                case TOOL_TYPES.LINE:
                    currentShape = new fabric.Line([startX, startY, startX, startY], {
                        stroke: this.currentColor,
                        strokeWidth: this.currentStrokeWidth,
                        opacity: this.currentOpacity
                    });
                    this.canvas.add(currentShape);
                    break;

                case TOOL_TYPES.RECTANGLE:
                    currentShape = new fabric.Rect({
                        left: startX,
                        top: startY,
                        width: 0,
                        height: 0,
                        fill: 'transparent',
                        stroke: this.currentColor,
                        strokeWidth: this.currentStrokeWidth,
                        opacity: this.currentOpacity
                    });
                    this.canvas.add(currentShape);
                    break;

                case TOOL_TYPES.CIRCLE:
                    currentShape = new fabric.Circle({
                        left: startX,
                        top: startY,
                        radius: 0,
                        fill: 'transparent',
                        stroke: this.currentColor,
                        strokeWidth: this.currentStrokeWidth,
                        opacity: this.currentOpacity
                    });
                    this.canvas.add(currentShape);
                    break;

                case TOOL_TYPES.TEXT:
                    this.addTextBox(startX, startY);
                    break;
            }
        });

        // Mouse move
        this.canvas.on('mouse:move', (event) => {
            const pointer = this.canvas.getPointer(event.e);

            // Send cursor position
            this.sendCursorPosition(pointer.x, pointer.y);

            if (!this.isDrawing) return;

            switch (this.currentTool) {
                case TOOL_TYPES.LINE:
                    if (currentShape) {
                        currentShape.set({
                            x2: pointer.x,
                            y2: pointer.y
                        });
                        this.canvas.renderAll();
                    }
                    break;

                case TOOL_TYPES.RECTANGLE:
                    if (currentShape) {
                        const width = pointer.x - startX;
                        const height = pointer.y - startY;
                        currentShape.set({
                            width: Math.abs(width),
                            height: Math.abs(height),
                            left: width < 0 ? pointer.x : startX,
                            top: height < 0 ? pointer.y : startY
                        });
                        this.canvas.renderAll();
                    }
                    break;

                case TOOL_TYPES.CIRCLE:
                    if (currentShape) {
                        const radius = Math.sqrt(
                            Math.pow(pointer.x - startX, 2) +
                            Math.pow(pointer.y - startY, 2)
                        ) / 2;
                        currentShape.set({ radius });
                        this.canvas.renderAll();
                    }
                    break;
            }
        });

        // Mouse up
        this.canvas.on('mouse:up', () => {
            if (this.isDrawing && currentShape) {
                this.sendCanvasElement(currentShape);
            }
            this.isDrawing = false;
            currentShape = null;
        });

        // Path created (for free drawing)
        this.canvas.on('path:created', (event) => {
            this.sendCanvasElement(event.path);
        });

        // Object modified
        this.canvas.on('object:modified', (event) => {
            this.sendCanvasElement(event.target, true);
        });

        // Object removed
        this.canvas.on('object:removed', (event) => {
            if (event.target.elementId) {
                this.sendDeleteElement(event.target.elementId);
            }
        });
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTool(btn.dataset.tool);
            });
        });

        // Color picker
        const colorPicker = document.getElementById('color-picker');
        colorPicker.addEventListener('change', (e) => {
            this.currentColor = e.target.value;
            this.updateDrawingSettings();
        });

        // Create color palette
        this.createColorPalette();

        // Stroke width
        const strokeWidth = document.getElementById('stroke-width');
        strokeWidth.addEventListener('input', (e) => {
            this.currentStrokeWidth = parseInt(e.target.value);
            document.getElementById('stroke-width-value').textContent = e.target.value;
            this.updateDrawingSettings();
        });

        // Opacity
        const opacity = document.getElementById('opacity');
        opacity.addEventListener('input', (e) => {
            this.currentOpacity = parseInt(e.target.value) / 100;
            document.getElementById('opacity-value').textContent = e.target.value + '%';
            this.updateDrawingSettings();
        });

        // Image upload
        const uploadBtn = document.getElementById('upload-image-btn');
        const imageInput = document.getElementById('image-input');

        uploadBtn.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadImage(e.target.files[0]);
            }
        });

        // Drag and drop for images
        this.canvas.wrapperEl.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        this.canvas.wrapperEl.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.uploadImage(files[0]);
            }
        });

        // Clipboard paste for images
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    this.uploadImage(file);
                    break;
                }
            }
        });

        // Night mode toggle
        const nightModeBtn = document.getElementById('night-mode-btn');
        if (nightModeBtn) {
            nightModeBtn.addEventListener('click', () => {
                this.toggleNightMode();
            });
        }

        // Load saved night mode preference
        this.loadNightMode();

        // Share button
        document.getElementById('share-btn').addEventListener('click', () => {
            this.showShareModal();
        });

        // Share modal
        const modal = document.getElementById('share-modal');
        const closeBtn = modal.querySelector('.close');

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Copy URL button
        document.getElementById('copy-url-btn').addEventListener('click', () => {
            const urlInput = document.getElementById('share-url');
            urlInput.select();
            document.execCommand('copy');
            alert('URL copied to clipboard!');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'p': this.selectTool(TOOL_TYPES.PEN); break;
                case 'l': this.selectTool(TOOL_TYPES.LINE); break;
                case 'r': this.selectTool(TOOL_TYPES.RECTANGLE); break;
                case 'c': this.selectTool(TOOL_TYPES.CIRCLE); break;
                case 'a': this.selectTool(TOOL_TYPES.ARROW); break;
                case 't': this.selectTool(TOOL_TYPES.TEXT); break;
                case 'h': this.selectTool(TOOL_TYPES.HIGHLIGHTER); break;
                case 'e': this.selectTool(TOOL_TYPES.ERASER); break;
                case 'v': this.selectTool(TOOL_TYPES.SELECT); break;
                case 'delete':
                case 'backspace':
                    if (this.canvas.getActiveObject()) {
                        this.canvas.remove(this.canvas.getActiveObject());
                    }
                    break;
            }
        });
    }

    /**
     * Create color palette
     */
    createColorPalette() {
        const palette = document.getElementById('color-palette');
        const colors = this.currentTool === TOOL_TYPES.HIGHLIGHTER ?
            HIGHLIGHTER_COLORS : COLORS;

        palette.innerHTML = '';
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                this.currentColor = color;
                document.getElementById('color-picker').value = color;
                this.updateDrawingSettings();

                // Update active state
                palette.querySelectorAll('.color-swatch').forEach(s => {
                    s.classList.remove('active');
                });
                swatch.classList.add('active');
            });
            palette.appendChild(swatch);
        });
    }

    /**
     * Select a tool
     */
    selectTool(tool) {
        this.currentTool = tool;

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

        // Configure canvas based on tool
        switch (tool) {
            case TOOL_TYPES.PEN:
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                this.currentOpacity = DRAWING_CONFIG.DEFAULT_OPACITY;
                break;

            case TOOL_TYPES.HIGHLIGHTER:
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                this.currentOpacity = DRAWING_CONFIG.HIGHLIGHTER_OPACITY;
                this.createColorPalette(); // Update palette with highlighter colors
                break;

            case TOOL_TYPES.ERASER:
                this.canvas.isDrawingMode = false;
                this.canvas.selection = true;
                break;

            case TOOL_TYPES.SELECT:
                this.canvas.isDrawingMode = false;
                this.canvas.selection = true;
                break;

            default:
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                break;
        }

        this.updateDrawingSettings();
    }

    /**
     * Update drawing settings
     */
    updateDrawingSettings() {
        if (this.canvas.freeDrawingBrush) {
            // Convert hex color to RGBA with opacity
            const color = this.hexToRgba(this.currentColor, this.currentOpacity);
            this.canvas.freeDrawingBrush.color = color;
            this.canvas.freeDrawingBrush.width = this.currentStrokeWidth;
        }
    }

    /**
     * Convert hex color to RGBA with opacity
     */
    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /**
     * Add text box to canvas
     */
    addTextBox(x, y) {
        const textbox = new fabric.IText('Type here...', {
            left: x,
            top: y,
            fontSize: TEXT_CONFIG.DEFAULT_FONT_SIZE,
            fontFamily: TEXT_CONFIG.FONT_FAMILY,
            fill: this.currentColor
        });

        this.canvas.add(textbox);
        this.canvas.setActiveObject(textbox);
        textbox.enterEditing();

        // Send to server after editing
        textbox.on('editing:exited', () => {
            this.sendCanvasElement(textbox);
        });
    }

    /**
     * Upload image
     */
    async uploadImage(file) {
        if (file.size > IMAGE_CONFIG.MAX_SIZE_MB * 1024 * 1024) {
            alert(`Image too large. Max size: ${IMAGE_CONFIG.MAX_SIZE_MB}MB`);
            return;
        }

        if (!IMAGE_CONFIG.SUPPORTED_FORMATS.includes(file.type)) {
            alert('Unsupported image format. Please use JPEG, PNG, GIF, or WebP.');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/api/image/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.url) {
                this.addImageToCanvas(data.url);
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image. Please try again.');
        }
    }

    /**
     * Add image to canvas
     */
    addImageToCanvas(url) {
        fabric.Image.fromURL(url, (img) => {
            // Scale image if too large
            const maxWidth = 500;
            const maxHeight = 500;

            if (img.width > maxWidth || img.height > maxHeight) {
                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                img.scale(scale);
            }

            img.set({
                left: 100,
                top: 100
            });

            this.canvas.add(img);
            this.sendCanvasElement(img);
        });
    }

    /**
     * Connect to WebSocket
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/session/${this.sessionId}`;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                resolve();
            };

            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(JSON.parse(event.data));
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    this.connectWebSocket();
                }, 3000);
            };
        });
    }

    /**
     * Handle WebSocket messages
     */
    handleWebSocketMessage(message) {
        const { type, data } = message;

        switch (type) {
            case MESSAGE_TYPES.INIT:
                this.userId = data.userId;
                this.currentUser = data.user;
                this.loadCanvasState(data.canvasState);
                this.updateUsers(data.users);
                break;

            case MESSAGE_TYPES.USER_JOINED:
                this.users.set(data.user.id, data.user);
                this.updateUsersUI();
                break;

            case MESSAGE_TYPES.USER_LEFT:
                this.users.delete(data.userId);
                this.removeCursor(data.userId);
                this.updateUsersUI();
                break;

            case MESSAGE_TYPES.CANVAS_UPDATE:
                if (data.deleted) {
                    this.removeCanvasElement(data.elementId);
                } else {
                    this.addRemoteCanvasElement(data.element);
                }
                break;

            case MESSAGE_TYPES.CURSOR_UPDATE:
                this.updateCursor(data.userId, data.cursor);
                break;

            case MESSAGE_TYPES.ERROR:
                console.error('Server error:', data.message);
                break;
        }
    }

    /**
     * Load canvas state
     */
    loadCanvasState(state) {
        if (!state || !state.elements) return;

        state.elements.forEach(element => {
            this.addRemoteCanvasElement(element);
        });
    }

    /**
     * Add remote canvas element
     */
    addRemoteCanvasElement(elementData) {
        // Check if element already exists
        const existing = this.canvas.getObjects().find(
            obj => obj.elementId === elementData.id
        );

        if (existing) {
            // Update existing element
            existing.set(elementData);
            this.canvas.renderAll();
            return;
        }

        // Create new element based on type
        let object;

        switch (elementData.type) {
            case 'path':
                object = new fabric.Path(elementData.path, elementData);
                break;
            case 'line':
                object = new fabric.Line(
                    [elementData.x1, elementData.y1, elementData.x2, elementData.y2],
                    elementData
                );
                break;
            case 'rect':
                object = new fabric.Rect(elementData);
                break;
            case 'circle':
                object = new fabric.Circle(elementData);
                break;
            case 'i-text':
                object = new fabric.IText(elementData.text, elementData);
                break;
            case 'image':
                fabric.Image.fromURL(elementData.src, (img) => {
                    img.set(elementData);
                    img.elementId = elementData.id;
                    this.canvas.add(img);
                });
                return;
        }

        if (object) {
            object.elementId = elementData.id;
            this.canvas.add(object);
        }
    }

    /**
     * Remove canvas element
     */
    removeCanvasElement(elementId) {
        const object = this.canvas.getObjects().find(
            obj => obj.elementId === elementId
        );

        if (object) {
            this.canvas.remove(object);
        }
    }

    /**
     * Send canvas element to server
     */
    sendCanvasElement(object, isUpdate = false) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const elementData = object.toJSON();
        elementData.id = object.elementId || crypto.randomUUID();
        object.elementId = elementData.id;

        this.ws.send(JSON.stringify({
            type: isUpdate ? MESSAGE_TYPES.UPDATE_ELEMENT : MESSAGE_TYPES.DRAW,
            data: elementData
        }));
    }

    /**
     * Send delete element to server
     */
    sendDeleteElement(elementId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({
            type: MESSAGE_TYPES.DELETE_ELEMENT,
            data: { elementId }
        }));
    }

    /**
     * Send cursor position (throttled)
     */
    sendCursorPosition(x, y) {
        if (this.cursorThrottle) return;

        this.cursorThrottle = setTimeout(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: MESSAGE_TYPES.CURSOR_MOVE,
                    data: { x, y }
                }));
            }
            this.cursorThrottle = null;
        }, PERFORMANCE.CURSOR_THROTTLE);
    }

    /**
     * Update users list
     */
    updateUsers(users) {
        users.forEach(user => {
            if (user.id !== this.userId) {
                this.users.set(user.id, user);
            }
        });
        this.updateUsersUI();
    }

    /**
     * Update users UI
     */
    updateUsersUI() {
        const usersList = document.getElementById('users-list');
        const userCount = document.getElementById('user-count');

        userCount.textContent = this.users.size + 1; // +1 for current user

        usersList.innerHTML = '';

        // Add current user
        if (this.currentUser) {
            const userItem = this.createUserItem(this.currentUser, true);
            usersList.appendChild(userItem);
        }

        // Add other users
        this.users.forEach(user => {
            const userItem = this.createUserItem(user, false);
            usersList.appendChild(userItem);
        });
    }

    /**
     * Create user item element
     */
    createUserItem(user, isCurrent) {
        const div = document.createElement('div');
        div.className = 'user-item';

        const colorDiv = document.createElement('div');
        colorDiv.className = 'user-color';
        colorDiv.style.backgroundColor = user.color;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'user-name';
        nameSpan.textContent = user.name + (isCurrent ? ' (You)' : '');

        div.appendChild(colorDiv);
        div.appendChild(nameSpan);

        return div;
    }

    /**
     * Update cursor position
     */
    updateCursor(userId, cursor) {
        let cursorEl = this.cursors.get(userId);
        const user = this.users.get(userId);

        if (!user) return;

        if (!cursorEl) {
            cursorEl = document.createElement('div');
            cursorEl.className = 'cursor';
            cursorEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="${user.color}">
                    <path d="M0 0 L0 16 L4 12 L7 20 L9 19 L6 11 L12 10 Z"/>
                </svg>
                <div class="cursor-label">${user.name}</div>
            `;
            document.getElementById('cursors-container').appendChild(cursorEl);
            this.cursors.set(userId, cursorEl);
        }

        cursorEl.style.left = cursor.x + 'px';
        cursorEl.style.top = cursor.y + 'px';
    }

    /**
     * Remove cursor
     */
    removeCursor(userId) {
        const cursorEl = this.cursors.get(userId);
        if (cursorEl) {
            cursorEl.remove();
            this.cursors.delete(userId);
        }
    }

    /**
     * Show share modal
     */
    showShareModal() {
        const modal = document.getElementById('share-modal');
        const urlInput = document.getElementById('share-url');

        urlInput.value = `${window.location.origin}/board/${this.sessionId}`;
        modal.style.display = 'flex';
    }

    /**
     * Toggle night mode
     */
    toggleNightMode() {
        document.body.classList.toggle('night-mode');
        const isNightMode = document.body.classList.contains('night-mode');
        localStorage.setItem('nightMode', isNightMode);
    }

    /**
     * Load saved night mode preference
     */
    loadNightMode() {
        const isNightMode = localStorage.getItem('nightMode') === 'true';
        if (isNightMode) {
            document.body.classList.add('night-mode');
        }
    }
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new WhiteboardApp();
    });
} else {
    window.app = new WhiteboardApp();
}
