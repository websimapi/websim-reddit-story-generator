import StoryService from './StoryService.js';
import TTSService from './TTSService.js';
import UIController from './UIController.js';

export default class RedditStoryGenerator {
    constructor() {
        this.storyService = new StoryService();
        this.ttsService = new TTSService();
        this.uiController = new UIController(this.storyService, this.ttsService);
    }
}