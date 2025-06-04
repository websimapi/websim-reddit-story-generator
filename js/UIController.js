      audio.addEventListener('error', (e) => {
        clearTimeout(loadingTimeout);
        clearTimeout(fallbackTimeout);
        console.error('Audio error:', e);
        // Only reset if audio completely fails, not if just one chunk has issues
        if (this.ttsService.currentAudioIndex === 0) {
          this.resetAudioControls();
          alert('Error loading audio. Please try again with a different voice or shorter story.');
        }
      });

