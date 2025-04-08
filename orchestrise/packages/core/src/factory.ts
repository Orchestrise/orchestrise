import { BaseChain } from './chain';
import { PromptStep } from './steps/prompt';
import { ToolStep } from './steps/tool';
import { ModelStep } from './steps/model';
import { Tracer, Memory, ModelAdapter, Tool, ModelOptions } from './types';

let stepCounter = 0;

export function createChain(options?: {
  id?: string;
  name?: string;
  description?: string;
  tracer?: Tracer;
  memory?: Memory;
}) {
  const id = options?.id || options?.name || `chain-${Date.now()}`;
  return new BaseChain(id, {
    tracer: options?.tracer,
    memory: options?.memory,
  });
}

export function createPromptStep(
  template: string,
  modelAdapter?: ModelAdapter
) {
  const id = `prompt-${++stepCounter}`;
  return new PromptStep(id, template, modelAdapter);
}

export function createToolStep(
  tool: Tool,
  inputMapping?: Record<string, string>
) {
  const id = `tool-${++stepCounter}`;
  return new ToolStep(id, tool, inputMapping);
}

export function createModelStep(
  modelAdapter: ModelAdapter,
  options: {
    prompt: string;
    tools?: Tool[];
    modelOptions?: ModelOptions;
  }
) {
  const id = `model-${++stepCounter}`;
  return new ModelStep(id, modelAdapter, options);
} 