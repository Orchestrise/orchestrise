export interface ExecutionContext {
  input: Record<string, any>;
  state: Record<string, any>;
  options?: RunOptions;
  memory?: Memory;
  
  getState(): Record<string, any>;
  updateState(newState: Record<string, any>): void;
  getMemory(): Memory | undefined;
}

export interface RunOptions {
  modelOptions?: Record<string, any>;
  tracing?: boolean;
  timeout?: number;
  retry?: {
    attempts: number;
    backoff?: number;
  };
}

export interface StepResult {
  output: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface ChainResult {
  output?: any;
  error?: Error;
  trace?: StepTrace[];
}

export interface StepTrace {
  stepId: string;
  input: any;
  output: any;
  duration: number;
  startTime: Date;
  endTime: Date;
  metadata?: Record<string, any>;
}

export interface Step {
  id: string;
  execute(context: ExecutionContext): Promise<StepResult>;
  validate(): void;
}

export interface Chain {
  id: string;
  steps: Step[];
  addStep(step: Step): Chain;
  run(input: Record<string, any>, options?: RunOptions): Promise<ChainResult>;
}

export interface ModelAdapter {
  id: string;
  call(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  callWithTools(prompt: string, tools: Tool[], options?: ModelOptions): Promise<ModelResponse>;
}

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  [key: string]: any;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  metadata?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    [key: string]: any;
  };
}

export interface ToolCall {
  toolName: string;
  arguments: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (input: any) => Promise<any>;
}

export type JSONSchema = {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  [key: string]: any;
};

export interface Memory {
  read(key: string): Promise<any>;
  write(key: string, value: any): Promise<void>;
  clear(): Promise<void>;
}

export interface Tracer {
  startChain(chainId: string, input: Record<string, any>): Promise<void>;
  recordStep(stepId: string, input: any, output: any, metadata: Record<string, any>): Promise<void>;
  endChain(result: ChainResult): Promise<void>;
} 