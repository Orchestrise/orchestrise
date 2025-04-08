export * from './types';
export * from './context';
export * from './chain';
export * from './steps/base';
export * from './steps/prompt';
export * from './steps/tool';
export * from './steps/model';
export * from './steps/conditional';
export * from './factory';
export * from './serialization';

// Import factory functions
import { 
  createPromptStep, 
  createToolStep, 
  createModelStep, 
  createChain,
  createConditionalStep 
} from './factory';

// Import serialization functions
import {
  serializeChain,
  chainToJSON,
  chainToYAML,
  deserializeChain,
  chainFromJSON
} from './serialization';

// Simplified helper API
export const step = {
  prompt: createPromptStep,
  tool: createToolStep,
  model: createModelStep,
  conditional: createConditionalStep,
};

export const chain = {
  create: createChain,
  serialize: serializeChain,
  toJSON: chainToJSON,
  toYAML: chainToYAML,
  deserialize: deserializeChain,
  fromJSON: chainFromJSON
}; 