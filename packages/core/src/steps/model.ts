import { ExecutionContext, StepResult, ModelAdapter, ModelOptions, Tool } from '../types';
import { BaseStep } from './base';

export class ModelStep extends BaseStep {
  private prompt: string;
  private modelAdapter: ModelAdapter;
  private tools: Tool[] = [];
  private modelOptions?: ModelOptions;
  
  constructor(
    id: string,
    modelAdapter: ModelAdapter,
    options: {
      prompt: string;
      tools?: Tool[];
      modelOptions?: ModelOptions;
    }
  ) {
    super(id);
    this.modelAdapter = modelAdapter;
    this.prompt = options.prompt;
    this.tools = options.tools || [];
    this.modelOptions = options.modelOptions;
  }
  
  async execute(context: ExecutionContext): Promise<StepResult> {
    try {
      const state = context.getState();
      const renderedPrompt = this.renderTemplate(this.prompt, state);
      
      const modelOptions = {
        ...this.modelOptions,
        ...context.options?.modelOptions,
      };
      
      let response;
      if (this.tools.length > 0) {
        response = await this.modelAdapter.callWithTools(
          renderedPrompt,
          this.tools,
          modelOptions
        );
      } else {
        response = await this.modelAdapter.call(renderedPrompt, modelOptions);
      }
      
      return {
        output: response.content,
        metadata: {
          prompt: renderedPrompt,
          toolCalls: response.toolCalls,
          ...response.metadata,
        },
      };
    } catch (error) {
      return {
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { prompt: this.prompt },
      };
    }
  }
  
  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(variables, trimmedKey);
      return value !== undefined ? String(value) : match;
    });
  }
  
  private getNestedValue(obj: Record<string, any>, path: string): any {
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
    if (!this.modelAdapter) {
      throw new Error('Model adapter is required');
    }
    if (!this.prompt) {
      throw new Error('Prompt is required');
    }
  }
} 