import { Tool, JSONSchema } from '@orchestrise/core';

interface CalculatorInput {
  expression: string;
}

export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Evaluates a mathematical expression and returns the result',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate (e.g., "2 + 2 * 3")',
      },
    },
    required: ['expression'],
  } as JSONSchema,
  
  async handler(input: CalculatorInput): Promise<number> {
    try {
      // Safety check: only allow basic math operations
      if (!/^[0-9\s\+\-\*\/\(\)\.]+$/.test(input.expression)) {
        throw new Error('Expression contains invalid characters');
      }
      
      // Using Function constructor to evaluate the expression
      // This is safer than eval() but still requires input validation
      const result = new Function(`return ${input.expression}`)();
      
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Expression did not evaluate to a valid number');
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 