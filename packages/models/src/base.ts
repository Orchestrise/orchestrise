import { 
  ModelAdapter,
  ModelOptions,
  ModelResponse,
  Tool,
  ToolCall
} from '@orchestrise/core';

/**
 * Base model adapter that provides common functionality
 * and standardized implementation for all model adapters
 */
export abstract class BaseModelAdapter implements ModelAdapter {
  id: string;
  streamingSupported: boolean = false;
  
  constructor(id: string) {
    this.id = id;
  }
  
  /**
   * Call the model with a prompt
   */
  abstract call(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  
  /**
   * Call the model with a prompt and tools
   */
  abstract callWithTools(
    prompt: string, 
    tools: Tool[], 
    options?: ModelOptions
  ): Promise<ModelResponse>;
  
  /**
   * Stream call the model with a prompt (optional)
   */
  async streamCall?(
    prompt: string,
    options?: ModelOptions,
    callbacks?: {
      onChunk: (chunk: string, metadata?: Record<string, any>) => void;
      onComplete: (fullResponse: ModelResponse) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void>;
  
  /**
   * Stream call the model with a prompt and tools (optional)
   */
  async streamCallWithTools?(
    prompt: string,
    tools: Tool[],
    options?: ModelOptions,
    callbacks?: {
      onChunk: (chunk: string, metadata?: Record<string, any>) => void;
      onToolCall: (toolCall: ToolCall) => void;
      onComplete: (fullResponse: ModelResponse) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void>;
  
  /**
   * Create a standard error message format
   */
  protected createErrorMessage(
    operation: string,
    error: unknown
  ): string {
    return `${this.id} ${operation} failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  
  /**
   * Format model response in a standardized way
   */
  protected formatResponse(
    content: string,
    toolCalls?: ToolCall[],
    metadata?: Record<string, any>
  ): ModelResponse {
    return {
      content,
      toolCalls,
      metadata: {
        model: this.id,
        ...metadata,
      },
    };
  }
  
  /**
   * Format a list of messages in a standardized way
   * Different providers have different message formats
   */
  protected formatMessages(
    prompt: string, 
    options?: ModelOptions
  ): Array<{ role: string; content: string }> {
    return [{ role: 'user', content: prompt }];
  }
} 