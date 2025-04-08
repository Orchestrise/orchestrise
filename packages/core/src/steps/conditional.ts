import { ExecutionContext, Step, StepResult } from '../types';
import { BaseStep } from './base';

export interface ConditionFunction {
  (state: Record<string, any>): boolean | Promise<boolean>;
}

export class ConditionalStep extends BaseStep {
  private condition: string | ConditionFunction;
  private trueStep: Step;
  private falseStep?: Step;
  
  constructor(
    id: string, 
    options: {
      condition: string | ConditionFunction;
      trueStep: Step;
      falseStep?: Step;
    }
  ) {
    super(id);
    this.condition = options.condition;
    this.trueStep = options.trueStep;
    this.falseStep = options.falseStep;
  }
  
  async execute(context: ExecutionContext): Promise<StepResult> {
    try {
      // Evaluate the condition
      let result: boolean;
      
      if (typeof this.condition === 'string') {
        // Handle string template condition (e.g., "{{value}} > 10")
        result = await this.evaluateStringCondition(this.condition, context.getState());
      } else {
        // Handle function condition
        result = await this.condition(context.getState());
      }
      
      // Execute the appropriate branch
      if (result) {
        return await this.trueStep.execute(context);
      } else if (this.falseStep) {
        return await this.falseStep.execute(context);
      } else {
        // If no false branch specified, just pass through the current state
        return {
          output: null,
          metadata: { 
            conditionResult: false,
            conditionSkipped: true
          }
        };
      }
    } catch (error) {
      return {
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { 
          condition: this.condition,
          error: true
        }
      };
    }
  }
  
  private async evaluateStringCondition(
    condition: string, 
    state: Record<string, any>
  ): Promise<boolean> {
    // Handle simple template condition like "{{value}}" that evaluates to boolean
    if (condition.startsWith('{{') && condition.endsWith('}}')) {
      const path = condition.slice(2, -2).trim();
      const value = this.getNestedValue(state, path);
      return Boolean(value);
    }
    
    // Handle expressions like "{{value}} > 10"
    const renderedCondition = this.renderTemplate(condition, state);
    
    // For security, only allow simple comparisons
    const safeCondition = this.validateCondition(renderedCondition);
    if (!safeCondition) {
      throw new Error(`Unsafe condition: ${renderedCondition}`);
    }
    
    // Using Function constructor is safer than eval, but still requires validation
    return new Function(`return ${renderedCondition}`)();
  }
  
  private validateCondition(condition: string): boolean {
    // Only allow simple comparisons and boolean operators
    const safePattern = /^[\s\d"'true|false|null|undefined\(\)<>=!&|+\-*\/\.]+$/;
    return safePattern.test(condition);
  }
  
  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(variables, trimmedKey);
      
      if (typeof value === 'string') {
        return `"${value}"`; // Wrap strings in quotes
      }
      
      return value !== undefined ? String(value) : 'undefined';
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
    if (!this.condition) {
      throw new Error('Condition is required');
    }
    if (!this.trueStep) {
      throw new Error('True step is required');
    }
  }
} 