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

  async generateAudioURLs(text, voice) {
    const processed = preprocessTextForTTS(text);
    // Reduce TTS chunk size significantly for better API reliability
    const chunks = splitTextIntoChunks(processed, 500);
    const urls = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        console.log(`Generating TTS chunk ${i+1}/${chunks.length}`);
        const res = await this.generateTTSWithTimeout(chunks[i], voice, 30000);
        if (res && res.url && typeof res.url === 'string' && res.url.length > 0) {
          urls.push(res.url);
          console.log(`Successfully generated chunk ${i+1}`);
        } else {
          console.warn(`Chunk ${i+1} returned invalid response:`, res);
        }
      } catch (err) {
        console.error(`Error generating chunk ${i+1}:`, err);
        // Continue with other chunks even if one fails
      }
    }
    if (!urls.length) {
      throw new Error('Failed to generate any valid audio chunks');
    }
    console.log(`Generated ${urls.length}/${chunks.length} audio chunks successfully`);
    return urls;
  }

  generateTTSWithTimeout(text, voice, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('TTS generation timeout')), timeoutMs);
      
      // Validate inputs before making the call
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        clearTimeout(to);
        reject(new Error('Invalid text input for TTS'));
        return;
      }
      
      if (!voice || typeof voice !== 'string') {
        clearTimeout(to);
        reject(new Error('Invalid voice input for TTS'));
        return;
      }
      
      websim.textToSpeech({ text: text.trim(), voice })
        .then(r => { 
          clearTimeout(to); 
          if (r && r.url && typeof r.url === 'string' && r.url.length > 0) {
            resolve(r);
          } else {
            reject(new Error('Invalid TTS response - no valid URL returned'));
          }
        })
        .catch(e => { 
          clearTimeout(to); 
          reject(new Error(`TTS API error: ${e.message || 'Unknown error'}`));
        });
    });
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
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata'; // Changed from 'auto' to 'metadata' for faster loading
    
    // Set playback rate first
    audio.playbackRate = rate || 1;
    
    // Add comprehensive error handling
    audio.addEventListener('error', (e) => {
      console.error('Audio loading error:', e, 'URL:', audio.src);
      // Try next chunk if available
      if (this.currentAudioIndex < this.currentAudioUrls.length - 1) {
        console.log('Trying next audio chunk due to error...');
        this.playNextChunk();
      } else {
        console.error('All audio chunks failed to load');
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
      const next = new Audio(this.currentAudioUrls[this.currentAudioIndex]);
      next.playbackRate = this.currentAudio.playbackRate;
      next.addEventListener('ended', () => this.playNextChunk());
      next.play().catch(err => console.error('Error playing next audio chunk:', err));
      this.currentAudio = next;
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