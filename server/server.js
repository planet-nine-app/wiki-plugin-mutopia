(function() {
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const multer = require('multer');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const FormData = require('form-data');
const sessionless = require('sessionless-node');

// Service ports (from allyabase)
const SANORA_PORT = 7243;  // Track storage
const DOLORES_PORT = 3007; // Audio playback

// Mutopia's Sanora credentials
let mutopiaKeys = null;
let mutopiaUser = null;

// Path to store credentials
const CREDENTIALS_FILE = path.join(__dirname, '../.mutopia-credentials.json');

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/mutopia-uploads/',
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  }
});

/**
 * Load or create Mutopia's Sanora credentials
 */
async function loadMutopiaCredentials() {
  // Try to load existing credentials
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      const creds = JSON.parse(data);

      // Setup sessionless with these keys
      sessionless.getKeys = () => creds.keys;
      mutopiaKeys = creds.keys;
      mutopiaUser = creds.user;

      console.log('[mutopia] Loaded existing Sanora credentials');
      console.log('[mutopia] UUID:', mutopiaUser.uuid);
      return;
    } catch (err) {
      console.warn('[mutopia] Failed to load credentials:', err.message);
    }
  }

  // Create new Sanora user account for mutopia
  console.log('[mutopia] Creating new Sanora user...');

  const timestamp = Date.now().toString();
  const keys = await sessionless.generateKeys(() => {}, () => null);
  const pubKey = keys.pubKey;
  const message = timestamp + pubKey;
  const signature = await sessionless.sign(message, keys.privateKey);

  const response = await fetch(`http://localhost:${SANORA_PORT}/user/create`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp,
      pubKey,
      signature
    })
  });

  const user = await response.json();

  if (user.error) {
    throw new Error(`Failed to create Sanora user: ${user.error}`);
  }

  mutopiaKeys = keys;
  mutopiaUser = user;

  // Save credentials
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify({
    keys,
    user
  }, null, 2));

  // Setup sessionless
  sessionless.getKeys = () => keys;

  console.log('[mutopia] Created new Sanora user');
  console.log('[mutopia] UUID:', user.uuid);
}

/**
 * Convert JSON feed to Canimus RSS XML
 * Spec: https://github.com/PlaidWeb/Canimus
 */
function convertToCanimusRSS(jsonFeed) {
  const feedTitle = jsonFeed.title || jsonFeed.name || 'Music Feed';
  const feedUrl = jsonFeed.url || jsonFeed.home_page_url || '';
  const feedDescription = jsonFeed.description || '';
  const items = jsonFeed.items || [];

  // Build RSS XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n';
  xml += '  <channel>\n';
  xml += `    <title>${escapeXml(feedTitle)}</title>\n`;
  xml += `    <link>${escapeXml(feedUrl)}</link>\n`;
  xml += `    <description>${escapeXml(feedDescription)}</description>\n`;

  // Add iTunes metadata if available
  if (jsonFeed.author) {
    xml += `    <itunes:author>${escapeXml(jsonFeed.author.name || jsonFeed.author)}</itunes:author>\n`;
  }

  if (jsonFeed.image) {
    xml += '    <image>\n';
    xml += `      <url>${escapeXml(jsonFeed.image)}</url>\n`;
    xml += `      <title>${escapeXml(feedTitle)}</title>\n`;
    xml += `      <link>${escapeXml(feedUrl)}</link>\n`;
    xml += '    </image>\n';
    xml += `    <itunes:image href="${escapeXml(jsonFeed.image)}" />\n`;
  }

  // Add items (tracks)
  items.forEach((item, index) => {
    xml += '    <item>\n';
    xml += `      <title>${escapeXml(item.title || item.name || `Track ${index + 1}`)}</title>\n`;

    if (item.url) {
      xml += `      <link>${escapeXml(item.url)}</link>\n`;
    }

    if (item.id) {
      xml += `      <guid isPermaLink="false">${escapeXml(item.id)}</guid>\n`;
    }

    if (item.summary || item.description) {
      xml += `      <description>${escapeXml(item.summary || item.description)}</description>\n`;
    }

    // Add enclosure for audio file
    if (item.attachments && item.attachments.length > 0) {
      const audio = item.attachments[0];
      const url = audio.url || '';
      const size = audio.size_in_bytes || 0;
      const type = audio.mime_type || 'audio/mpeg';
      xml += `      <enclosure url="${escapeXml(url)}" length="${size}" type="${type}" />\n`;
    } else if (item.content_url) {
      xml += `      <enclosure url="${escapeXml(item.content_url)}" length="0" type="audio/mpeg" />\n`;
    }

    // iTunes-specific fields
    if (item.duration) {
      xml += `      <itunes:duration>${escapeXml(item.duration)}</itunes:duration>\n`;
    }

    if (item.order !== undefined) {
      xml += `      <itunes:order>${item.order}</itunes:order>\n`;
    }

    if (item.date_published) {
      xml += `      <pubDate>${new Date(item.date_published).toUTCString()}</pubDate>\n`;
    }

    xml += '    </item>\n';
  });

  xml += '  </channel>\n';
  xml += '</rss>';

  return xml;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse Canimus RSS feed
 * Spec: https://github.com/PlaidWeb/Canimus
 */
async function parseCanimusFeed(xmlContent) {
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlContent);

  const feed = result.rss || result.feed;
  if (!feed || !feed.channel) {
    throw new Error('Invalid Canimus feed: missing channel');
  }

  const channel = feed.channel[0];
  const items = channel.item || [];

  return {
    title: channel.title?.[0] || 'Untitled Album',
    description: channel.description?.[0] || '',
    image: channel.image?.[0]?.url?.[0] || channel['itunes:image']?.[0]?.$?.href || '',
    author: channel['itunes:author']?.[0] || channel.author?.[0] || 'Unknown Artist',
    tracks: items.map((item, index) => ({
      title: item.title?.[0] || `Track ${index + 1}`,
      description: item.description?.[0] || '',
      enclosure: item.enclosure?.[0]?.$,
      duration: item['itunes:duration']?.[0] || '',
      order: item['itunes:order']?.[0] || index,
      guid: item.guid?.[0]?._ || item.guid?.[0] || null
    }))
  };
}

