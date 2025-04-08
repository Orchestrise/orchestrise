# Orchestrise

A lightweight, modular framework for defining, executing, and monitoring LLM chains.

## Core Principles

1. **Simplicity**: Minimize magic, expose all operations
2. **Modularity**: Everything is pluggable and swappable
3. **Observability**: Every operation is traceable and debuggable
4. **Type Safety**: Strong typing throughout the codebase
5. **Testability**: Easy to test each component in isolation

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Example Usage

```typescript
import { createChain, step } from '@orchestrise/core';
import { openaiAdapter } from '@orchestrise/models';
import { searchTool, calculatorTool } from '@orchestrise/tools';
import { consoleTracer } from '@orchestrise/tracing';

// Define a chain that uses tools and memory
const researchChain = createChain({
  name: 'research-assistant',
  tracer: consoleTracer(),
})
  .addStep(
    step.prompt('Research the following topic: {{topic}}')
  )
  .addStep(
    step.tool(searchTool, {
      query: '{{$prevStep.output}}'
    })
  )
  .addStep(
    step.model({
      prompt: 'Summarize the following search results: {{$prevStep.output}}',
      model: openaiAdapter,
    })
  );

// Execute the chain
const result = await researchChain.run({
  topic: 'Renewable energy trends in 2023',
});

console.log(result.output);
```

## Package Structure

- `@orchestrise/core`: Core chain execution engine
- `@orchestrise/models`: Model adapters for different LLM providers
- `@orchestrise/tools`: Tool implementations
- `@orchestrise/tracing`: Tracing and observability
- `@orchestrise/memory`: Memory implementations for chain state

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 