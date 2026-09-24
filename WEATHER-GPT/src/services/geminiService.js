import { askAi, getAiBrief } from './aiService.js';

export async function askGemini(args) {
  return askAi(args);
}

export { askAi, getAiBrief };
