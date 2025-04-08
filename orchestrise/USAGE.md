# Orchestrise Usage Guide

Orchestrise is a lightweight, modular framework for defining, executing, and monitoring LLM chains. This guide will help you get started with using the framework in your projects.

## Installation

```bash
# Install the packages
npm install @orchestrise/core @orchestrise/models @orchestrise/tools @orchestrise/tracing @orchestrise/memory

# Or if you use PNPM
pnpm add @orchestrise/core @orchestrise/models @orchestrise/tools @orchestrise/tracing @orchestrise/memory
```

## Basic Usage

Here's a simple example of how to create and run an LLM chain:

```typescript
import { createChain, step } from '@orchestrise/core';
import { createOpenAIAdapter } from '@orchestrise/models';
import { createConsoleTracer } from '@orchestrise/tracing';

// Create a model adapter
const openai = createOpenAIAdapter({
  defaultModel: 'gpt-3.5-turbo',
  // API key will be taken from OPENAI_API_KEY environment variable if not provided
});

// Create a simple chain
const summaryChain = createChain({
  name: 'summarizer',
  tracer: createConsoleTracer(), // Optional but helpful for debugging
})
  // First step: Get a summary
  .addStep(
    step.model(openai, {
      prompt: 'Summarize the following text in 3 bullet points: {{text}}',
    })
  )
  // Second step: Extract key concepts
  .addStep(
    step.model(openai, {
      prompt: 'Based on this summary, list the 3 most important concepts:\n{{$prevStep.output}}',
    })
  );

// Execute the chain
async function main() {
  const result = await summaryChain.run({
    text: 'Lorem ipsum dolor sit amet...',
  });
  
  console.log(result.output);
}

main();
```

## Creating a Chain

A chain is a sequence of steps that are executed in order. Each step can be a model call, a tool, or another type of step.

```typescript
const chain = createChain({
  name: 'my-chain',
  description: 'Description of what the chain does',
  tracer: createConsoleTracer(), // Optional
  memory: createBufferMemory(), // Optional
});
```

## Adding Steps to a Chain

### Model Step

A model step sends a prompt to a language model and gets a response.

```typescript
chain.addStep(
  step.model(modelAdapter, {
    prompt: 'Respond to the following question: {{question}}',
    // Optional model-specific options
    modelOptions: {
      temperature: 0.7,
      maxTokens: 500,
    },
  })
);
```

### Tool Step

A tool step executes a tool with inputs from the chain context.

```typescript
chain.addStep(
  step.tool(calculatorTool, {
    // Map context values to tool parameters
    expression: '{{$prevStep.output}}'
  })
);
```

### Prompt Step

A prompt step just renders a prompt template without calling a model.

```typescript
chain.addStep(
  step.prompt('This is a template with {{variable}}')
);
```

## Using the Results of Previous Steps

Each step's output is automatically stored in the execution context and can be accessed in subsequent steps using special templates:

```typescript
// Access the previous step's output
'{{$prevStep.output}}'

// Access the original input
'{{question}}'
```

## Tracing and Observability

The framework provides built-in tracing to help debug and monitor chain execution:

```typescript
// Console tracer
const tracer = createConsoleTracer();

// Add the tracer when creating the chain
const chain = createChain({
  name: 'my-chain',
  tracer: tracer,
});
```

## Memory

Memory allows chains to store and retrieve data between runs:

```typescript
// Simple in-memory buffer
const memory = createBufferMemory();

// Add memory when creating the chain
const chain = createChain({
  name: 'my-chain',
  memory: memory,
});
```

## Creating Custom Tools

You can create custom tools to extend the framework's capabilities:

```typescript
import { Tool } from '@orchestrise/core';

export const myCustomTool: Tool = {
  name: 'custom-tool',
  description: 'Describes what the tool does',
  parameters: {
    type: 'object',
    properties: {
      input1: {
        type: 'string',
        description: 'Description of this parameter',
      },
      // Add more parameters as needed
    },
    required: ['input1'],
  },
  
  async handler(input) {
    // Implement your tool logic here
    const result = await doSomething(input.input1);
    return result;
  },
};
```

## Error Handling

Chains have built-in error handling that captures errors at each step:

```typescript
try {
  const result = await chain.run(input);
  
  if (result.error) {
    console.error('Chain execution failed:', result.error);
  } else {
    console.log('Success:', result.output);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Advanced Usage

For more advanced usage, including creating custom step types, implementing custom model adapters, and integrating with external systems, please refer to the API documentation. 