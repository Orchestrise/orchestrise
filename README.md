# Orchestrise

A lightweight, modular framework for defining, executing, and monitoring LLM chains with type safety and full observability.

## Core Principles

1. **Simplicity**: Minimize magic, expose all operations
2. **Modularity**: Everything is pluggable and swappable
3. **Observability**: Every operation is traceable and debuggable
4. **Type Safety**: Strong typing throughout the codebase
5. **Testability**: Easy to test each component in isolation

## Key Features

- **Advanced Chain Composition**: Define complex workflows with branching logic
- **Streaming Support**: Real-time responses for responsive UIs
- **Chain Serialization**: Save and share chains as JSON
- **Powerful CLI**: Run chains from the command line
- **Tracing & Observability**: Full visibility into execution paths
- **Model Adapters**: Support for multiple LLM providers
- **Tool Integration**: Seamless integration with tools

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the example
pnpm example:math
```

## Example Usage

```typescript
import { createChain, step } from '@orchestrise/core';
import { openaiAdapter } from '@orchestrise/models';
import { calculatorTool } from '@orchestrise/tools';
import { consoleTracer } from '@orchestrise/tracing';

// Define a chain with conditional branching
const mathChain = createChain({
  name: 'math-assistant',
  tracer: consoleTracer(),
})
  .addStep(
    step.model(openaiAdapter, {
      prompt: 'Extract the math problem from: {{query}}',
    })
  )
  // Add a conditional step for different problem types
  .addStep(
    step.conditional({
      condition: '{{$prevStep.output}}.includes("+")',
      trueStep: step.tool(calculatorTool, {
        expression: '{{$prevStep.output}}'
      }),
      falseStep: step.model(openaiAdapter, {
        prompt: 'Solve this math problem: {{$prevStep.output}}',
      })
    })
  )
  // Format the final response
  .addStep(
    step.model(openaiAdapter, {
      prompt: 'The answer to {{query}} is {{$prevStep.output}}',
    })
  );

// Execute the chain with streaming support
const result = await mathChain.run(
  { query: 'What is 25 * 4?' },
  { 
    stream: true,
    onPartialResult: (partial) => {
      if (partial.chunk) {
        process.stdout.write(partial.chunk);
      }
    }
  }
);

// Save chain for later use
const chainJson = chain.toJSON(mathChain);
fs.writeFileSync('math-chain.json', chainJson);
```

## Using the CLI

```bash
# Run a chain from a JSON file
orchestrise run math-chain.json --input '{"query": "What is 25 * 4?"}'

# Run with streaming output
orchestrise run math-chain.json --input '{"query": "What is 25 * 4?"}' --stream

# List available models and tools
orchestrise list --models --tools

# Create a new chain interactively
orchestrise create --interactive
```

## Package Structure

- `@orchestrise/core`: Core chain execution engine
- `@orchestrise/models`: Model adapters for different LLM providers
- `@orchestrise/tools`: Tool implementations
- `@orchestrise/tracing`: Tracing and observability
- `@orchestrise/memory`: Memory implementations for chain state
- `@orchestrise/cli`: Command-line interface

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 