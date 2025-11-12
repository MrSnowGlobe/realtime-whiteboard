# Real-Time Collaborative Whiteboard

A real-time collaborative whiteboard application powered by Cloudflare Workers, Durable Objects, and Fabric.js.

## Features

### Drawing Tools
- **Freehand Pen** - Draw freely on the canvas
- **Line Tool** - Draw straight lines
- **Shapes** - Rectangle, Circle, and Arrow
- **Highlighter** - Semi-transparent highlighting tool
- **Eraser** - Remove elements from canvas
- **Text Blocks** - Add and edit text anywhere on the canvas
- **Image Support** - Upload images via drag-drop, file picker, or clipboard paste

### Collaboration Features
- **Real-time Synchronization** - All changes sync instantly across users
- **Live Cursors** - See where other users are pointing
- **Presence Awareness** - View active users in the sidebar
- **Conflict Resolution** - Last-write-wins strategy
- **Auto-save** - Canvas state automatically saved every 30 seconds

### Customization
- **Color Picker** - 16 preset colors plus custom color picker
- **Stroke Width** - Adjustable from 1px to 20px
- **Opacity Control** - Adjust transparency for drawing elements
- **Keyboard Shortcuts** - Quick access to tools (P, L, R, C, A, T, H, E, V)

## Architecture

### Backend (Cloudflare Workers)
- **Workers** - Handle HTTP API requests and serve static assets
- **Durable Objects** - Manage WebSocket connections and real-time state
- **KV** - Store session metadata
- **R2** - Store uploaded images

### Frontend
- **Fabric.js** - Canvas manipulation and drawing
- **Native WebSocket** - Real-time communication
- **Vanilla JavaScript** - Lightweight and fast

## Project Structure

```
realtime-whiteboard/
├── src/
│   ├── worker/
│   │   ├── index.js          # Main Worker entry point
│   │   └── websocket.js      # Durable Object class
│   ├── frontend/
│   │   ├── index.html        # Main HTML file
│   │   ├── styles.css        # UI styles
│   │   ├── app.js           # Application logic
│   │   └── constants.js      # Shared constants
│   └── shared/
│       └── constants.js      # Shared constants (backend)
├── wrangler.toml            # Cloudflare configuration
├── package.json             # Dependencies
└── README.md               # This file
```

## Setup Instructions

### Prerequisites
- Node.js 16+ installed
- Cloudflare account (free tier works)
- Wrangler CLI installed

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure KV and R2

Create KV namespace for session storage:

```bash
wrangler kv:namespace create "SESSIONS_KV"
```

Copy the `id` from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "YOUR_KV_ID_HERE"
```

Create R2 bucket for image storage:

```bash
wrangler r2 bucket create whiteboard-images
```

### 5. Development

Run the development server:

```bash
npm run dev
```

Open your browser to `http://localhost:8787`

### 6. Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

After deployment, your whiteboard will be available at:
`https://realtime-whiteboard.<your-subdomain>.workers.dev`

## Usage Guide

### Creating a New Whiteboard

1. Visit the root URL of your deployed application
2. A new whiteboard session will be created automatically
3. Share the URL with others to collaborate

### Using Drawing Tools

- **Pen (P)**: Click and drag to draw freehand
- **Line (L)**: Click start point, drag, release to create line
- **Rectangle (R)**: Click corner, drag to create rectangle
- **Circle (C)**: Click center, drag to create circle
- **Text (T)**: Click to add text box, start typing
- **Highlighter (H)**: Draw with semi-transparent strokes
- **Eraser (E)**: Select and delete objects
- **Select (V)**: Select and move/resize objects

### Uploading Images

Three ways to add images:

1. **Click Upload Button** - Use the image button in toolbar
2. **Drag & Drop** - Drag image files onto canvas
3. **Paste** - Copy image and paste (Ctrl/Cmd + V)

Supported formats: JPEG, PNG, GIF, WebP (max 10MB)

### Keyboard Shortcuts

- `P` - Pen tool
- `L` - Line tool
- `R` - Rectangle tool
- `C` - Circle tool
- `A` - Arrow tool
- `T` - Text tool
- `H` - Highlighter tool
- `E` - Eraser tool
- `V` - Select tool
- `Delete/Backspace` - Delete selected object

### Sharing Your Whiteboard

1. Click the "Share" button in the toolbar
2. Copy the URL
3. Send to collaborators
4. Anyone with the URL can view and edit

## Configuration

### Environment Variables (wrangler.toml)

```toml
[vars]
ENVIRONMENT = "production"
MAX_IMAGE_SIZE_MB = "10"
AUTO_SAVE_INTERVAL_MS = "30000"
```

### Canvas Settings

Edit `src/shared/constants.js` to customize:

- Canvas size
- Color palette
- Default stroke width
- Highlighter opacity
- Font sizes
- Auto-save interval

## Performance

- **Initial Load**: < 3 seconds
- **Update Propagation**: < 100ms
- **Concurrent Users**: Supports 10+ users per session
- **Canvas Operations**: 60fps rendering

## Security Considerations

The application includes basic security features:

- CORS configuration
- File size limits for uploads
- Session ID validation
- WebSocket connection management

For production use, consider adding:

- Rate limiting per IP
- Optional password protection for sessions
- Image virus scanning
- User authentication

## Troubleshooting

### WebSocket Connection Fails

- Check that Durable Objects are enabled in your Cloudflare account
- Verify wrangler.toml configuration
- Check browser console for errors

### Images Not Uploading

- Verify R2 bucket is created and configured
- Check file size limits
- Ensure correct CORS headers

### Canvas Not Syncing

- Check WebSocket connection status
- Verify Durable Object bindings
- Check browser console for errors

## Future Enhancements (Phase 2)

- [ ] Undo/redo functionality
- [ ] Export to PNG/PDF
- [ ] Shape recognition
- [ ] Layers support
- [ ] Mobile touch optimization
- [ ] Voice/video chat integration
- [ ] Templates and backgrounds
- [ ] Sticky notes
- [ ] Grid and snap-to-grid

## License

MIT License - Feel free to use and modify as needed.

## Support

For issues and feature requests, please create an issue in the repository.

## Credits

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Fabric.js](http://fabricjs.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
