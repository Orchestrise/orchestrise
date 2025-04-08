import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import { loadRegistry } from '../utils/registry';
import { Chain, ChainConfig } from '@orchestrise/core';

interface CreateOptions {
  name?: string;
  model?: string;
  output?: string;
  tools?: string[];
}

/**
 * Creates a new chain with interactive prompts
 */
export async function create(options: CreateOptions): Promise<void> {
  // Load the registry to get available components
  const registry = loadRegistry();
  
  const availableModels = Object.keys(registry.modelAdapters);
  if (availableModels.length === 0) {
    console.error(chalk.red('No model adapters found. Please install at least one model adapter.'));
    return;
  }
  
  const availableTools = Object.keys(registry.tools);
  
  // Interactive mode if options are missing
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Chain name:',
      default: options.name || `chain-${Date.now()}`,
      validate: (input: string) => {
        if (!input) return 'Name is required';
        return true;
      }
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select model:',
      choices: availableModels,
      default: options.model || availableModels[0],
      when: !options.model || !availableModels.includes(options.model)
    },
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Select tools (optional):',
      choices: availableTools,
      default: options.tools || [],
      when: availableTools.length > 0
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output file (leave empty to save in orchestrise directory):',
      default: options.output || ''
    }
  ]);
  
  // Combine CLI options with interactive answers
  const chainName = options.name || answers.name;
  const modelName = options.model || answers.model;
  const selectedTools = options.tools || answers.tools || [];
  const outputFile = options.output || answers.output;
  
  // Create chain configuration
  const chainConfig: ChainConfig = {
    id: uuidv4(),
    model: modelName,
    tools: selectedTools.map(tool => ({ name: tool }))
  };
  
  try {
    // Create a new Chain instance to validate configuration
    new Chain(chainConfig);
    
    // Determine output path
    let outputPath: string;
    if (outputFile) {
      // Use provided output path
      outputPath = outputFile.endsWith('.json') ? outputFile : `${outputFile}.json`;
    } else {
      // Save to ~/.orchestrise/chains directory
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const chainsDir = path.join(homeDir || '.', '.orchestrise', 'chains');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(chainsDir)) {
        fs.mkdirSync(chainsDir, { recursive: true });
      }
      
      outputPath = path.join(chainsDir, `${chainName}.json`);
    }
    
    // Save chain configuration
    fs.writeFileSync(outputPath, JSON.stringify(chainConfig, null, 2));
    
    console.log(chalk.green(`Chain "${chainName}" created successfully!`));
    console.log(chalk.dim(`Configuration saved to: ${outputPath}`));
    
    // Display usage instructions
    console.log(chalk.bold('\nUsage:'));
    console.log(`orchestrise run ${chainName}`);
    
  } catch (error) {
    console.error(chalk.red(`Error creating chain: ${error instanceof Error ? error.message : String(error)}`));
  }
} 