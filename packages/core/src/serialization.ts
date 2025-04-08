import { Chain, Step } from './types';
import { BaseChain } from './chain';
import { PromptStep } from './steps/prompt';
import { ToolStep } from './steps/tool';
import { ModelStep } from './steps/model';
import { ConditionalStep } from './steps/conditional';

// Step serialization interfaces
interface SerializedStep {
  id: string;
  type: string;
  [key: string]: any;
}

interface SerializedPromptStep extends SerializedStep {
  template: string;
  modelAdapterId?: string;
}

interface SerializedToolStep extends SerializedStep {
  toolName: string;
  inputMapping: Record<string, string>;
}

interface SerializedModelStep extends SerializedStep {
  modelAdapterId: string;
  prompt: string;
  tools?: string[];
  modelOptions?: Record<string, any>;
}

interface SerializedConditionalStep extends SerializedStep {
  condition: string;
  trueStepId: string;
  falseStepId?: string;
}

// Chain serialization interfaces
export interface SerializedChain {
  id: string;
  steps: SerializedStep[];
  tracerId?: string;
  memoryId?: string;
}

/**
 * Serializes a chain to a JSON-compatible object
 */
export function serializeChain(chain: Chain): SerializedChain {
  const serializedSteps: SerializedStep[] = [];
  
  for (const step of chain.steps) {
    serializedSteps.push(serializeStep(step));
  }
  
  return {
    id: chain.id,
    steps: serializedSteps,
    // Note: tracer and memory are not serialized as they might contain non-serializable state
    // In a more complete implementation, we'd add registry for these components
  };
}

/**
 * Serializes a step to a JSON-compatible object
 */
function serializeStep(step: Step): SerializedStep {
  if (step instanceof PromptStep) {
    return serializePromptStep(step as any);
  } else if (step instanceof ToolStep) {
    return serializeToolStep(step as any);
  } else if (step instanceof ModelStep) {
    return serializeModelStep(step as any);
  } else if (step instanceof ConditionalStep) {
    return serializeConditionalStep(step as any);
  } else {
    throw new Error(`Unknown step type: ${step.constructor.name}`);
  }
}

function serializePromptStep(step: PromptStep): SerializedPromptStep {
  return {
    id: step.id,
    type: 'prompt',
    template: (step as any).template,
    modelAdapterId: (step as any).modelAdapter?.id,
  };
}

function serializeToolStep(step: ToolStep): SerializedToolStep {
  return {
    id: step.id,
    type: 'tool',
    toolName: (step as any).tool.name,
    inputMapping: (step as any).inputMapping || {},
  };
}

function serializeModelStep(step: ModelStep): SerializedModelStep {
  return {
    id: step.id,
    type: 'model',
    modelAdapterId: (step as any).modelAdapter.id,
    prompt: (step as any).prompt,
    tools: (step as any).tools?.map((t: any) => t.name) || [],
    modelOptions: (step as any).modelOptions,
  };
}

function serializeConditionalStep(step: ConditionalStep): SerializedConditionalStep {
  return {
    id: step.id,
    type: 'conditional',
    condition: typeof (step as any).condition === 'string' 
      ? (step as any).condition 
      : 'function() { ... }', // Functions can't be properly serialized
    trueStepId: (step as any).trueStep.id,
    falseStepId: (step as any).falseStep?.id,
  };
}

/**
 * Save chain to JSON string
 */
export function chainToJSON(chain: Chain): string {
  return JSON.stringify(serializeChain(chain), null, 2);
}

/**
 * Save chain to YAML string
 * Note: Requires js-yaml as a dependency
 */
export function chainToYAML(chain: Chain): string {
  throw new Error('YAML serialization not implemented - requires js-yaml dependency');
  // With js-yaml:
  // return yaml.dump(serializeChain(chain));
}

/**
 * Deserialize a chain from a serialized object
 * Note: This is a stub implementation - full implementation would require:
 * 1. Registry for model adapters, tools, etc.
 * 2. Handling for function conditions
 * 3. Proper handling of circular references between steps
 */
export function deserializeChain(
  serialized: SerializedChain, 
  registry: {
    modelAdapters: Record<string, any>,
    tools: Record<string, any>,
    tracers: Record<string, any>,
    memories: Record<string, any>
  }
): Chain {
  // Create a chain with the deserialized ID
  const chain = new BaseChain(serialized.id, {
    tracer: serialized.tracerId ? registry.tracers[serialized.tracerId] : undefined,
    memory: serialized.memoryId ? registry.memories[serialized.memoryId] : undefined,
  });
  
  // Create a mapping of step IDs to step instances
  const stepMap = new Map<string, Step>();
  
  // First pass: create all steps (without building the relationships)
  for (const serializedStep of serialized.steps) {
    let step: Step;
    
    if (serializedStep.type === 'prompt') {
      const promptStep = serializedStep as SerializedPromptStep;
      step = new PromptStep(
        promptStep.id,
        promptStep.template,
        promptStep.modelAdapterId ? registry.modelAdapters[promptStep.modelAdapterId] : undefined
      );
    }
    else if (serializedStep.type === 'tool') {
      const toolStep = serializedStep as SerializedToolStep;
      step = new ToolStep(
        toolStep.id,
        registry.tools[toolStep.toolName],
        toolStep.inputMapping
      );
    }
    else if (serializedStep.type === 'model') {
      const modelStep = serializedStep as SerializedModelStep;
      step = new ModelStep(
        modelStep.id,
        registry.modelAdapters[modelStep.modelAdapterId],
        {
          prompt: modelStep.prompt,
          tools: modelStep.tools?.map(toolName => registry.tools[toolName]),
          modelOptions: modelStep.modelOptions,
        }
      );
    }
    else if (serializedStep.type === 'conditional') {
      // Handle conditionals in second pass to ensure we have all steps
      // This is a placeholder to register the ID
      step = null as any;
    }
    else {
      throw new Error(`Unknown step type: ${serializedStep.type}`);
    }
    
    if (step) {
      stepMap.set(serializedStep.id, step);
    }
  }
  
  // Second pass: handle conditional steps and build the chain
  for (const serializedStep of serialized.steps) {
    if (serializedStep.type === 'conditional') {
      const conditionalStep = serializedStep as SerializedConditionalStep;
      const trueStep = stepMap.get(conditionalStep.trueStepId);
      const falseStep = conditionalStep.falseStepId ? stepMap.get(conditionalStep.falseStepId) : undefined;
      
      if (!trueStep) {
        throw new Error(`True step not found: ${conditionalStep.trueStepId}`);
      }
      
      const step = new ConditionalStep(
        conditionalStep.id,
        {
          condition: conditionalStep.condition,
          trueStep,
          falseStep,
        }
      );
      
      stepMap.set(conditionalStep.id, step);
    }
    
    // Add the step to the chain in order of the serialized steps
    const step = stepMap.get(serializedStep.id);
    if (step) {
      chain.addStep(step);
    }
  }
  
  return chain;
}

/**
 * Load chain from JSON string
 */
export function chainFromJSON(
  json: string,
  registry: {
    modelAdapters: Record<string, any>,
    tools: Record<string, any>,
    tracers: Record<string, any>,
    memories: Record<string, any>
  }
): Chain {
  return deserializeChain(JSON.parse(json), registry);
} 