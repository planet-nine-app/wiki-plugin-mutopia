# wiki-plugin-mutopia

> **🎵 Distributed Music Platform for The Advancement**
>
> Upload Canimus archives and play music using Sanora storage + Dolores playback

A Federated Wiki plugin for distributing music to communities using the [Canimus feed spec](https://github.com/PlaidWeb/Canimus).

## Features

- **Privacy-First** - No tracking, community-owned music
- **Canimus Support** - Standard RSS-based audio feed format
- **Distributed Storage** - Uses Sanora (allyabase service) for track storage
- **Native Playback** - Uses Dolores (allyabase service) for audio playback
- **SVG-Based UI** - PLACE-agnostic interface (works in wiki, Roam, anywhere)
- **Federation Ready** - Tracks can be shared across federated wikis

## Quick Start

### Prerequisites

1. **Allyabase running**: Mutopia requires Sanora and Dolores services
   ```bash
   # Launch allyabase via the plugin
   curl -X POST http://localhost:3000/plugin/allyabase/launch

   # Wait for services to start (~60 seconds)
   # Check status
   curl http://localhost:3000/plugin/allyabase/healthcheck
   ```

2. **Canimus archive**: A ZIP file containing:
   - RSS feed (feed.xml or feed.rss)
   - Audio files (MP3, M4A, OGG, FLAC, WAV)

### Installation

```bash
# Via plugmatic (recommended)
# Add "mutopia" to a plugmatic item in your wiki

# Or via npm
cd /path/to/wiki/node_modules
git clone https://github.com/planet-nine-app/wiki-plugin-mutopia.git
cd wiki-plugin-mutopia
npm install
```

### Usage

1. **Add mutopia item to a wiki page**:
   ```json
   {
     "type": "mutopia",
     "id": "unique-id",
     "text": "My Music Library"
   }
   ```

2. **Upload Canimus archive**:
   - Click "Choose File"
   - Select your Canimus ZIP archive
   - Wait for upload and processing
   - Tracks are stored in Sanora

3. **Play music**:
   - Click "View Library" to browse uploaded music
   - Use Dolores player for playback

## Canimus Feed Format

Mutopia uses the [Canimus](https://github.com/PlaidWeb/Canimus) RSS feed specification:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>My Album</title>
    <description>A collection of tracks</description>
    <itunes:author>Artist Name</itunes:author>
    <itunes:image href="cover.jpg"/>

    <item>
      <title>Track 1</title>
      <description>First track</description>
      <enclosure url="track1.mp3" type="audio/mpeg" length="5242880"/>
      <itunes:duration>3:42</itunes:duration>
      <itunes:order>1</itunes:order>
    </item>

    <item>
      <title>Track 2</title>
      <enclosure url="track2.mp3" type="audio/mpeg" length="6291456"/>
      <itunes:duration>4:15</itunes:duration>
      <itunes:order>2</itunes:order>
    </item>
  </channel>
</rss>
```

### Creating a Canimus Archive

```bash
# 1. Create feed.xml with your track metadata
# 2. Add audio files (MP3, M4A, etc.)
# 3. Create ZIP archive

zip -r my-album.zip feed.xml *.mp3 cover.jpg
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /plugin/mutopia/upload | Upload Canimus archive |
| GET | /plugin/mutopia/library | Get music library |
| ALL | /plugin/mutopia/sanora/* | Proxy to Sanora (track storage) |
| ALL | /plugin/mutopia/dolores/* | Proxy to Dolores (audio player) |

### Upload API

```bash
curl -X POST http://localhost:3000/plugin/mutopia/upload \
  -F "archive=@my-album.zip"
```

Response:
```json
{
  "success": true,
  "album": {
    "title": "My Album",
    "artist": "Artist Name",
    "description": "A collection of tracks",
    "image": "cover.jpg",
    "trackCount": 12
  },
  "tracks": [
    {
      "id": "track_1234567890_abc123",
      "title": "Track 1",
      "artist": "Artist Name",
      "duration": "3:42",
      "url": "http://localhost:7243/track/track_1234567890_abc123",
      "uploaded": "2026-02-04T12:00:00.000Z"
    }
  ]
}
```

## Architecture

### Integration with Allyabase Services

```
wiki-plugin-mutopia
├── Upload Canimus archive
│   ├── Parse RSS feed (xml2js)
│   ├── Extract audio files (JSZip)
│   └── Upload to Sanora (7243)
│
├── Storage (Sanora - port 7243)
│   ├── Store audio files
│   ├── Store track metadata
│   └── Generate track emojicodes
│
└── Playback (Dolores - port 3007)
    ├── Audio player UI
    ├── Queue management
    └── Playlist support
```

### File Flow

1. **Upload**: User uploads ZIP → Server extracts files
2. **Parse**: RSS feed parsed → Track metadata extracted
3. **Store**: Audio files → Sanora storage
4. **Metadata**: Track info → Sanora database
5. **Play**: Dolores player → Streams from Sanora

## Part of The Advancement

Mutopia is part of **The Advancement** - rebuilding platforms for communities:

**Replaces**: Spotify, SoundCloud, Bandcamp
**Cost**: Community-hosted (vs $10/month + platform fees)
**Features**:
- Community music hosting
- Artist royalties (100%, no platform cut)
- No platform fees
- Federation-ready (share across wikis)
- Privacy-first (no tracking)

See [THE-ADVANCEMENT.md](./THE-ADVANCEMENT.md) for the full vision.

## Development

### Project Structure

```
wiki-plugin-mutopia/
├── client/
│   └── mutopia.js         # SVG-based UI
├── server/
│   └── server.js          # Upload + Sanora/Dolores integration
├── package.json           # Dependencies
├── factory.json           # Plugin metadata
├── index.js               # Entry point
├── README.md              # This file
├── CLAUDE.md              # Developer documentation
└── THE-ADVANCEMENT.md     # Vision document
```

### Dependencies

- **multer**: File upload handling
- **jszip**: ZIP archive extraction
- **xml2js**: RSS feed parsing
- **http-proxy**: Proxy to Sanora/Dolores
- **node-fetch**: HTTP requests

### Testing

```bash
# 1. Start wiki with allyabase
wiki --port 3000

# 2. Launch allyabase services
curl -X POST http://localhost:3000/plugin/allyabase/launch

# 3. Create test Canimus archive
cd test
./create-test-archive.sh

# 4. Upload via UI or API
curl -X POST http://localhost:3000/plugin/mutopia/upload \
  -F "archive=@test-album.zip"
```

## Roadmap

### Phase 1: MVP ✅
- ✅ Canimus archive upload
- ✅ RSS feed parsing
- ✅ Sanora integration (storage)
- ✅ Dolores integration (playback)
- ✅ SVG-based UI

### Phase 2: Enhanced Library
- 🔲 Album browsing UI
- 🔲 Track search and filtering
- 🔲 Playlist creation
- 🔲 Album art display
- 🔲 Embedded player widget

### Phase 3: Federation
- 🔲 Cross-wiki track sharing
- 🔲 Federated playlists
- 🔲 Artist emojicodes
- 🔲 Track emojicodes (9-emoji format)

### Phase 4: Creator Features
- 🔲 Artist profiles (stored in Fount)
- 🔲 Royalty tracking (via Addie)
- 🔲 Direct artist payments
- 🔲 Tip jar integration

### Phase 5: Advanced Features
- 🔲 Streaming optimization
- 🔲 Offline caching
- 🔲 Lyrics support
- 🔲 Collaborative playlists
- 🔲 Music discovery

## License

MIT

## Credits

- **Canimus Spec**: [PlaidWeb/Canimus](https://github.com/PlaidWeb/Canimus)
- **Sanora**: Track storage service (allyabase)
- **Dolores**: Audio playback service (allyabase)
- **Built with ❤️ by Planet Nine**
