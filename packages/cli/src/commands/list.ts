import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { loadRegistry } from '../utils/registry';
import { getFilesWithExtension } from '../utils/io';

interface ListOptions {
  models?: boolean;
  tools?: boolean;
  chains?: boolean;
}

/**
 * List available components (models, tools, chains)
 */
export async function list(options: ListOptions): Promise<void> {
  // If no specific options are provided, show everything
  if (!options.models && !options.tools && !options.chains) {
    options.models = true;
    options.tools = true;
    options.chains = true;
  }
  
  // Load the registry to get available components
  const registry = loadRegistry();
  
  // List models
  if (options.models) {
    console.log(chalk.bold('\nAvailable Models:'));
    console.log(chalk.dim('----------------'));
    
    const models = Object.keys(registry.modelAdapters);
    
    if (models.length === 0) {
      console.log(chalk.dim('No models found'));
    } else {
      for (const model of models) {
        const adapter = registry.modelAdapters[model];
        const details = [];
        
        if (adapter.streamingSupported) {
          details.push(chalk.green('Streaming'));
        }
        
        console.log(`- ${chalk.cyan(model)} ${details.length ? details.join(', ') : ''}`);
      }
    }
  }
  
  // List tools
  if (options.tools) {
    console.log(chalk.bold('\nAvailable Tools:'));
    console.log(chalk.dim('----------------'));
    
    const tools = Object.keys(registry.tools);
    
    if (tools.length === 0) {
      console.log(chalk.dim('No tools found'));
    } else {
      for (const tool of tools) {
        const toolObj = registry.tools[tool];
        console.log(`- ${chalk.cyan(tool)}: ${chalk.dim(toolObj.description || 'No description')}`);
      }
    }
  }
  
  // List chains
  if (options.chains) {
    console.log(chalk.bold('\nSaved Chains:'));
    console.log(chalk.dim('-------------'));
    
    try {
      // Get user's home directory
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const chainsDir = path.join(homeDir || '.', '.orchestrise', 'chains');
      
      // Create chains directory if it doesn't exist
      if (!fs.existsSync(chainsDir)) {
        fs.mkdirSync(chainsDir, { recursive: true });
        console.log(chalk.dim('No chains found'));
        return;
      }
      
      // Find all JSON files in the chains directory
      const chainFiles = getFilesWithExtension(chainsDir, '.json');
      
      if (chainFiles.length === 0) {
        console.log(chalk.dim('No chains found'));
      } else {
        for (const chainFile of chainFiles) {
          try {
            // Read the chain file to get metadata
            const chain = JSON.parse(fs.readFileSync(chainFile, 'utf-8'));
            const chainName = path.basename(chainFile, '.json');
            
            console.log(`- ${chalk.cyan(chainName)} (${chalk.dim(chain.id || 'Unknown')})`);
          } catch (error) {
            console.log(`- ${chalk.cyan(path.basename(chainFile, '.json'))} ${chalk.red('(Invalid format)')}`);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error listing chains: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
} 