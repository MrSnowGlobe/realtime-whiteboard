// Import static assets as text
import indexHtml from '../frontend/index.html';
import stylesCss from '../frontend/styles.css';
import appJs from '../frontend/app.js';
import constantsJs from '../frontend/constants.js';

/**
 * Serve static assets directly from imported files
 */
export async function serveAsset(pathname) {
  // Map of paths to assets and their content types
  const assets = {
    '/': { content: indexHtml, type: 'text/html; charset=utf-8' },
    '/index.html': { content: indexHtml, type: 'text/html; charset=utf-8' },
    '/styles.css': { content: stylesCss, type: 'text/css; charset=utf-8' },
    '/app.js': { content: appJs, type: 'application/javascript; charset=utf-8' },
    '/constants.js': { content: constantsJs, type: 'application/javascript; charset=utf-8' },
  };

  // Get the asset
  const asset = assets[pathname];

  if (asset) {
    return new Response(asset.content, {
      status: 200,
      headers: {
        'Content-Type': asset.type,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Return null if asset not found
  return null;
}

/**
 * Get MIME type for a file extension
 */
function getMimeType(pathname) {
  const ext = pathname.split('.').pop().toLowerCase();
  const mimeTypes = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
