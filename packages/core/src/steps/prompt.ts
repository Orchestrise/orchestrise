import { ExecutionContext, StepResult, ModelAdapter } from '../types';
import { BaseStep } from './base';

export class PromptStep extends BaseStep {
  private template: string;
  private modelAdapter?: ModelAdapter;
  
  constructor(id: string, template: string, modelAdapter?: ModelAdapter) {
    super(id);
    this.template = template;
    this.modelAdapter = modelAdapter;
  }
  
  async execute(context: ExecutionContext): Promise<StepResult> {
    try {
      const rendered = this.renderTemplate(this.template, context.getState());
      
      if (!this.modelAdapter) {
        // If no model adapter, just return the rendered prompt
        return {
          output: rendered,
          metadata: { rendered },
        };
      }
      
      const modelOptions = context.options?.modelOptions || {};
      const response = await this.modelAdapter.call(rendered, modelOptions);
      
      return {
        output: response.content,
        metadata: {
          prompt: rendered,
          ...response.metadata,
        },
      };
    } catch (error) {
      return {
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { template: this.template },
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
    if (!this.template) {
      throw new Error('Prompt template is required');
    }
  }
} 