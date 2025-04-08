import MistralClient from '@mistralai/mistralai';
import { 
  ModelOptions,
  ModelResponse,
  Tool,
  ToolCall 
} from '@orchestrise/core';
import { BaseModelAdapter } from './base';

export interface MistralAdapterOptions {
  apiKey?: string;
  endpoint?: string;
  defaultModel?: string;
}

export class MistralAdapter extends BaseModelAdapter {
  private client: MistralClient;
  private defaultModel: string;

  constructor(options: MistralAdapterOptions = {}) {
    super('mistral');
    this.streamingSupported = true;
    this.client = new MistralClient(
      options.apiKey || process.env.MISTRAL_API_KEY || '',
      options.endpoint
    );
    this.defaultModel = options.defaultModel || 'mistral-large-latest';
  }

  async call(prompt: string, options: ModelOptions = {}): Promise<ModelResponse> {
    try {
      const response = await this.client.chat({
        model: options.model || this.defaultModel,
        messages: this.formatMessages(prompt, options),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
      });

      return this.formatResponse(
        response.choices[0]?.message.content || '',
        undefined,
        {
          promptTokens: response.usage?.promptTokens,
          completionTokens: response.usage?.completionTokens,
          totalTokens: response.usage?.totalTokens,
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
      // Convert our tools to Mistral tool format
      const mistralTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      const response = await this.client.chat({
        model: options.model || this.defaultModel,
        messages: this.formatMessages(prompt, options),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        tools: mistralTools,
      });

      // Process tool calls if any
      const toolCalls: ToolCall[] = [];
      
      if (response.choices[0]?.message.toolCalls) {
        for (const call of response.choices[0].message.toolCalls) {
          const toolCall: ToolCall = {
            toolName: call.name,
            arguments: JSON.parse(call.arguments),
          };
          toolCalls.push(toolCall);
        }
      }

      return this.formatResponse(
        response.choices[0]?.message.content || '',
        toolCalls.length > 0 ? toolCalls : undefined,
        {
          promptTokens: response.usage?.promptTokens,
          completionTokens: response.usage?.completionTokens,
          totalTokens: response.usage?.totalTokens,
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
      const stream = await this.client.chatStream({
        model: options.model || this.defaultModel,
        messages: this.formatMessages(prompt, options),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
      });
      
      let fullContent = '';
      let metaData = {
        model: options.model || this.defaultModel,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const content = chunk.delta?.content || '';
          fullContent += content;
          
          if (callbacks?.onChunk && content) {
            callbacks.onChunk(content, {
              model: metaData.model,
            });
          }
        }
        
        if (chunk.type === 'message_delta' && chunk.usage) {
          metaData.promptTokens = chunk.usage.promptTokens;
          metaData.completionTokens = chunk.usage.completionTokens;
          metaData.totalTokens = chunk.usage.totalTokens;
        }
      }
      
      // Synthesize a complete response
      const response = this.formatResponse(
        fullContent,
        undefined,
        metaData
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
      // Convert our tools to Mistral tool format
      const mistralTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
      
      const stream = await this.client.chatStream({
        model: options.model || this.defaultModel,
        messages: this.formatMessages(prompt, options),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        tools: mistralTools,
      });
      
      let fullContent = '';
      let toolCalls: ToolCall[] = [];
      let metaData = {
        model: options.model || this.defaultModel,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      let currentToolCall: any = null;
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const content = chunk.delta?.content || '';
          fullContent += content;
          
          if (callbacks?.onChunk && content) {
            callbacks.onChunk(content, {
              model: metaData.model,
            });
          }
        }
        
        if (chunk.type === 'tool_call_delta') {
          if (!currentToolCall || currentToolCall.id !== chunk.id) {
            // Start a new tool call
            currentToolCall = {
              id: chunk.id,
              name: chunk.delta?.name || '',
              arguments: chunk.delta?.arguments || '',
            };
          } else {
            // Update existing tool call
            if (chunk.delta?.name) {
              currentToolCall.name += chunk.delta.name;
            }
            if (chunk.delta?.arguments) {
              currentToolCall.arguments += chunk.delta.arguments;
            }
          }
          
          // If this seems to be a complete tool call
          if (currentToolCall.name && currentToolCall.arguments) {
            try {
              const args = JSON.parse(currentToolCall.arguments);
              const toolCall: ToolCall = {
                toolName: currentToolCall.name,
                arguments: args,
              };
              
              // Check if we already have this tool call to avoid duplicates
              const isDuplicate = toolCalls.some(tc => 
                tc.toolName === toolCall.toolName && 
                JSON.stringify(tc.arguments) === JSON.stringify(toolCall.arguments)
              );
              
              if (!isDuplicate) {
                toolCalls.push(toolCall);
                
                if (callbacks?.onToolCall) {
                  callbacks.onToolCall(toolCall);
                }
              }
            } catch (e) {
              // Arguments might not be complete JSON yet, so we'll try again with the next chunk
            }
          }
        }
        
        if (chunk.type === 'message_delta' && chunk.usage) {
          metaData.promptTokens = chunk.usage.promptTokens;
          metaData.completionTokens = chunk.usage.completionTokens;
          metaData.totalTokens = chunk.usage.totalTokens;
        }
      }
      
      // Synthesize a complete response
      const response = this.formatResponse(
        fullContent,
        toolCalls.length > 0 ? toolCalls : undefined,
        metaData
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
    
    // Add system message if provided
    const messages: Array<{ role: string; content: string }> = [];
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    // Add user message
    messages.push({ role: 'user', content: prompt });
    
    return messages;
  }
}

export function createMistralAdapter(options: MistralAdapterOptions = {}): MistralAdapter {
  return new MistralAdapter(options);
} 