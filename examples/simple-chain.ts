import { createChain, step } from '../packages/core';
import { createOpenAIAdapter } from '../packages/models';
import { calculatorTool } from '../packages/tools';
import { createConsoleTracer } from '../packages/tracing';
import { createBufferMemory } from '../packages/memory';

// Create a model adapter (with environment variables for credentials)
const openai = createOpenAIAdapter({
  defaultModel: 'gpt-3.5-turbo',
});

// Create a simple chain that performs calculations
const mathChain = createChain({
  name: 'math-assistant',
  description: 'Helps solve mathematical problems',
  tracer: createConsoleTracer(),
  memory: createBufferMemory(),
})
  // Step 1: Process the user question
  .addStep(
    step.model(openai, {
      prompt: 'Extract the mathematical expression from the following question: "{{question}}".\nOnly return the expression, nothing else.',
    })
  )
  
  // Step 2: Calculate the result
  .addStep(
    step.tool(calculatorTool, {
      expression: '{{$prevStep.output}}'
    })
  )
  
  // Step 3: Format the response
  .addStep(
    step.model(openai, {
      prompt: 'The question was: "{{question}}"\nThe extracted mathematical expression was: {{$prevStep.input.expression}}\nThe calculated result is: {{$prevStep.output}}\n\nProvide a helpful response to the user explaining the calculation.',
    })
  );

// Run the chain
async function runExample() {
  try {
    const result = await mathChain.run({
      question: 'What is the result of 25 × 3 + 10 divided by 2?',
    });
    
    console.log('\nFinal Result:');
    console.log(result.output);
  } catch (error) {
    console.error('Chain execution failed:', error);
  }
}

// Only run if directly executed (not imported)
if (require.main === module) {
  runExample();
} 