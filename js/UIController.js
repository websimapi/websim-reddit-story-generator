export default class UIController {
  constructor(storyService, ttsService) {
    this.storyService = storyService;
    this.ttsService = ttsService;
    this.selectedSubreddit = 'tifu';

    this.initializeElements();
    this.attachEventListeners();
    this.updateTheme();
  }

  initializeElements() {
    this.elements = {
      subredditBtns: document.querySelectorAll('.subreddit-btn'),
      storyPrompt: document.getElementById('storyPrompt'),
      storyLength: document.getElementById('storyLength'),
      descriptiveness: document.getElementById('descriptiveness'),
      voiceSelect: document.getElementById('voiceSelect'),
      pitchControl: document.getElementById('pitchControl'),
      speedControl: document.getElementById('speedControl'),
      pitchValue: document.getElementById('pitchValue'),
      speedValue: document.getElementById('speedValue'),
      generateBtn: document.getElementById('generateBtn'),
      loadingSection: document.getElementById('loadingSection'),
      storyDisplay: document.getElementById('storyDisplay'),
      storyTitle: document.getElementById('storyTitle'),
      storyContent: document.getElementById('storyContent'),
      subredditDisplay: document.getElementById('subredditDisplay'),
      upvoteCount: document.getElementById('upvoteCount'),
      playStoryBtn: document.getElementById('playStoryBtn'),
      downloadAudioBtn: document.getElementById('downloadAudioBtn'),
      themeToggle: document.getElementById('themeToggle'),
      ttsProgress: document.getElementById('ttsProgress'),
      ttsProgressBar: document.getElementById('ttsProgressBar'),
      ttsProgressText: document.getElementById('ttsProgressText'),
    };
  }

  attachEventListeners() {
    this.elements.subredditBtns.forEach(btn =>
      btn.addEventListener('click', () => this.selectSubreddit(btn))
    );
    this.elements.pitchControl.addEventListener('input', e =>
      this.elements.pitchValue.textContent = parseFloat(e.target.value).toFixed(1)
    );
    this.elements.speedControl.addEventListener('input', e =>
      this.elements.speedValue.textContent = parseFloat(e.target.value).toFixed(1)
    );
    this.elements.generateBtn.addEventListener('click', () => this.handleGenerateStory());
    this.elements.playStoryBtn.addEventListener('click', () => this.handlePlayStory());
    this.elements.downloadAudioBtn.addEventListener('click', () => this.handleDownloadAudio());
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
  }

  selectSubreddit(btn) {
    this.elements.subredditBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.selectedSubreddit = btn.dataset.subreddit;
  }

  async handleGenerateStory() {
    if (!this.elements.storyPrompt.value.trim()) {
      alert('Please describe what your story should be about!');
      return;
    }
    this.elements.generateBtn.disabled = true;
    this.elements.loadingSection.style.display = 'block';
    this.elements.storyDisplay.style.display = 'none';
    this.elements.ttsProgress.style.display = 'none'; // Ensure TTS progress is hidden

    try {
      const story = await this.storyService.generateStory(
        this.elements.storyPrompt.value,
        this.selectedSubreddit,
        parseInt(this.elements.storyLength.value),
        parseInt(this.elements.descriptiveness.value)
      );
      this.displayStory(story);
    } catch (err) {
      console.error('Error generating story:', err);
      let userMessage = 'Sorry, there was an error generating your story. Please try again!';
      if (err.message) {
          if (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('timeout')) {
            userMessage = 'There seems to be a network issue preventing story generation. Please check your internet connection and try again. If the problem persists, the story might be too complex for the current network conditions or the service might be temporarily unavailable.';
          } else if (err.message.includes('Failed to generate story part')) {
            userMessage = `Story generation failed after multiple attempts: ${err.message}. Please try a simpler prompt, a shorter story, or check your connection.`;
          }
      }
      alert(userMessage);
    } finally {
      this.elements.generateBtn.disabled = false;
      this.elements.loadingSection.style.display = 'none';
    }
  }

  displayStory(story) {
    const lines = story.split('\n').filter(l => l.trim());
    let title = lines[0] || "Untitled Story";
    if (title.length > 100) title = title.slice(0, 97) + '...';
    const up = Math.floor(Math.random() * 5000) + 100;
    const upText = up > 1000 ? `${(up/1000).toFixed(1)}k` : `${up}`;
    
    // Remove punctuation as per previous request for TTS compatibility
    const storyTextForDisplay = story.replace(/[.,]/g, '');
    const titleForDisplay = title.replace(/[.,]/g, '');

    this.elements.storyTitle.textContent = titleForDisplay;
    this.elements.storyContent.textContent = storyTextForDisplay;
    this.elements.subredditDisplay.textContent = `r/${this.selectedSubreddit}`;
    this.elements.upvoteCount.textContent = upText;
    this.elements.storyDisplay.style.display = 'block';
    this.elements.downloadAudioBtn.style.display = 'none';
    this.ttsService.cleanup();
    this.resetAudioControls(); // Resets play button and hides TTS progress
  }

  async handlePlayStory() {
    if (this.ttsService.currentAudio && !this.ttsService.currentAudio.paused) {
      this.ttsService.currentAudio.pause();
      this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
      return;
    }
    if (this.ttsService.currentAudio && this.ttsService.currentAudio.paused) {
      this.ttsService.currentAudio.play().catch(e => {
        console.error('Error resuming audio:', e);
        this.resetAudioControls();
      });
      this.elements.playStoryBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Story';
      return;
    }
    
    this.elements.playStoryBtn.disabled = true;
    this.elements.playStoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
    
    // Show and reset the dedicated progress bar section
    this.elements.ttsProgress.style.display = 'block';
    this.elements.ttsProgressBar.style.width = '0%';
    this.elements.ttsProgressText.textContent = 'Initializing audio generation...';
    
    try {
      const text = this.elements.storyContent.textContent;
      const voice = this.elements.voiceSelect.value;
      const rate = parseFloat(this.elements.speedControl.value);
      
      if (!text || text.trim().length === 0) {
        throw new Error('No story text available for TTS');
      }
      if (!voice) {
        throw new Error('No voice selected for TTS');
      }
      
      console.log('Starting TTS generation...');
      
      const progressCallback = (current, total) => {
        const percent = total > 0 ? (current / total) * 100 : 0;
        this.elements.ttsProgressBar.style.width = `${percent}%`;
        
        if (current < total) {
          const remaining = total - current;
          const message = `Generating audio chunk ${current + 1} of ${total}... (${remaining} left)`;
          this.elements.ttsProgressText.textContent = message;
          this.elements.playStoryBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating... ${remaining} left`;
        } else {
          this.elements.ttsProgressText.textContent = 'All audio chunks generated. Preparing for playback...';
          this.elements.playStoryBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Finalizing Audio...`;
        }
      };
      
      const urls = await this.ttsService.generateAudioURLs(text, voice, progressCallback);
      console.log('TTS generation completed, creating audio player...');
      
      this.elements.playStoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Audio...';
      const audio = this.ttsService.createAudioPlayer(urls, rate);
      
      const loadingTimeoutDuration = 20000; // 20 seconds
      const loadingTimeout = setTimeout(() => {
        console.error(`Audio loading timeout after ${loadingTimeoutDuration/1000} seconds`);
        if (audio.readyState < 2 && !audio.error) { // HAVE_NOTHING or HAVE_METADATA
             this.resetAudioControls();
             alert('Audio loading took too long. Please try again with a shorter story or different voice.');
        }
      }, loadingTimeoutDuration);

      const onAudioReady = () => {
        clearTimeout(loadingTimeout);
        this.elements.ttsProgress.style.display = 'none';
        this.elements.playStoryBtn.disabled = false;
        this.elements.playStoryBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Story';
        this.elements.downloadAudioBtn.style.display = 'inline-flex';
        
        audio.play().catch(e => {
          console.error('Error playing audio:', e);
          this.resetAudioControls();
          alert('Error playing audio. Please try again.');
        });
      };
      
      let audioReadyFired = false;
      audio.addEventListener('canplaythrough', () => {
         if (audioReadyFired) return;
         audioReadyFired = true;
         onAudioReady();
      }, { once: true });

      // Fallback if canplaythrough doesn't fire quickly enough
      const fallbackTimeout = setTimeout(() => {
        if (audioReadyFired) return;
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or more
          audioReadyFired = true;
          onAudioReady();
        }
      }, 7000); // 7 seconds for fallback

      audio.addEventListener('error', (e) => {
        clearTimeout(loadingTimeout);
        clearTimeout(fallbackTimeout);
        console.error('Audio error event:', e);
        
        if (this.ttsService.currentAudioUrls && this.ttsService.currentAudioUrls.length > 1 && this.ttsService.currentAudioIndex < this.ttsService.currentAudioUrls.length -1) {
          console.log('Attempting to recover by playing next audio chunk...');
          try {
            this.ttsService.playNextChunk();
            // UI updates handled by playNextChunk if successful or subsequent events
            return; 
          } catch (recoveryError) {
            console.error('Recovery attempt failed:', recoveryError);
          }
        }
        
        this.resetAudioControls();
        alert('Error loading audio. Some audio chunks may have failed. Playback may be incomplete.');
      });

      audio.addEventListener('ended', () => {
        // This event fires when a single chunk ends. playNextChunk handles chain.
        // Only reset to "Play Story" if it's truly the end of all chunks.
        if (!this.ttsService.currentAudioUrls || this.ttsService.currentAudioIndex >= this.ttsService.currentAudioUrls.length - 1) {
            // And if the current audio source is indeed the last one (or currentAudio is null after cleanup)
            if(!this.ttsService.currentAudio || this.ttsService.currentAudio.src === this.ttsService.currentAudioUrls[this.ttsService.currentAudioUrls.length-1]){
                 this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
            }
        }
      });
      
      audio.addEventListener('pause', () => {
        if (this.ttsService.currentAudio && this.ttsService.currentAudio.currentTime < this.ttsService.currentAudio.duration) { // Check if not ended
             this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
        }
      });
      
      audio.addEventListener('play', () => {
        this.elements.playStoryBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Story';
      });
      
    } catch (err) {
      console.error('Error in TTS process:', err);
      this.elements.ttsProgress.style.display = 'none'; 
      this.resetAudioControls();
      let userAlert = `Sorry, there was an error generating the audio: ${err.message}.`;
      if (err.message && (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('timeout'))) {
          userAlert += ' This might be due to a network issue. Please check your connection, try a shorter story, or a different voice.';
      } else {
          userAlert += ' Please try again with a shorter story or different settings.';
      }
      alert(userAlert);
    }
  }

  handleDownloadAudio() {
    if (!this.ttsService.currentAudioUrls || !this.ttsService.currentAudioUrls.length) {
        alert("No audio to download. Please generate and play a story first.");
        return;
    }
    // For simplicity, we'll offer to download the first chunk.
    // True multi-chunk download would require server-side merging or complex client-side logic.
    this.ttsService.downloadAudio(`reddit_story_${this.selectedSubreddit}_${Date.now()}.wav`);
  }

  resetAudioControls() {
    this.elements.playStoryBtn.disabled = false;
    this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
    if (this.elements.ttsProgress) { // Check if element exists
        this.elements.ttsProgress.style.display = 'none';
    }
    // Do not hide download button here, user might want to download even if playback stopped/errored
  }

  toggleTheme() {
    const curr = document.body.getAttribute('data-theme');
    const next = curr === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    const icon = this.elements.themeToggle.querySelector('i');
    icon.className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }

  updateTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    const icon = this.elements.themeToggle.querySelector('i');
    icon.className = saved === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }
}