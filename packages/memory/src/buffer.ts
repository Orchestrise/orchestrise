import { Memory } from '@orchestrise/core';

export class BufferMemory implements Memory {
  private store: Map<string, any> = new Map();
  
  async read(key: string): Promise<any> {
    return this.store.get(key);
  }
  
  async write(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }
  
  async clear(): Promise<void> {
    this.store.clear();
  }
}

export function createBufferMemory(): Memory {
  return new BufferMemory();
} 