/**
 * Extract and process Canimus archive
 */
async function processCanimus Archive(filePath) {
  console.log('[mutopia] Processing Canimus archive:', filePath);

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  // Find RSS feed file (feed.xml, feed.rss, or *.xml)
  let feedFile = null;
  let feedContent = null;

  for (const [filename, file] of Object.entries(zip.files)) {
    if (filename.match(/feed\.(xml|rss)$/i) || filename.endsWith('.xml')) {
      feedFile = filename;
      feedContent = await file.async('text');
      break;
    }
  }

  if (!feedContent) {
    throw new Error('No RSS feed found in archive');
  }

  console.log('[mutopia] Found feed:', feedFile);
  const feed = await parseCanimusFeed(feedContent);

  // Extract audio files
  const audioFiles = [];
  for (const [filename, file] of Object.entries(zip.files)) {
    if (filename.match(/\.(mp3|m4a|ogg|flac|wav)$/i)) {
      const buffer = await file.async('nodebuffer');
      audioFiles.push({
        filename,
        buffer,
        size: buffer.length
      });
    }
  }

  console.log(`[mutopia] Found ${audioFiles.length} audio files`);

  return {
    feed,
    audioFiles
  };
}

/**
 * Upload track to Sanora
 * Uses existing Sanora API: PUT /user/:uuid/product/:title + PUT /user/:uuid/product/:title/artifact
 */
