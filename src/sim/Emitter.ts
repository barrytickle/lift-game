/** Minimal typed event emitter so the sim stays free of Phaser imports. */
export class Emitter<Events extends { [K in keyof Events]: unknown }> {
  private handlers: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void): () => void {
    (this.handlers[event] ??= []).push(fn);
    return () => {
      this.handlers[event] = this.handlers[event]?.filter((h) => h !== fn);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers[event]?.forEach((fn) => fn(payload));
  }
}
