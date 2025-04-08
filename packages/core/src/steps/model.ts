import { ExecutionContext, StepResult, ModelAdapter, ModelOptions, Tool, PartialStepResult } from '../types';
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
      
      // If streaming is supported and requested
      if (
        context.options?.stream && 
        this.modelAdapter.streamingSupported && 
        (
          (this.tools.length > 0 && this.modelAdapter.streamCallWithTools) || 
          (this.tools.length === 0 && this.modelAdapter.streamCall)
        )
      ) {
        return await this.executeStreaming(context, renderedPrompt, modelOptions);
      }
      
      // Fall back to non-streaming if streaming not supported or not requested
      return await this.executeNonStreaming(renderedPrompt, modelOptions);
    } catch (error) {
      return {
        output: null,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { prompt: this.prompt },
      };
    }
  }
  
  private async executeNonStreaming(renderedPrompt: string, modelOptions: ModelOptions): Promise<StepResult> {
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
  }
  
  private async executeStreaming(
    context: ExecutionContext, 
    renderedPrompt: string, 
    modelOptions: ModelOptions
  ): Promise<StepResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let toolCalls: any[] = [];
      let metadata: Record<string, any> = {};
      
      const onChunk = (chunk: string, chunkMetadata?: Record<string, any>) => {
        fullContent += chunk;
        
        if (context.options?.onPartialResult) {
          const partialResult: PartialStepResult = {
            stepId: this.id,
            chunk,
            isDone: false,
            metadata: chunkMetadata,
          };
          
          context.options.onPartialResult(partialResult);
        }
      };
      
      const onComplete = (fullResponse: any) => {
        if (context.options?.onPartialResult) {
          const partialResult: PartialStepResult = {
            stepId: this.id,
            chunk: '',
            isDone: true,
            metadata: fullResponse.metadata,
          };
          
          context.options.onPartialResult(partialResult);
        }
        
        resolve({
          output: fullContent,
          metadata: {
            prompt: renderedPrompt,
            toolCalls,
            ...fullResponse.metadata,
          },
        });
      };
      
      const onError = (error: Error) => {
        reject(error);
      };
      
      const onToolCall = (toolCall: any) => {
        toolCalls.push(toolCall);
      };
      
      try {
        if (this.tools.length > 0 && this.modelAdapter.streamCallWithTools) {
          this.modelAdapter.streamCallWithTools(
            renderedPrompt,
            this.tools,
            modelOptions,
            { onChunk, onToolCall, onComplete, onError }
          );
        } else if (this.modelAdapter.streamCall) {
          this.modelAdapter.streamCall(
            renderedPrompt,
            modelOptions,
            { onChunk, onComplete, onError }
          );
        } else {
          // This should never happen because we check in execute()
          reject(new Error('Streaming not supported by model adapter'));
        }
      } catch (error) {
        reject(error);
      }
    });
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