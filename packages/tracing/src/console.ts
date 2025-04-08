import { Tracer, ChainResult } from '@orchestrise/core';

export class ConsoleTracer implements Tracer {
  private startTime: number = 0;
  private chainId: string = '';

  async startChain(chainId: string, input: Record<string, any>): Promise<void> {
    this.startTime = Date.now();
    this.chainId = chainId;
    
    console.log(`[Orchestrise] Chain ${chainId} started with input:`, input);
  }

  async recordStep(
    stepId: string,
    input: any,
    output: any,
    metadata: Record<string, any>
  ): Promise<void> {
    console.log(`[Orchestrise] Step ${stepId} executed:`);
    console.log(`  Input:`, input);
    console.log(`  Output:`, output);
    
    if (Object.keys(metadata).length > 0) {
      console.log(`  Metadata:`, metadata);
    }
  }

  async endChain(result: ChainResult): Promise<void> {
    const duration = Date.now() - this.startTime;
    
    if (result.error) {
      console.error(`[Orchestrise] Chain ${this.chainId} failed after ${duration}ms:`, result.error);
    } else {
      console.log(`[Orchestrise] Chain ${this.chainId} completed in ${duration}ms with output:`, result.output);
    }
    
    if (result.trace && result.trace.length > 0) {
      console.log(`[Orchestrise] Chain execution trace:`, result.trace);
    }
  }
}

export function createConsoleTracer(): Tracer {
  return new ConsoleTracer();
} 