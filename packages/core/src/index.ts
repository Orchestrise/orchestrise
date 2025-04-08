export * from './types';
export * from './context';
export * from './chain';
export * from './steps/base';
export * from './steps/prompt';
export * from './steps/tool';
export * from './steps/model';
export * from './factory';

// Import factory functions
import { createPromptStep, createToolStep, createModelStep, createChain } from './factory';

// Simplified helper API
export const step = {
  prompt: createPromptStep,
  tool: createToolStep,
  model: createModelStep,
};

export const chain = {
  create: createChain,
}; 