import { Step, ExecutionContext, StepResult } from '../types';

export abstract class BaseStep implements Step {
  id: string;
  
  constructor(id: string) {
    this.id = id;
  }
  
  abstract execute(context: ExecutionContext): Promise<StepResult>;
  
  validate(): void {
    // Base validation logic
    if (!this.id) {
      throw new Error('Step ID is required');
    }
  }
} 