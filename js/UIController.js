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
      alert('Sorry, there was an error generating your story. Please try again!');
    } finally {
      this.elements.generateBtn.disabled = false;
      this.elements.loadingSection.style.display = 'none';
    }
  }

  displayStory(story) {
    const lines = story.split('\n').filter(l => l.trim());
    let title = lines[0];
    if (title.length > 100) title = title.slice(0, 97) + '...';
    const up = Math.floor(Math.random() * 5000) + 100;
    const upText = up > 1000 ? `${(up/1000).toFixed(1)}k` : `${up}`;
    this.elements.storyTitle.textContent = title.replace(/[.,]/g, '');
    this.elements.storyContent.textContent = story.replace(/[.,]/g, '');
    this.elements.subredditDisplay.textContent = `r/${this.selectedSubreddit}`;
    this.elements.upvoteCount.textContent = upText;
    this.elements.storyDisplay.style.display = 'block';
    this.elements.downloadAudioBtn.style.display = 'none';
    this.ttsService.cleanup();
    this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
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
    this.elements.playStoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Audio...';
    
    try {
      const text = this.elements.storyContent.textContent;
      const voice = this.elements.voiceSelect.value;
      const rate = parseFloat(this.elements.speedControl.value);
      
      // Validate inputs
      if (!text || text.trim().length === 0) {
        throw new Error('No story text available for TTS');
      }
      
      if (!voice) {
        throw new Error('No voice selected for TTS');
      }
      
      console.log('Starting TTS generation...');
      const urls = await this.ttsService.generateAudioURLs(text, voice);
      console.log('TTS generation completed, creating audio player...');
      const audio = this.ttsService.createAudioPlayer(urls, rate);
      
      // Set a more reasonable loading timeout
      const loadingTimeout = setTimeout(() => {
        console.error('Audio loading timeout after 20 seconds');
        this.resetAudioControls();
        alert('Audio loading took too long. Please try again with a shorter story or different voice.');
      }, 20000);

      // Use loadedmetadata for faster response
      const onAudioReady = () => {
        clearTimeout(loadingTimeout);
        this.elements.playStoryBtn.disabled = false;
        this.elements.playStoryBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Story';
        this.elements.downloadAudioBtn.style.display = 'inline-flex';
        
        audio.play().catch(e => {
          console.error('Error playing audio:', e);
          this.resetAudioControls();
          alert('Error playing audio. Please try again.');
        });
      };

      // Use loadedmetadata instead of canplay for more reliable detection
      audio.addEventListener('loadedmetadata', onAudioReady, { once: true });
      
      // Fallback to canplay if loadedmetadata doesn't fire
      const fallbackTimeout = setTimeout(() => {
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
          onAudioReady();
        }
      }, 5000);
      
      audio.addEventListener('canplay', () => {
        clearTimeout(fallbackTimeout);
        if (!this.elements.playStoryBtn.disabled) return; // Already handled
        onAudioReady();
      }, { once: true });
      
      audio.addEventListener('error', (e) => {
        clearTimeout(loadingTimeout);
        clearTimeout(fallbackTimeout);
        console.error('Audio error:', e);
        this.resetAudioControls();
        alert('Error loading audio. Please try again with a different voice or shorter story.');
      });
      
      audio.addEventListener('ended', () => {
        if (!this.ttsService.currentAudioUrls || this.ttsService.currentAudioIndex >= this.ttsService.currentAudioUrls.length - 1) {
          this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
        }
      });
      
      audio.addEventListener('pause', () => {
        this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
      });
      
      audio.addEventListener('play', () => {
        this.elements.playStoryBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Story';
      });
      
    } catch (err) {
      console.error('Error in TTS process:', err);
      this.resetAudioControls();
      alert(`Sorry, there was an error generating the audio: ${err.message}. Please try again with a shorter story or different settings.`);
    }
  }

  handleDownloadAudio() {
    this.ttsService.downloadAudio(`reddit_story_${this.selectedSubreddit}_${Date.now()}.wav`);
  }

  resetAudioControls() {
    this.elements.playStoryBtn.disabled = false;
    this.elements.playStoryBtn.innerHTML = '<i class="fas fa-play"></i> Play Story';
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