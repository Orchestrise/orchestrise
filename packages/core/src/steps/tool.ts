import { ExecutionContext, StepResult, Tool } from '../types';
import { BaseStep } from './base';

export class ToolStep extends BaseStep {
  private tool: Tool;
  private inputMapping: Record<string, string>;
  
  constructor(
    id: string,
    tool: Tool,
    inputMapping: Record<string, string> = {}
  ) {
    super(id);
    this.tool = tool;
    this.inputMapping = inputMapping;
  }
  
  async execute(context: ExecutionContext): Promise<StepResult> {
    try {
      const state = context.getState();
      const toolInput: Record<string, any> = {};
      
      // Map inputs from context to tool input
      if (Object.keys(this.inputMapping).length > 0) {
        // Use explicit mapping if provided
        for (const [toolParam, contextPath] of Object.entries(this.inputMapping)) {
          toolInput[toolParam] = this.getNestedValue(state, contextPath);
        }
      } else {
        // Otherwise just pass the entire state
        Object.assign(toolInput, state);
      }
      
      const result = await this.tool.handler(toolInput);
      
      return {
        output: result,
        metadata: {
          toolName: this.tool.name,
          toolInput,
        },
      };
    } catch (error) {
      return {
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          toolName: this.tool.name,
        },
      };
    }
  }
  
  private getNestedValue(obj: Record<string, any>, path: string): any {
    // Handle template strings
    if (path.startsWith('{{') && path.endsWith('}}')) {
      path = path.slice(2, -2).trim();
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  validate(): void {
    super.validate();
    if (!this.tool) {
      throw new Error('Tool is required');
    }
    if (!this.tool.handler || typeof this.tool.handler !== 'function') {
      throw new Error('Tool must have a handler function');
    }
  }
} 