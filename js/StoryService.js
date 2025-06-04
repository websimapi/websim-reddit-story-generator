import {
  SUBREDDIT_PROMPTS,
  LENGTH_DESCRIPTIONS,
  DESCRIPTIVENESS_LEVELS
} from './Constants.js';

export default class StoryService {
  getSubredditPrompt(subreddit) {
    return SUBREDDIT_PROMPTS[subreddit] || SUBREDDIT_PROMPTS.tifu;
  }

  getLengthDescription(lengthValue) {
    return LENGTH_DESCRIPTIONS[lengthValue - 1];
  }

  getDescriptivenessLevel(descriptivenessValue) {
    return DESCRIPTIVENESS_LEVELS[descriptivenessValue - 1];
  }

  getSystemPrompt(subreddit, lengthValue, descriptivenessValue, isFirst, isLast, partNum, totalParts) {
    const baseRules = `You are a creative Reddit story writer. Follow these rules:
1. DO NOT include any racist, sexist, homophobic, or specifically offensive slurs/hate speech
2. You CAN include violence, blood, fights, gunfights, and intense confrontations when appropriate to the story
3. Use realistic dialogue and situations, including mature themes when relevant
4. Include emotional depth and relatable characters with realistic names (give the narrator and all characters believable first and last names)
5. Create detailed family members, friends, coworkers, and other characters with distinct personalities and realistic names
6. Format with proper paragraphs
7. ${this.getSubredditPrompt(subreddit)}
8. ${this.getDescriptivenessLevel(descriptivenessValue)}
9. Write in first person as if posting to Reddit
10. Include some Reddit-style language and references naturally`;

    if (totalParts === 1) {
      return `${baseRules}
11. Make the story ${this.getLengthDescription(lengthValue)}`;
    }
    if (isFirst) {
      return `${baseRules}
11. This is part 1 of ${totalParts} of a very long story. Start the story but DO NOT conclude it. Build up characters, setting, and plot. End on a compelling note that naturally leads to continuation.
12. Write extensively with rich detail, character development, and scene-setting.`;
    }
    if (isLast) {
      return `${baseRules}
11. This is the final part (${partNum} of ${totalParts}) of a multi-part story. Blend seamlessly with the previous content and bring the story to a satisfying, complete conclusion.
12. Resolve all plot threads and provide a fulfilling ending.
13. Do not repeat information from previous parts, just continue naturally.`;
    }
    return `${baseRules}
11. This is part ${partNum} of ${totalParts} of a multi-part story. Continue the story seamlessly without repeating previous content. Develop the plot further but DO NOT conclude the story yet.
12. Blend naturally with the previous content and advance the narrative significantly.
13. End this part in a way that naturally leads to continuation.`;
  }

  async generateStory(premise, subreddit, lengthValue, descriptivenessValue) {
    const isMulti = lengthValue >= 6;
    const extra = lengthValue >= 9 ? 7 : 0;
    const parts = isMulti ? 1 + extra : 1;
    let full = '';

    for (let i = 0; i < parts; i++) {
      const isFirst = i === 0;
      const isLast = i === parts - 1;
      const sys = this.getSystemPrompt(
        subreddit, lengthValue, descriptivenessValue,
        isFirst, isLast, i + 1, parts
      );
      const user = isFirst
        ? `Write a Reddit story based on this premise: ${premise}`
        : `Previous story so far: ${full}\n\nContinue the story seamlessly from where it left off. This is part ${i+1} of ${parts}. ${isLast ? 'Bring the story to a satisfying conclusion.' : 'Continue developing the plot and characters without ending the story yet.'}`;
      const resp = await websim.chat.completions.create({
        messages: [{ role: "system", content: sys }, { role: "user", content: user }]
      });
      full = isFirst ? resp.content : `${full}\n\n${resp.content}`;
    }

    return full;
  }
}