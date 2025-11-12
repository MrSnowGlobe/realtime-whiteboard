// Message types for WebSocket communication
export const MESSAGE_TYPES = {
  // Client -> Server
  JOIN: 'join',
  DRAW: 'draw',
  ADD_TEXT: 'add_text',
  UPDATE_TEXT: 'update_text',
  ADD_IMAGE: 'add_image',
  DELETE_ELEMENT: 'delete_element',
  UPDATE_ELEMENT: 'update_element',
  CURSOR_MOVE: 'cursor_move',

  // Server -> Client
  INIT: 'init',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  CANVAS_UPDATE: 'canvas_update',
  CURSOR_UPDATE: 'cursor_update',
  ERROR: 'error'
};

// Tool types
export const TOOL_TYPES = {
  PEN: 'pen',
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  ERASER: 'eraser',
  HIGHLIGHTER: 'highlighter',
  TEXT: 'text',
  SELECT: 'select',
  PAN: 'pan'
};

// Element types
export const ELEMENT_TYPES = {
  PATH: 'path',
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  TEXT: 'text',
  IMAGE: 'image'
};

// Default colors
export const COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#A52A2A', // Brown
  '#808080', // Gray
  '#C0C0C0', // Silver
  '#008000', // Dark Green
  '#000080'  // Navy
];

// Highlighter colors
export const HIGHLIGHTER_COLORS = [
  '#FFFF00', // Yellow
  '#FFC0CB', // Pink
  '#00FF00', // Green
  '#00FFFF', // Blue/Cyan
  '#FFA500'  // Orange
];

// Canvas settings
export const CANVAS_CONFIG = {
  WIDTH: 5000,
  HEIGHT: 5000,
  BACKGROUND: '#FFFFFF'
};

// Drawing settings
export const DRAWING_CONFIG = {
  MIN_STROKE_WIDTH: 1,
  MAX_STROKE_WIDTH: 20,
  DEFAULT_STROKE_WIDTH: 2,
  DEFAULT_COLOR: '#000000',
  HIGHLIGHTER_OPACITY: 0.3,
  DEFAULT_OPACITY: 1
};

// Text settings
export const TEXT_CONFIG = {
  FONT_SIZES: [12, 16, 20, 28, 36],
  DEFAULT_FONT_SIZE: 16,
  FONT_FAMILY: 'Arial, sans-serif'
};

// Image settings
export const IMAGE_CONFIG = {
  MAX_SIZE_MB: 10,
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

// User colors for identification
export const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52B788', '#E76F51', '#2A9D8F'
];

// Performance settings
export const PERFORMANCE = {
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  CURSOR_THROTTLE: 50, // 50ms
  MAX_USERS_PER_SESSION: 20
};
