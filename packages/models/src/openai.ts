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
}

export function createOpenAIAdapter(options: OpenAIAdapterOptions = {}): ModelAdapter {
  return new OpenAIAdapter(options);
} 