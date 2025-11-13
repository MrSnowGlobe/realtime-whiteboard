import { MESSAGE_TYPES, USER_COLORS, PERFORMANCE } from '../shared/constants.js';

/**
 * Durable Object for managing WebSocket connections and real-time state
 */
export class WhiteboardDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // userId -> WebSocket
    this.users = new Map(); // userId -> user metadata
    this.canvasState = {
      elements: [],
      lastModified: Date.now()
    };
    this.cursors = new Map(); // userId -> cursor position
    this.initialized = false; // Track if state has been loaded
    this.pendingSave = false; // Track if save is pending
    this.saveTimeout = null; // Debounce timer
    this.unsavedChanges = 0; // Count of unsaved changes
    this.auditLog = []; // Audit log for tracking changes
    this.maxAuditLogSize = 500; // Keep last 500 events
  }

  /**
   * Initialize and load persisted state
   */
  async initialize() {
    if (this.initialized) return;

    // Load persisted canvas state
    const savedState = await this.state.storage.get('canvasState');
    if (savedState) {
      this.canvasState = savedState;
      console.log('Loaded persisted canvas state with', savedState.elements?.length || 0, 'elements');
    }

    // Load persisted audit log
    const savedAuditLog = await this.state.storage.get('auditLog');
    if (savedAuditLog) {
      this.auditLog = savedAuditLog;
      console.log('Loaded audit log with', savedAuditLog.length, 'events');
    }

    this.initialized = true;
  }

  async fetch(request) {
    // Ensure state is loaded before handling any requests
    await this.initialize();

    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle HTTP requests for state management
    switch (url.pathname) {
      case '/state':
        return this.handleGetState();
      case '/save':
        return this.handleSaveState(request);
      case '/audit-log':
        return this.handleGetAuditLog(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Handle WebSocket connection upgrade
   */
  async handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    const userId = crypto.randomUUID();
    const userColor = USER_COLORS[this.users.size % USER_COLORS.length];
    const userName = `User ${this.users.size + 1}`;

    const user = {
      id: userId,
      name: userName,
      color: userColor,
      joinedAt: Date.now()
    };

    this.sessions.set(userId, server);
    this.users.set(userId, user);

    // Send initial state to the new user
    server.send(JSON.stringify({
      type: MESSAGE_TYPES.INIT,
      data: {
        userId,
        user,
        canvasState: this.canvasState,
        users: Array.from(this.users.values()),
        cursors: Object.fromEntries(this.cursors)
      }
    }));

    // Notify other users
    this.broadcast({
      type: MESSAGE_TYPES.USER_JOINED,
      data: { user }
    }, userId);

    // Handle incoming messages
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleMessage(userId, message);
      } catch (error) {
        console.error('Error handling message:', error);
        server.send(JSON.stringify({
          type: MESSAGE_TYPES.ERROR,
          data: { message: 'Invalid message format' }
        }));
      }
    });

    // Handle disconnection
    server.addEventListener('close', async () => {
      this.sessions.delete(userId);
      this.users.delete(userId);
      this.cursors.delete(userId);

      this.broadcast({
        type: MESSAGE_TYPES.USER_LEFT,
        data: { userId }
      });

      // Save any pending changes when user disconnects
      if (this.unsavedChanges > 0) {
        await this.performBatchedSave();
      }
    });

    server.addEventListener('error', async (error) => {
      console.error('WebSocket error:', error);
      this.sessions.delete(userId);
      this.users.delete(userId);
      this.cursors.delete(userId);

      // Save any pending changes on error
      if (this.unsavedChanges > 0) {
        await this.performBatchedSave();
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(userId, message) {
    const { type, data } = message;

    switch (type) {
      case MESSAGE_TYPES.DRAW:
      case MESSAGE_TYPES.ADD_TEXT:
      case MESSAGE_TYPES.ADD_IMAGE:
      case MESSAGE_TYPES.UPDATE_ELEMENT:
        // Add or update canvas element
        const element = {
          ...data,
          id: data.id || crypto.randomUUID(),
          userId,
          timestamp: Date.now()
        };

        // Update or add element
        const existingIndex = this.canvasState.elements.findIndex(e => e.id === element.id);
        if (existingIndex >= 0) {
          this.canvasState.elements[existingIndex] = element;
        } else {
          this.canvasState.elements.push(element);
        }

        this.canvasState.lastModified = Date.now();

        // Broadcast to all clients
        this.broadcast({
          type: MESSAGE_TYPES.CANVAS_UPDATE,
          data: { element }
        });

        // Log audit event
        const actionType = existingIndex >= 0 ? 'update' : 'create';
        this.logAuditEvent(userId, actionType, {
          elementId: element.id,
          elementType: type
        });

        // Use batched save strategy
        this.scheduleBatchedSave();
        break;

      case MESSAGE_TYPES.DELETE_ELEMENT:
        // Remove element from canvas
        this.canvasState.elements = this.canvasState.elements.filter(
          e => e.id !== data.elementId
        );
        this.canvasState.lastModified = Date.now();

        this.broadcast({
          type: MESSAGE_TYPES.CANVAS_UPDATE,
          data: {
            deleted: true,
            elementId: data.elementId
          }
        });

        // Log audit event
        this.logAuditEvent(userId, 'delete', {
          elementId: data.elementId
        });

        // Use batched save strategy
        this.scheduleBatchedSave();
        break;

      case MESSAGE_TYPES.CURSOR_MOVE:
        // Update cursor position
        this.cursors.set(userId, data);

        // Broadcast cursor update (excluding sender)
        this.broadcast({
          type: MESSAGE_TYPES.CURSOR_UPDATE,
          data: { userId, cursor: data }
        }, userId);
        break;

      case MESSAGE_TYPES.CHANGE_NAME:
        // Update user's name
        const user = this.users.get(userId);
        if (user && data.name && data.name.trim().length > 0) {
          const oldName = user.name;
          const newName = data.name.trim().substring(0, 50); // Limit to 50 characters
          user.name = newName;
          this.users.set(userId, user);

          // Broadcast name change to all clients (including sender)
          this.broadcast({
            type: MESSAGE_TYPES.USER_NAME_CHANGED,
            data: { userId, name: newName }
          });

          // Log audit event
          this.logAuditEvent(userId, 'change_name', {
            oldName,
            newName
          });
        }
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message to broadcast
   * @param {string} excludeUserId - User ID to exclude from broadcast
   */
  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);

    for (const [userId, ws] of this.sessions.entries()) {
      if (userId !== excludeUserId && ws.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error(`Error sending to user ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Log an audit event
   * @param {string} userId - User ID who performed the action
   * @param {string} action - Action type (draw, delete, add_text, etc.)
   * @param {Object} details - Additional details about the action
   */
  logAuditEvent(userId, action, details = {}) {
    const user = this.users.get(userId);
    const event = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      userId,
      userName: user?.name || 'Unknown User',
      userColor: user?.color || '#888888',
      action,
      details
    };

    this.auditLog.push(event);

    // Trim audit log if it exceeds max size
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize);
    }

    // Broadcast audit event to all clients
    this.broadcast({
      type: 'AUDIT_EVENT',
      data: event
    });
  }

  /**
   * Schedule batched save with debouncing
   * Saves after 2 seconds of inactivity OR after 50 changes, whichever comes first
   */
  scheduleBatchedSave() {
    this.unsavedChanges++;

    // Save immediately if we have many unsaved changes
    const BATCH_THRESHOLD = 50;
    if (this.unsavedChanges >= BATCH_THRESHOLD) {
      this.performBatchedSave();
      return;
    }

    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Schedule save after 2 seconds of inactivity
    this.saveTimeout = setTimeout(() => {
      this.performBatchedSave();
    }, 2000);
  }

  /**
   * Perform the actual batched save
   */
  async performBatchedSave() {
    if (this.unsavedChanges === 0) return;

    const changesToSave = this.unsavedChanges;
    this.unsavedChanges = 0;
    this.saveTimeout = null;

    try {
      await this.state.storage.put('canvasState', this.canvasState);
      await this.state.storage.put('auditLog', this.auditLog);
      console.log(`Canvas state saved (${changesToSave} changes batched)`);
    } catch (error) {
      console.error('Error saving canvas state:', error);
      // Restore unsaved changes count on error
      this.unsavedChanges += changesToSave;
    }
  }

  /**
   * Schedule auto-save using Durable Object alarm as backup
   */
  async scheduleAutoSave() {
    const currentAlarm = await this.state.storage.getAlarm();
    if (currentAlarm === null) {
      await this.state.storage.setAlarm(Date.now() + PERFORMANCE.AUTO_SAVE_INTERVAL);
    }
  }

  /**
   * Alarm handler for auto-save backup
   */
  async alarm() {
    // Save any remaining unsaved changes
    if (this.unsavedChanges > 0) {
      await this.performBatchedSave();
    }
  }

  /**
   * Save canvas state to storage (for manual saves)
   */
  async saveState() {
    try {
      await this.state.storage.put('canvasState', this.canvasState);
      await this.state.storage.put('auditLog', this.auditLog);
      this.unsavedChanges = 0;
      console.log('Canvas state saved successfully');
    } catch (error) {
      console.error('Error saving canvas state:', error);
    }
  }

  /**
   * Handle HTTP request for getting state
   */
  async handleGetState() {
    // State is already loaded by initialize(), just return it
    return new Response(JSON.stringify(this.canvasState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle HTTP request for saving state
   */
  async handleSaveState(request) {
    try {
      const body = await request.json();
      this.canvasState = body;
      await this.saveState();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle HTTP request for getting audit log
   */
  async handleGetAuditLog(request) {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit')) || 100;
      const offset = parseInt(url.searchParams.get('offset')) || 0;

      // Return requested slice of audit log (most recent first)
      const reversedLog = [...this.auditLog].reverse();
      const paginatedLog = reversedLog.slice(offset, offset + limit);

      return new Response(JSON.stringify({
        events: paginatedLog,
        total: this.auditLog.length,
        limit,
        offset
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

// Required for Durable Objects
export default WhiteboardDurableObject;