async function uploadTrackToSanora(trackData, audioBuffer, filename) {
  console.log('[mutopia] Uploading track to Sanora:', trackData.title);

  if (!mutopiaUser || !mutopiaKeys) {
    throw new Error('Mutopia credentials not loaded');
  }

  const uuid = mutopiaUser.uuid;
  const title = trackData.title;
  const timestamp = Date.now().toString();

  // Step 1: Create product for the track
  const description = `${trackData.album} - ${trackData.artist}`;
  const price = 0; // Free music
  const message = timestamp + uuid + title + description + price;
  const signature = await sessionless.sign(message);

  const createResponse = await fetch(`http://localhost:${SANORA_PORT}/user/${uuid}/product/${encodeURIComponent(title)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp,
      pubKey: mutopiaKeys.pubKey,
      signature,
      description,
      price,
      category: 'music',
      tags: `music,${trackData.artist},${trackData.album}`.toLowerCase()
    })
  });

  const product = await createResponse.json();

  if (product.error) {
    throw new Error(`Failed to create product: ${product.error}`);
  }

  console.log('[mutopia] Created product:', product.productId);

  // Step 2: Upload audio artifact
  const artifactTimestamp = Date.now().toString();
  const artifactMessage = artifactTimestamp + uuid + title;
  const artifactSignature = await sessionless.sign(artifactMessage);

  const formData = new FormData();
  formData.append('artifact', audioBuffer, {
    filename: filename,
    contentType: 'audio/mpeg' // TODO: detect based on file extension
  });

  const uploadResponse = await fetch(`http://localhost:${SANORA_PORT}/user/${uuid}/product/${encodeURIComponent(title)}/artifact`, {
    method: 'PUT',
    headers: {
      'x-pn-artifact-type': 'audio',
      'x-pn-timestamp': artifactTimestamp,
      'x-pn-signature': artifactSignature,
      ...formData.getHeaders()
    },
    body: formData
  });

  const uploadResult = await uploadResponse.json();

  if (uploadResult.error) {
    throw new Error(`Failed to upload artifact: ${uploadResult.error}`);
  }

  console.log('[mutopia] Uploaded audio artifact');

  // Return track info
  return {
    id: product.productId,
    title: trackData.title,
    artist: trackData.artist,
    album: trackData.album,
    duration: trackData.duration,
    url: `http://localhost:${SANORA_PORT}/products/${uuid}/${encodeURIComponent(title)}`,
    uploaded: new Date().toISOString()
  };
}

