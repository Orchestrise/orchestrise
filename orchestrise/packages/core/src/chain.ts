import {
  Chain,
  Step,
  RunOptions,
  ChainResult,
  Tracer,
  Memory,
  StepTrace,
} from './types';
import { SimpleExecutionContext } from './context';

export class BaseChain implements Chain {
  id: string;
  steps: Step[] = [];
  private tracer?: Tracer;
  private memory?: Memory;

  constructor(id: string, options?: { tracer?: Tracer; memory?: Memory }) {
    this.id = id;
    this.tracer = options?.tracer;
    this.memory = options?.memory;
  }

  addStep(step: Step): Chain {
    step.validate();
    this.steps.push(step);
    return this;
  }

  async run(
    input: Record<string, any>,
    options?: RunOptions
  ): Promise<ChainResult> {
    const context = new SimpleExecutionContext(input, options, this.memory);
    const trace: StepTrace[] = [];
    
    if (this.tracer) {
      await this.tracer.startChain(this.id, input);
    }

    let result: any = { ...input };
    
    for (const step of this.steps) {
      const startTime = new Date();
      
      try {
        const stepResult = await step.execute(context);
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        const stepTrace: StepTrace = {
          stepId: step.id,
          input: result,
          output: stepResult.output,
          duration,
          startTime,
          endTime,
          metadata: stepResult.metadata,
        };
        
        trace.push(stepTrace);
        
        if (this.tracer) {
          await this.tracer.recordStep(
            step.id,
            result,
            stepResult.output,
            stepResult.metadata || {}
          );
        }
        
        if (stepResult.error) {
          if (this.tracer) {
            await this.tracer.endChain({ 
              error: stepResult.error,
              trace 
            });
          }
          return { error: stepResult.error, trace };
        }
        
        result = stepResult.output;
        context.updateState({ $prevStep: { output: result } });
      } catch (error) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        const stepTrace: StepTrace = {
          stepId: step.id,
          input: result,
          output: null,
          duration,
          startTime,
          endTime,
          metadata: { error },
        };
        
        trace.push(stepTrace);
        
        if (this.tracer) {
          await this.tracer.endChain({ 
            error: error instanceof Error ? error : new Error(String(error)),
            trace 
          });
        }
        
        return { 
          error: error instanceof Error ? error : new Error(String(error)),
          trace 
        };
      }
    }
    
    if (this.tracer) {
      await this.tracer.endChain({ output: result, trace });
    }
    
    return { output: result, trace };
  }
} 