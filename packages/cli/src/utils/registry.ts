import fs from 'fs';
import path from 'path';
import { createOpenAIAdapter } from '@orchestrise/models';
import { calculatorTool } from '@orchestrise/tools';
import { createConsoleTracer } from '@orchestrise/tracing';
import { createBufferMemory } from '@orchestrise/memory';

/**
 * Registry of available components
 */
export interface Registry {
  modelAdapters: Record<string, any>;
  tools: Record<string, any>;
  tracers: Record<string, any>;
  memories: Record<string, any>;
}

/**
 * Load the registry of available components
 */
export function loadRegistry(): Registry {
  // Create default registry
  const registry: Registry = {
    modelAdapters: {
      'openai': createOpenAIAdapter(),
    },
    tools: {
      'calculator': calculatorTool,
    },
    tracers: {
      'console': createConsoleTracer(),
    },
    memories: {
      'buffer': createBufferMemory(),
    },
  };
  
  // Allow extending with custom components
  try {
    // Get user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const configDir = path.join(homeDir || '.', '.orchestrise');
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Check for custom registry file
    const registryFile = path.join(configDir, 'registry.json');
    
    if (fs.existsSync(registryFile)) {
      try {
        const customRegistry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
        
        // Merge custom registry with default
        Object.keys(customRegistry).forEach((key) => {
          if (key in registry) {
            registry[key as keyof Registry] = {
              ...registry[key as keyof Registry],
              ...customRegistry[key],
            };
          }
        });
      } catch (error) {
        console.warn('Warning: Failed to load custom registry:', error);
      }
    }
  } catch (error) {
    console.warn('Warning: Failed to set up registry directory:', error);
  }
  
  return registry;
}

/**
 * Register a custom component in the registry
 */
export function registerComponent(
  type: keyof Registry,
  name: string,
  component: any
): void {
  try {
    // Get user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const configDir = path.join(homeDir || '.', '.orchestrise');
    const registryFile = path.join(configDir, 'registry.json');
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Load existing registry or create new one
    let registry: Registry = {
      modelAdapters: {},
      tools: {},
      tracers: {},
      memories: {},
    };
    
    if (fs.existsSync(registryFile)) {
      try {
        registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
      } catch (error) {
        console.warn('Warning: Failed to load registry, creating new one');
      }
    }
    
    // Add or update component
    if (!registry[type]) {
      registry[type] = {};
    }
    
    registry[type][name] = component;
    
    // Save registry
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));
    
    console.log(`Registered ${type} "${name}" successfully`);
  } catch (error) {
    console.error('Failed to register component:', error);
    throw error;
  }
} 