async function startServer(params) {
  const app = params.app;

  console.log('🎵 wiki-plugin-mutopia starting...');

  // Load or create Sanora credentials
  try {
    await loadMutopiaCredentials();
  } catch (err) {
    console.error('[mutopia] Failed to load credentials:', err);
    console.error('[mutopia] Is Sanora running on port', SANORA_PORT, '?');
    throw err;
  }

  // Owner middleware
  const owner = function (req, res, next) {
    if (!app.securityhandler.isAuthorized(req)) {
      return res.status(401).send('must be owner');
    }
    return next();
  };

  // Create proxy for Sanora and Dolores
  const proxy = httpProxy.createProxyServer({});

  proxy.on('error', function(err, req, res) {
    console.error('[mutopia PROXY ERROR]', err.message);
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Service not available',
      message: err.message,
      hint: 'Is allyabase running?'
    }));
  });

  /**
   * Upload Canimus archive
   * POST /plugin/mutopia/upload
   */
  app.post('/plugin/mutopia/upload', owner, upload.single('archive'), async function(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('[mutopia] Received upload:', req.file.originalname);

      // Process the archive
      const { feed, audioFiles } = await processCanimusArchive(req.file.path);

      // Upload tracks to Sanora
      const uploadedTracks = [];
      for (let i = 0; i < feed.tracks.length; i++) {
        const trackMeta = feed.tracks[i];

        // Find matching audio file
        const audioFile = audioFiles.find(f => {
          const enclosureUrl = trackMeta.enclosure?.url || '';
          const basename = path.basename(enclosureUrl);
          return f.filename.includes(basename) || f.filename.includes(trackMeta.title);
        }) || audioFiles[i];

        if (audioFile) {
          const result = await uploadTrackToSanora({
            title: trackMeta.title,
            artist: feed.author,
            album: feed.title,
            duration: trackMeta.duration,
            order: trackMeta.order
          }, audioFile.buffer, audioFile.filename);

          uploadedTracks.push(result);
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        album: {
          title: feed.title,
          artist: feed.author,
          description: feed.description,
          image: feed.image,
          trackCount: uploadedTracks.length
        },
        tracks: uploadedTracks
      });

    } catch (err) {
      console.error('[mutopia] Upload error:', err);

      // Clean up on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: err.message,
        stack: err.stack
      });
    }
  });

  /**
   * Get feed in RSS or JSON format
   * GET /plugin/mutopia/feed?format=rss|json
   * Or use Accept header: application/rss+xml or application/json
   */
  app.get('/plugin/mutopia/feed', async function(req, res) {
    try {
      if (!mutopiaUser) {
        return res.status(404).json({
          success: false,
          error: 'No music library available'
        });
      }

      // Fetch JSON feed from Sanora
      const feedResponse = await fetch(`http://localhost:${SANORA_PORT}/feeds/music/${mutopiaUser.uuid}`);
      const jsonFeed = await feedResponse.json();

      if (jsonFeed.error) {
        throw new Error(jsonFeed.error);
      }

      // Determine format (query param takes precedence over Accept header)
      const formatParam = req.query.format?.toLowerCase();
      const acceptHeader = req.get('Accept') || '';

      const wantsRss = formatParam === 'rss' ||
                       formatParam === 'xml' ||
                       acceptHeader.includes('application/rss+xml') ||
                       acceptHeader.includes('application/xml') ||
                       acceptHeader.includes('text/xml');

      if (wantsRss) {
        // Convert JSON to Canimus RSS
        const rssXml = convertToCanimusRSS(jsonFeed);
        res.set('Content-Type', 'application/rss+xml; charset=utf-8');
        res.send(rssXml);
      } else {
        // Return JSON (default)
        res.set('Content-Type', 'application/json');
        res.json(jsonFeed);
      }
    } catch (err) {
      console.error('[mutopia] Feed error:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * Get library (list all albums/tracks)
   * GET /plugin/mutopia/library
   */
  app.get('/plugin/mutopia/library', async function(req, res) {
    try {
      if (!mutopiaUser) {
        return res.json({
          success: true,
          albums: [],
          tracks: []
        });
      }

      // Query Sanora's Canimus feed for this user
      const feedResponse = await fetch(`http://localhost:${SANORA_PORT}/feeds/music/${mutopiaUser.uuid}`);
      const feed = await feedResponse.json();

      if (feed.error) {
        throw new Error(feed.error);
      }

      // Parse the feed to extract albums and tracks
      const tracks = feed.items || [];
      const albums = new Map();

      // Group tracks by album (using summary field or other metadata)
      tracks.forEach(track => {
        const albumName = track.album || 'Unknown Album';
        if (!albums.has(albumName)) {
          albums.set(albumName, {
            title: albumName,
            tracks: []
          });
        }
        albums.get(albumName).tracks.push(track);
      });

      res.json({
        success: true,
        albums: Array.from(albums.values()),
        tracks: tracks
      });
    } catch (err) {
      console.error('[mutopia] Library error:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  /**
   * Proxy to Sanora (track storage)
   * GET/POST /plugin/mutopia/sanora/*
   */
  app.all('/plugin/mutopia/sanora/*', function(req, res) {
    const targetPath = req.url.replace('/plugin/mutopia/sanora', '');
    req.url = targetPath;

    proxy.web(req, res, {
      target: `http://localhost:${SANORA_PORT}`,
      changeOrigin: true
    });
  });

  /**
   * Proxy to Dolores (audio player)
   * GET/POST /plugin/mutopia/dolores/*
   */
  app.all('/plugin/mutopia/dolores/*', function(req, res) {
    const targetPath = req.url.replace('/plugin/mutopia/dolores', '');
    req.url = targetPath;

    proxy.web(req, res, {
      target: `http://localhost:${DOLORES_PORT}`,
      changeOrigin: true
    });
  });

  /**
   * Serve bauble WASM file
   * GET /plugin/mutopia/bauble.wasm
   */
  app.get('/plugin/mutopia/bauble.wasm', function(req, res) {
    const wasmPath = path.join(__dirname, '../bauble/target/wasm32-unknown-unknown/release/mutopia_bauble.wasm');

    if (fs.existsSync(wasmPath)) {
      res.setHeader('Content-Type', 'application/wasm');
      res.sendFile(wasmPath);
    } else {
      res.status(404).json({
        error: 'Bauble not built',
        hint: 'Run: cd bauble && cargo build --target wasm32-unknown-unknown --release'
      });
    }
  });

  console.log('✅ wiki-plugin-mutopia ready!');
  console.log('📍 Routes:');
  console.log('   POST /plugin/mutopia/upload - Upload Canimus archive');
  console.log('   GET /plugin/mutopia/feed?format=rss|json - Get feed (RSS or JSON)');
  console.log('   GET /plugin/mutopia/library - Get music library');
  console.log('   GET /plugin/mutopia/bauble.wasm - Bauble WASM');
  console.log('   /plugin/mutopia/sanora/* -> http://localhost:' + SANORA_PORT + '/*');
  console.log('   /plugin/mutopia/dolores/* -> http://localhost:' + DOLORES_PORT + '/*');
}

module.exports = { startServer };
}).call(this);
