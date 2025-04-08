import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { chainFromJSON } from '@orchestrise/core';
import { loadRegistry } from '../utils/registry';
import { readJSONFile } from '../utils/io';

interface RunOptions {
  input?: string;
  inputFile?: string;
  stream?: boolean;
  model?: string;
}

/**
 * Run a chain from a file
 */
export async function run(file: string, options: RunOptions): Promise<void> {
  try {
    // 1. Validate file exists
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`Error: File not found: ${file}`));
      process.exit(1);
    }

    // 2. Load the chain definition
    const spinner = ora('Loading chain...').start();
    
    try {
      const chainJSON = fs.readFileSync(file, 'utf-8');
      
      // 3. Load the registry of available components
      const registry = loadRegistry();
      
      // 4. Create the chain from the JSON definition
      const chain = chainFromJSON(chainJSON, registry);
      
      spinner.succeed(`Chain "${chain.id}" loaded successfully`);
      
      // 5. Get input data
      let input: Record<string, any> = {};
      
      if (options.input) {
        try {
          input = JSON.parse(options.input);
        } catch (error) {
          console.error(chalk.red('Error parsing input JSON:'), error);
          process.exit(1);
        }
      } else if (options.inputFile) {
        try {
          input = readJSONFile(options.inputFile);
        } catch (error) {
          console.error(chalk.red(`Error reading input file: ${options.inputFile}`), error);
          process.exit(1);
        }
      } else {
        // If no input is provided, use an empty object
        input = {};
      }
      
      // 6. Set up run options based on CLI flags
      const runOptions: any = {};
      
      if (options.stream) {
        runOptions.stream = true;
        runOptions.onPartialResult = (partialResult: any) => {
          if (!partialResult.isDone && partialResult.chunk) {
            process.stdout.write(partialResult.chunk);
          }
        };
      }
      
      if (options.model) {
        runOptions.modelOptions = { model: options.model };
      }
      
      // 7. Run the chain
      const runSpinner = ora('Running chain...').start();
      
      try {
        const result = await chain.run(input, runOptions);
        
        if (result.error) {
          runSpinner.fail('Chain execution failed');
          console.error(chalk.red('Error:'), result.error);
          process.exit(1);
        } else {
          runSpinner.succeed('Chain executed successfully');
          
          // Only print the output if not streaming (otherwise it's already printed)
          if (!options.stream) {
            console.log('\nOutput:');
            console.log(result.output);
          }
          
          console.log('\nMetadata:');
          if (result.trace) {
            console.log(`Steps: ${result.trace.length}`);
            console.log(`Duration: ${getTotalDuration(result.trace)}ms`);
          }
        }
      } catch (error) {
        runSpinner.fail('Chain execution failed');
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Failed to load chain');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  }
}

/**
 * Calculate the total duration from trace
 */
function getTotalDuration(trace: Array<{ duration: number }>): number {
  return trace.reduce((sum, step) => sum + step.duration, 0);
} 