// ============================================================================
// XPMeter Improved: Typed Event Bus
// ============================================================================

type EventHandler<T> = (data: T) => void;

/**
 * Strongly-typed event emitter. Enables decoupled communication between
 * reader, tracker, overlay, and UI components.
 *
 * Pattern borrowed from RuneLite's EventBus concept, adapted for TypeScript.
 */
export class EventBus<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<Function>>();
  private onceListeners = new Map<keyof Events, Set<Function>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to an event once. Auto-unsubscribes after first fire.
   */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler);
  }

  /**
   * Emit an event with data.
   */
  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(`[EventBus] Error in handler for "${String(event)}":`, e); }
    });

    const onceSet = this.onceListeners.get(event);
    if (onceSet && onceSet.size > 0) {
      onceSet.forEach((fn) => {
        try { fn(data); } catch (e) { console.error(`[EventBus] Error in once handler for "${String(event)}":`, e); }
      });
      onceSet.clear();
    }
  }

  /**
   * Remove all listeners for a specific event, or all events.
   */
  off<K extends keyof Events>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get listener count for debugging.
   */
  listenerCount<K extends keyof Events>(event: K): number {
    return (this.listeners.get(event)?.size || 0) + (this.onceListeners.get(event)?.size || 0);
  }
}
