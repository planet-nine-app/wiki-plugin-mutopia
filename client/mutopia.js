(function() {

  window.plugins.mutopia = {
    emit: function($item, item) {
      const div = $item[0];

      // Render SVG-based UI
      div.innerHTML = `
        <div style="width: 100%; max-width: 800px; margin: 0 auto;">
          <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
            <!-- Background -->
            <defs>
              <linearGradient id="mutopia-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
              </linearGradient>

              <filter id="shadow">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                <feOffset dx="0" dy="2" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.3"/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <rect width="800" height="600" fill="url(#mutopia-bg)"/>

            <!-- Header -->
            <text x="400" y="60"
                  font-family="-apple-system, sans-serif"
                  font-size="36"
                  font-weight="bold"
                  fill="#ffffff"
                  text-anchor="middle"
                  filter="url(#shadow)">
              🎵 Mutopia Music
            </text>

            <text x="400" y="95"
                  font-family="-apple-system, sans-serif"
                  font-size="16"
                  fill="rgba(255,255,255,0.8)"
                  text-anchor="middle">
              Distributed Music Platform • Powered by Canimus
            </text>

            <!-- Upload Card -->
            <g id="upload-card" transform="translate(100, 130)">
              <rect width="600" height="180" rx="15" fill="#ffffff" filter="url(#shadow)"/>

              <!-- Upload Icon -->
              <g transform="translate(50, 40)">
                <circle cx="40" cy="40" r="40" fill="#667eea" opacity="0.1"/>
                <path d="M 40 20 L 40 60 M 20 40 L 40 20 L 60 40"
                      stroke="#667eea"
                      stroke-width="3"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"/>
              </g>

              <!-- Upload Text -->
              <text x="150" y="70"
                    font-family="-apple-system, sans-serif"
                    font-size="24"
                    font-weight="bold"
                    fill="#333">
                Upload Canimus Archive
              </text>

              <text x="150" y="100"
                    font-family="-apple-system, sans-serif"
                    font-size="14"
                    fill="#666">
                Upload a ZIP archive containing your Canimus RSS feed
              </text>

              <text x="150" y="120"
                    font-family="-apple-system, sans-serif"
                    font-size="14"
                    fill="#666">
                and audio files (MP3, M4A, OGG, FLAC, WAV)
              </text>

              <!-- Upload Button -->
              <g id="upload-button"
                 class="clickable"
                 transform="translate(400, 135)"
                 style="cursor: pointer;">
                <rect width="160" height="40" rx="20" fill="#10b981"/>
                <text x="80" y="26"
                      font-family="-apple-system, sans-serif"
                      font-size="15"
                      font-weight="600"
                      fill="#ffffff"
                      text-anchor="middle"
                      pointer-events="none">
                  Choose File
                </text>
              </g>
            </g>

            <!-- Library Card -->
            <g id="library-card" transform="translate(100, 340)">
              <rect width="600" height="180" rx="15" fill="#ffffff" filter="url(#shadow)"/>

              <!-- Library Icon -->
              <g transform="translate(50, 40)">
                <circle cx="40" cy="40" r="40" fill="#8b5cf6" opacity="0.1"/>
                <rect x="20" y="30" width="40" height="35" rx="2"
                      stroke="#8b5cf6"
                      stroke-width="2.5"
                      fill="none"/>
                <line x1="20" y1="40" x2="60" y2="40"
                      stroke="#8b5cf6"
                      stroke-width="2.5"/>
                <line x1="20" y1="50" x2="60" y2="50"
                      stroke="#8b5cf6"
                      stroke-width="2.5"/>
              </g>

              <!-- Library Text -->
              <text x="150" y="70"
                    font-family="-apple-system, sans-serif"
                    font-size="24"
                    font-weight="bold"
                    fill="#333">
                Music Library
              </text>

              <text x="150" y="100"
                    font-family="-apple-system, sans-serif"
                    font-size="14"
                    fill="#666">
                Browse and play your uploaded music collection
              </text>

              <text x="150" y="120"
                    font-family="-apple-system, sans-serif"
                    font-size="14"
                    fill="#666">
                Powered by Sanora storage and Dolores playback
              </text>

              <!-- View Library Button -->
              <g id="library-button"
                 class="clickable"
                 transform="translate(400, 135)"
                 style="cursor: pointer;">
                <rect width="160" height="40" rx="20" fill="#8b5cf6"/>
                <text x="80" y="26"
                      font-family="-apple-system, sans-serif"
                      font-size="15"
                      font-weight="600"
                      fill="#ffffff"
                      text-anchor="middle"
                      pointer-events="none">
                  View Library
                </text>
              </g>
            </g>
          </svg>

          <!-- Hidden file input -->
          <input type="file"
                 id="mutopia-file-input"
                 accept=".zip,.tar,.tar.gz"
                 style="display: none;">

          <!-- Status message area -->
          <div id="mutopia-status" style="margin-top: 20px; text-align: center;"></div>
        </div>
      `;

      // Add event listeners
      setupEventListeners(div);
    },

    bind: function($item, item) {
      // Nothing to bind
    }
  };

  function setupEventListeners(container) {
    const uploadButton = container.querySelector('#upload-button');
    const libraryButton = container.querySelector('#library-button');
    const fileInput = container.querySelector('#mutopia-file-input');
    const statusDiv = container.querySelector('#mutopia-status');

    // Upload button click
    if (uploadButton) {
      uploadButton.addEventListener('click', function() {
        fileInput.click();
      });

      // Hover effect
      uploadButton.addEventListener('mouseenter', function() {
        this.querySelector('rect').setAttribute('fill', '#059669');
      });
      uploadButton.addEventListener('mouseleave', function() {
        this.querySelector('rect').setAttribute('fill', '#10b981');
      });
    }

    // Library button click
    if (libraryButton) {
      libraryButton.addEventListener('click', function() {
        showLibrary(statusDiv);
      });

      // Hover effect
      libraryButton.addEventListener('mouseenter', function() {
        this.querySelector('rect').setAttribute('fill', '#7c3aed');
      });
      libraryButton.addEventListener('mouseleave', function() {
        this.querySelector('rect').setAttribute('fill', '#8b5cf6');
      });
    }

    // File input change
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          uploadArchive(file, statusDiv);
        }
      });
    }
  }

  async function uploadArchive(file, statusDiv) {
    statusDiv.innerHTML = `
      <div style="background: #fef3cd; padding: 15px; border-radius: 8px; color: #856404;">
        ⏳ Uploading and processing ${file.name}...
      </div>
    `;

    const formData = new FormData();
    formData.append('archive', file);

    try {
      const response = await fetch('/plugin/mutopia/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        statusDiv.innerHTML = `
          <div style="background: #d4edda; padding: 20px; border-radius: 8px; color: #155724;">
            <h3 style="margin: 0 0 10px 0;">✅ Upload Successful!</h3>
            <p style="margin: 5px 0;"><strong>Album:</strong> ${result.album.title}</p>
            <p style="margin: 5px 0;"><strong>Artist:</strong> ${result.album.artist}</p>
            <p style="margin: 5px 0;"><strong>Tracks:</strong> ${result.album.trackCount}</p>
            <button onclick="location.reload()" style="
              margin-top: 15px;
              padding: 10px 20px;
              background: #10b981;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
            ">
              Upload Another
            </button>
          </div>
        `;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      statusDiv.innerHTML = `
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; color: #721c24;">
          ❌ Upload failed: ${err.message}
        </div>
      `;
    }
  }

  async function showLibrary(statusDiv) {
    statusDiv.innerHTML = `
      <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; color: #0c5460;">
        ⏳ Loading library...
      </div>
    `;

    try {
      const response = await fetch('/plugin/mutopia/library');
      const result = await response.json();

      if (result.success) {
        if (result.albums.length === 0 && result.tracks.length === 0) {
          statusDiv.innerHTML = `
            <div style="background: #e2e3e5; padding: 20px; border-radius: 8px; color: #383d41;">
              <p style="margin: 0;">📚 Your library is empty</p>
              <p style="margin: 10px 0 0 0; font-size: 14px;">Upload a Canimus archive to get started!</p>
            </div>
          `;
        } else {
          statusDiv.innerHTML = `
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; color: #155724;">
              <h3 style="margin: 0 0 10px 0;">📚 Library</h3>
              <p><strong>Albums:</strong> ${result.albums.length}</p>
              <p><strong>Tracks:</strong> ${result.tracks.length}</p>
            </div>
          `;
        }
      } else {
        throw new Error(result.error || 'Failed to load library');
      }
    } catch (err) {
      statusDiv.innerHTML = `
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; color: #721c24;">
          ❌ Error: ${err.message}
        </div>
      `;
    }
  }

})();
