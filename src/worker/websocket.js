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
    server.addEventListener('close', () => {
      this.sessions.delete(userId);
      this.users.delete(userId);
      this.cursors.delete(userId);

      this.broadcast({
        type: MESSAGE_TYPES.USER_LEFT,
        data: { userId }
      });
    });

    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.sessions.delete(userId);
      this.users.delete(userId);
      this.cursors.delete(userId);
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

        // Save state immediately to ensure persistence
        await this.saveState();
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

        // Save state immediately to ensure persistence
        await this.saveState();
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
          const newName = data.name.trim().substring(0, 50); // Limit to 50 characters
          user.name = newName;
          this.users.set(userId, user);

          // Broadcast name change to all clients (including sender)
          this.broadcast({
            type: MESSAGE_TYPES.USER_NAME_CHANGED,
            data: { userId, name: newName }
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
   * Schedule auto-save using Durable Object alarm
   */
  async scheduleAutoSave() {
    const currentAlarm = await this.state.storage.getAlarm();
    if (currentAlarm === null) {
      await this.state.storage.setAlarm(Date.now() + PERFORMANCE.AUTO_SAVE_INTERVAL);
    }
  }

  /**
   * Alarm handler for auto-save
   */
  async alarm() {
    await this.saveState();
  }

  /**
   * Save canvas state to storage
   */
  async saveState() {
    try {
      await this.state.storage.put('canvasState', this.canvasState);
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
}

// Required for Durable Objects
export default WhiteboardDurableObject;
