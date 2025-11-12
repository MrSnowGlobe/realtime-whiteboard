import { WhiteboardDurableObject } from './websocket.js';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

/**
 * Main Worker entry point
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Route handling
      if (url.pathname === '/api/session/create') {
        return handleCreateSession(env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/session/')) {
        const sessionId = url.pathname.split('/').pop();
        return handleSessionRequest(sessionId, request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/image/upload')) {
        return handleImageUpload(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/image/')) {
        const imageId = url.pathname.split('/').pop();
        return handleImageRequest(imageId, env, corsHeaders);
      }

      // Serve static assets for board URLs and root
      if (url.pathname.startsWith('/board/') || url.pathname === '/') {
        return getAsset(request, env, ctx, corsHeaders, 'index.html');
      }

      // Serve other static assets
      return getAsset(request, env, ctx, corsHeaders);

    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Create a new whiteboard session
 */
async function handleCreateSession(env, corsHeaders) {
  const sessionId = crypto.randomUUID();

  // Store session metadata in KV
  await env.SESSIONS_KV.put(sessionId, JSON.stringify({
    id: sessionId,
    created: Date.now(),
    lastAccessed: Date.now()
  }));

  return new Response(JSON.stringify({ sessionId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle session requests (WebSocket or HTTP)
 */
async function handleSessionRequest(sessionId, request, env, corsHeaders) {
  // Validate session exists
  const sessionData = await env.SESSIONS_KV.get(sessionId);
  if (!sessionData) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Update last accessed time
  const session = JSON.parse(sessionData);
  session.lastAccessed = Date.now();
  await env.SESSIONS_KV.put(sessionId, JSON.stringify(session));

  // Get the Durable Object for this session
  const id = env.WHITEBOARD_DO.idFromName(sessionId);
  const stub = env.WHITEBOARD_DO.get(id);

  // Forward the request to the Durable Object
  return stub.fetch(request);
}

/**
 * Handle image upload
 */
async function handleImageUpload(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check file size
    const maxSize = (env.MAX_IMAGE_SIZE_MB || 10) * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(JSON.stringify({
        error: `Image too large. Max size: ${env.MAX_IMAGE_SIZE_MB || 10}MB`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate unique ID for the image
    const imageId = crypto.randomUUID();
    const imageKey = `${imageId}-${file.name}`;

    // Upload to R2
    await env.IMAGES_BUCKET.put(imageKey, file.stream(), {
      httpMetadata: {
        contentType: file.type
      }
    });

    return new Response(JSON.stringify({
      imageId,
      imageKey,
      url: `/api/image/${imageKey}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle image retrieval
 */
async function handleImageRequest(imageKey, env, corsHeaders) {
  try {
    const object = await env.IMAGES_BUCKET.get(imageKey);

    if (!object) {
      return new Response('Image not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    const headers = {
      ...corsHeaders,
      'Content-Type': object.httpMetadata.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000'
    };

    return new Response(object.body, { headers });

  } catch (error) {
    console.error('Error retrieving image:', error);
    return new Response('Error retrieving image', {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Get static asset from Workers Sites using KV Asset Handler
 */
async function getAsset(request, env, ctx, corsHeaders, overridePath) {
  try {
    // If override path is provided (e.g., 'index.html' for /board/ routes)
    if (overridePath) {
      const url = new URL(request.url);
      request = new Request(
        `${url.protocol}//${url.host}/${overridePath}`,
        request
      );
    }

    // Get asset from KV using Workers Sites
    const response = await getAssetFromKV(
      {
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
      }
    );

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('Error serving asset:', error);

    // If asset not found, try to serve index.html (for SPA routing)
    if (!overridePath) {
      try {
        return getAsset(request, env, ctx, corsHeaders, 'index.html');
      } catch (fallbackError) {
        console.error('Error serving fallback index.html:', fallbackError);
      }
    }

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders
    });
  }
}

// Export Durable Object class
export { WhiteboardDurableObject };
