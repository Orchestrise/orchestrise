import OpenAI from 'openai';
import { 
  ModelAdapter,
  ModelOptions,
  ModelResponse,
  Tool,
  ToolCall 
} from '@orchestrise/core';

export interface OpenAIAdapterOptions {
  apiKey?: string;
  organization?: string;
  baseURL?: string;
  defaultModel?: string;
}

export class OpenAIAdapter implements ModelAdapter {
  id: string;
  private client: OpenAI;
  private defaultModel: string;
  streamingSupported: boolean = true;

  constructor(options: OpenAIAdapterOptions = {}) {
    this.id = 'openai';
    this.client = new OpenAI({
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      organization: options.organization,
      baseURL: options.baseURL,
    });
    this.defaultModel = options.defaultModel || 'gpt-3.5-turbo';
  }

  async call(prompt: string, options: ModelOptions = {}): Promise<ModelResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stopSequences,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        metadata: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
          model: response.model,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async callWithTools(
    prompt: string, 
    tools: Tool[],
    options: ModelOptions = {}
  ): Promise<ModelResponse> {
    try {
      // Convert our tools to OpenAI tool format
      const openaiTools = tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      const response = await this.client.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stopSequences,
        tools: openaiTools,
      });

      const toolCalls: ToolCall[] = 
        response.choices[0]?.message?.tool_calls?.map((call) => ({
          toolName: call.function.name,
          arguments: JSON.parse(call.function.arguments),
        })) || [];

      return {
        content: response.choices[0]?.message?.content || '',
        toolCalls: toolCalls,
        metadata: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
          model: response.model,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI API call with tools failed: ${error instanceof Error ? error.message : String(error)}`);
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
      const stream = await this.client.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stopSequences,
        stream: true,
      });
      
      let fullContent = '';
      let metadata: Record<string, any> = {};
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        
        if (callbacks?.onChunk && content) {
          callbacks.onChunk(content, {
            model: chunk.model,
          });
        }
      }
      
      // Synthesize a complete response
      const response: ModelResponse = {
        content: fullContent,
        metadata: {
          model: options.model || this.defaultModel,
          // Note: token counts not available with streaming
        },
      };
      
      if (callbacks?.onComplete) {
        callbacks.onComplete(response);
      }
    } catch (error) {
      const errorObj = error instanceof Error 
        ? error 
        : new Error(`OpenAI streaming API call failed: ${String(error)}`);
      
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
      // Convert our tools to OpenAI tool format
      const openaiTools = tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      
      const stream = await this.client.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stopSequences,
        tools: openaiTools,
        stream: true,
      });
      
      let fullContent = '';
      let toolCalls: ToolCall[] = [];
      let toolCallsBuffer: Record<string, any> = {};
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        
        if (callbacks?.onChunk && content) {
          callbacks.onChunk(content, {
            model: chunk.model,
          });
        }
        
        // Handle tool calls (this is a bit tricky with OpenAI streaming)
        const deltaToolCalls = chunk.choices[0]?.delta?.tool_calls;
        if (deltaToolCalls && deltaToolCalls.length > 0) {
          for (const deltaToolCall of deltaToolCalls) {
            const id = deltaToolCall.id || '0';
            
            // Initialize the buffer for this tool call if it doesn't exist
            if (!toolCallsBuffer[id]) {
              toolCallsBuffer[id] = {
                function: { name: '', arguments: '' }
              };
            }
            
            // Update the name if provided
            if (deltaToolCall.function?.name) {
              toolCallsBuffer[id].function.name = deltaToolCall.function.name;
            }
            
            // Update the arguments if provided
            if (deltaToolCall.function?.arguments) {
              toolCallsBuffer[id].function.arguments += deltaToolCall.function.arguments;
            }
            
            // If this is the last chunk of the tool call, emit the complete tool call
            if (chunk.choices[0]?.finish_reason === 'tool_calls') {
              try {
                const toolCall: ToolCall = {
                  toolName: toolCallsBuffer[id].function.name,
                  arguments: JSON.parse(toolCallsBuffer[id].function.arguments)
                };
                
                toolCalls.push(toolCall);
                
                if (callbacks?.onToolCall) {
                  callbacks.onToolCall(toolCall);
                }
              } catch (error) {
                console.error('Error parsing tool call arguments:', error);
              }
            }
          }
        }
      }
      
      // Synthesize a complete response
      const response: ModelResponse = {
        content: fullContent,
        toolCalls: toolCalls,
        metadata: {
          model: options.model || this.defaultModel,
          // Note: token counts not available with streaming
        },
      };
      
      if (callbacks?.onComplete) {
        callbacks.onComplete(response);
      }
    } catch (error) {
      const errorObj = error instanceof Error 
        ? error 
        : new Error(`OpenAI streaming API call with tools failed: ${String(error)}`);
      
      if (callbacks?.onError) {
        callbacks.onError(errorObj);
      } else {
        throw errorObj;
      }
    }
  }
}

export function createOpenAIAdapter(options: OpenAIAdapterOptions = {}): ModelAdapter {
  return new OpenAIAdapter(options);
} 