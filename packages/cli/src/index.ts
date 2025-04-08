#!/usr/bin/env node

import { Command } from 'commander';
import { run } from './commands/run';
import { list } from './commands/list';
import { create } from './commands/create';

// CLI meta information
const program = new Command();
program
  .name('orchestrise')
  .description('CLI for the Orchestrise LLM chain framework')
  .version('0.1.0');

// Run a chain
program
  .command('run')
  .description('Run a chain from a file')
  .argument('<file>', 'Chain definition file (JSON)')
  .option('-i, --input <json>', 'Input as JSON string')
  .option('-f, --input-file <file>', 'Input from JSON file')
  .option('-s, --stream', 'Stream the output as it\'s generated')
  .option('-m, --model <model>', 'Override the model to use')
  .action(run);

// List available components
program
  .command('list')
  .description('List available components')
  .option('-m, --models', 'List available models')
  .option('-t, --tools', 'List available tools')
  .option('-c, --chains', 'List saved chains')
  .action(list);

// Create a new chain
program
  .command('create')
  .description('Create a new chain')
  .option('-n, --name <name>', 'Chain name')
  .option('-i, --interactive', 'Use interactive mode')
  .option('-o, --output <file>', 'Output file')
  .action(create);

// Process arguments
program.parse(process.argv);

// If no arguments, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export * from './commands/run';
export * from './commands/list';
export * from './commands/create';
export * from './utils/registry';
export * from './utils/io'; 