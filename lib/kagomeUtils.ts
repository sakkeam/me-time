export interface MorphemeToken {
  surface: string;
  pos: string;
  baseForm: string;
  reading: string;
  start: number;
  end: number;
  posType: string;
}

class KagomeWASM {
  private initialized = false;
  private initializing = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing && this.initPromise) return this.initPromise;

    this.initializing = true;
    this.initPromise = this.loadWASM();
    await this.initPromise;
  }

  private async loadWASM(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('WASM can only be loaded in browser environment');
    }

    // Load wasm_exec.js
    const script = document.createElement('script');
    script.src = '/wasm_exec.js';
    
    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load wasm_exec.js'));
      document.head.appendChild(script);
    });

    // Initialize Go runtime
    const go = new (window as any).Go();
    
    try {
      const result = await WebAssembly.instantiateStreaming(
        fetch('/kagome.wasm'),
        go.importObject
      );
      
      // Run Go program
      go.run(result.instance);
      
      // Wait for kagome to be ready
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if ((window as any).kagome_tokenize) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

      this.initialized = true;
      this.initializing = false;
    } catch (error) {
      this.initializing = false;
      throw new Error(`Failed to load kagome WASM: ${error}`);
    }
  }

  tokenize(text: string): MorphemeToken[] {
    if (!this.initialized) {
      throw new Error('Kagome WASM not initialized. Call init() first.');
    }

    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      const result = (window as any).kagome_tokenize(text);
      return result || [];
    } catch (error) {
      console.error('Tokenization error:', error);
      return [];
    }
  }
}

export const kagome = new KagomeWASM();
