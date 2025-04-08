import Anthropic from '@anthropic-ai/sdk';
import { 
  ModelOptions,
  ModelResponse,
  Tool,
  ToolCall 
} from '@orchestrise/core';
import { BaseModelAdapter } from './base';

export interface AnthropicAdapterOptions {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
}

export class AnthropicAdapter extends BaseModelAdapter {
  private client: Anthropic;
  private defaultModel: string;

  constructor(options: AnthropicAdapterOptions = {}) {
    super('anthropic');
    this.streamingSupported = true;
    this.client = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: options.baseURL,
    });
    this.defaultModel = options.defaultModel || 'claude-3-opus-20240229';
  }

  async call(prompt: string, options: ModelOptions = {}): Promise<ModelResponse> {
    try {
      const response = await this.client.messages.create({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature,
        system: options.systemPrompt,
        messages: this.formatMessages(prompt, options),
      });

      return this.formatResponse(
        response.content[0]?.text || '',
        undefined,
        {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          model: response.model,
        }
      );
    } catch (error) {
      throw new Error(this.createErrorMessage('API call', error));
    }
  }

  async callWithTools(
    prompt: string, 
    tools: Tool[],
    options: ModelOptions = {}
  ): Promise<ModelResponse> {
    try {
      // Convert our tools to Anthropic tool format
      const anthropicTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      const response = await this.client.messages.create({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature,
        system: options.systemPrompt,
        messages: this.formatMessages(prompt, options),
        tools: anthropicTools,
      });

      // Process tool calls if any
      const toolCalls: ToolCall[] = [];
      
      for (const content of response.content) {
        if (content.type === 'tool_use') {
          const toolCall: ToolCall = {
            toolName: content.name,
            arguments: content.input,
          };
          toolCalls.push(toolCall);
        }
      }
      
      // Extract text content
      const textContent = response.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');

      return this.formatResponse(
        textContent,
        toolCalls.length > 0 ? toolCalls : undefined,
        {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          model: response.model,
        }
      );
    } catch (error) {
      throw new Error(this.createErrorMessage('API call with tools', error));
    }
  }
  
  async streamCall(
    prompt: string, 
    options: ModelOptions = {},
    callbacks?: {
      onChunk: (chunk: string, metadata?: Record<string, any>) => void;
      onComplete: (fullResponse: ModelResponse) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void> {
    try {
      const stream = await this.client.messages.create({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature,
        system: options.systemPrompt,
        messages: this.formatMessages(prompt, options),
        stream: true,
      });
      
      let fullContent = '';
      let usage = { input_tokens: 0, output_tokens: 0 };
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
          const content = chunk.delta.text || '';
          fullContent += content;
          
          if (callbacks?.onChunk && content) {
            callbacks.onChunk(content, {
              model: chunk.message.model,
            });
          }
        }
        
        if (chunk.type === 'message_delta' && chunk.usage) {
          usage = chunk.usage;
        }
      }
      
      // Synthesize a complete response
      const response = this.formatResponse(
        fullContent,
        undefined,
        {
          model: options.model || this.defaultModel,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        }
      );
      
      if (callbacks?.onComplete) {
        callbacks.onComplete(response);
      }
    } catch (error) {
      const errorObj = new Error(this.createErrorMessage('streaming API call', error));
      
      if (callbacks?.onError) {
        callbacks.onError(errorObj);
      } else {
        throw errorObj;
      }
    }
  }
  
  async streamCallWithTools(
    prompt: string, 
    tools: Tool[],
    options: ModelOptions = {},
    callbacks?: {
      onChunk: (chunk: string, metadata?: Record<string, any>) => void;
      onToolCall: (toolCall: ToolCall) => void;
      onComplete: (fullResponse: ModelResponse) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void> {
    try {
      // Convert our tools to Anthropic tool format
      const anthropicTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
      
      const stream = await this.client.messages.create({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature,
        system: options.systemPrompt,
        messages: this.formatMessages(prompt, options),
        tools: anthropicTools,
        stream: true,
      });
      
      let fullContent = '';
      let toolCalls: ToolCall[] = [];
      let usage = { input_tokens: 0, output_tokens: 0 };
      let currentToolCall: Partial<ToolCall> | null = null;
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text') {
            const content = chunk.delta.text || '';
            fullContent += content;
            
            if (callbacks?.onChunk && content) {
              callbacks.onChunk(content, {
                model: chunk.message.model,
              });
            }
          } 
          else if (chunk.delta.type === 'tool_use') {
            // Start of a new tool call
            if (!currentToolCall) {
              currentToolCall = { toolName: chunk.delta.name || '' };
            }
            
            // Update the input/arguments
            if (chunk.delta.input) {
              if (!currentToolCall.arguments) {
                currentToolCall.arguments = chunk.delta.input;
              } else if (typeof currentToolCall.arguments === 'object') {
                currentToolCall.arguments = {
                  ...currentToolCall.arguments,
                  ...chunk.delta.input,
                };
              }
            }
          }
        } 
        else if (chunk.type === 'message_delta') {
          if (chunk.usage) {
            usage = chunk.usage;
          }
          
          // End of a tool call
          if (currentToolCall && currentToolCall.toolName && currentToolCall.arguments) {
            const toolCall: ToolCall = {
              toolName: currentToolCall.toolName,
              arguments: currentToolCall.arguments,
            };
            
            toolCalls.push(toolCall);
            
            if (callbacks?.onToolCall) {
              callbacks.onToolCall(toolCall);
            }
            
            currentToolCall = null;
          }
        }
      }
      
      // Synthesize a complete response
      const response = this.formatResponse(
        fullContent,
        toolCalls.length > 0 ? toolCalls : undefined,
        {
          model: options.model || this.defaultModel,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        }
      );
      
      if (callbacks?.onComplete) {
        callbacks.onComplete(response);
      }
    } catch (error) {
      const errorObj = new Error(this.createErrorMessage('streaming API call with tools', error));
      
      if (callbacks?.onError) {
        callbacks.onError(errorObj);
      } else {
        throw errorObj;
      }
    }
  }
  
  protected formatMessages(
    prompt: string, 
    options?: ModelOptions
  ): Array<{ role: string; content: string }> {
    // Handle chat history if provided
    if (options?.messages) {
      return options.messages as Array<{ role: string; content: string }>;
    }
    
    // Default to a single user message
    return [{ role: 'user', content: prompt }];
  }
}

export function createAnthropicAdapter(options: AnthropicAdapterOptions = {}): AnthropicAdapter {
  return new AnthropicAdapter(options);
} 