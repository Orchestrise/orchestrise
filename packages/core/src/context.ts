import { ExecutionContext, Memory, RunOptions } from './types';

export class SimpleExecutionContext implements ExecutionContext {
  public input: Record<string, any>;
  public state: Record<string, any>;
  public options?: RunOptions;
  public memory?: Memory;

  constructor(
    input: Record<string, any>,
    options?: RunOptions,
    memory?: Memory
  ) {
    this.input = input;
    this.state = { ...input };
    this.options = options;
    this.memory = memory;
  }

  getState(): Record<string, any> {
    return this.state;
  }

  updateState(newState: Record<string, any>): void {
    this.state = {
      ...this.state,
      ...newState,
    };
  }

  getMemory(): Memory | undefined {
    return this.memory;
  }
} 