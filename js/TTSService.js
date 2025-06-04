import {
  preprocessTextForTTS,
  splitTextIntoChunks
} from './Utils.js';

export default class TTSService {
  constructor() {
    this.currentAudio = null;
    this.currentAudioUrls = null;
    this.currentAudioIndex = 0;
  }

  async generateAudioURLs(text, voice, progressCallback) {
    const processed = preprocessTextForTTS(text);
    // Reduce TTS chunk size significantly for better API reliability
    const chunks = splitTextIntoChunks(processed, 500);
    const urls = [];

    for (let i = 0; i < chunks.length; i++) {
      if (progressCallback) {
        progressCallback(i, chunks.length);
      }
      
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!success && attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`Generating TTS chunk ${i+1}/${chunks.length} (attempt ${attempts}/${maxAttempts})`);
          const res = await this.generateTTSWithRetry(chunks[i], voice, attempts);
          if (res && res.url && typeof res.url === 'string' && res.url.length > 0) {
            urls.push(res.url);
            console.log(`Successfully generated chunk ${i+1}`);
            success = true;
          } else {
            throw new Error('Invalid response from TTS API');
          }
        } catch (err) {
          console.error(`Error generating chunk ${i+1}, attempt ${attempts}:`, err);
          if (attempts >= maxAttempts) {
            throw new Error(`Failed to generate chunk ${i+1} after ${maxAttempts} attempts: ${err.message}`);
          }
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          console.log(`Retrying chunk ${i+1} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (progressCallback) {
      progressCallback(chunks.length, chunks.length);
    }
    
    if (!urls.length) {
      throw new Error('Failed to generate any valid audio chunks');
    }
    console.log(`Generated ${urls.length}/${chunks.length} audio chunks successfully`);
    return urls;
  }

  async generateTTSWithRetry(text, voice, attempt = 1) {
    // Validate inputs before making the call
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Invalid text input for TTS');
    }
    
    if (!voice || typeof voice !== 'string') {
      throw new Error('Invalid voice input for TTS');
    }

    // Increase timeout for subsequent attempts
    const timeoutMs = 20000 + (attempt * 10000); // 20s, 30s, 40s
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`TTS generation timeout after ${timeoutMs}ms (attempt ${attempt})`));
      }, timeoutMs);
      
      websim.textToSpeech({ text: text.trim(), voice })
        .then(response => { 
          clearTimeout(timeout);
          if (response && response.url && typeof response.url === 'string' && response.url.length > 0) {
            resolve(response);
          } else {
            reject(new Error('Invalid TTS response - no valid URL returned'));
          }
        })
        .catch(error => { 
          clearTimeout(timeout);
          reject(new Error(`TTS API error: ${error.message || 'Unknown error'}`));
        });
    });
  }

  generateTTSWithTimeout(text, voice, timeoutMs = 30000) {
    // Deprecated - use generateTTSWithRetry instead
    return this.generateTTSWithRetry(text, voice, 1);
  }

  createAudioPlayer(urls, rate) {
    this.cleanup();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('No valid audio URLs provided');
    }
    
    // Validate URLs more strictly
    const validUrls = urls.filter(url => 
      url && 
      typeof url === 'string' && 
      url.length > 0 && 
      (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))
    );
    
    if (validUrls.length === 0) {
      throw new Error('No valid audio URLs found');
    }
    
    this.currentAudioUrls = validUrls;
    this.currentAudioIndex = 0;
    
    // Create audio element with better initialization
    const audio = new Audio();
    audio.preload = 'metadata';
    
    // Set playback rate first
    audio.playbackRate = rate || 1;
    
    // Add comprehensive error handling with retry logic
    audio.addEventListener('error', (e) => {
      console.error('Audio loading error:', e, 'URL:', audio.src);
      // Try to retry the same chunk once before moving to next
      if (!audio.hasRetried) {
        console.log('Retrying current audio chunk...');
        audio.hasRetried = true;
        setTimeout(() => {
          try {
            audio.load(); // Reload the same chunk
          } catch (retryError) {
            console.error('Retry failed, moving to next chunk:', retryError);
            this.playNextChunk();
          }
        }, 1000);
      } else {
        // Try next chunk if available
        if (this.currentAudioIndex < this.currentAudioUrls.length - 1) {
          console.log('Moving to next audio chunk due to error...');
          this.playNextChunk();
        } else {
          console.error('All audio chunks failed to load');
          // Don't throw error, just log it
        }
      }
    });
    
    // Set source and add end handler
    audio.src = validUrls[0];
    audio.addEventListener('ended', () => this.playNextChunk());
    
    this.currentAudio = audio;
    return audio;
  }

  playNextChunk() {
    if (this.currentAudioUrls && this.currentAudioIndex < this.currentAudioUrls.length - 1) {
      this.currentAudioIndex++;
      
      try {
        const next = new Audio(this.currentAudioUrls[this.currentAudioIndex]);
        next.playbackRate = this.currentAudio.playbackRate;
        
        // Add error handling for next chunk
        next.addEventListener('error', (e) => {
          console.error('Error loading next chunk:', e);
          // Skip to following chunk if this one fails
          if (this.currentAudioIndex < this.currentAudioUrls.length - 1) {
            this.playNextChunk();
          }
        });
        
        next.addEventListener('ended', () => this.playNextChunk());
        
        next.play().catch(err => {
          console.error('Error playing next audio chunk:', err);
          // Try to continue with next chunk
          if (this.currentAudioIndex < this.currentAudioUrls.length - 1) {
            this.playNextChunk();
          }
        });
        
        this.currentAudio = next;
      } catch (error) {
        console.error('Error creating next audio chunk:', error);
        // Try to continue with following chunk
        if (this.currentAudioIndex < this.currentAudioUrls.length - 1) {
          this.playNextChunk();
        }
      }
    }
  }

  downloadAudio(filename) {
    if (!this.currentAudioUrls || !this.currentAudioUrls.length) return;
    const a = document.createElement('a');
    a.href = this.currentAudioUrls[0];
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  cleanup() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }
}