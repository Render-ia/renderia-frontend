import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus.ts';

type Events = { saved: { id: number }; closed: undefined };

describe('EventBus (patrón Observer)', () => {
  it('notifies every subscriber of an event with its payload', () => {
    const bus = new EventBus<Events>();
    const first = vi.fn();
    const second = vi.fn();
    bus.on('saved', first);
    bus.on('saved', second);

    bus.emit('saved', { id: 4 });
    expect(first).toHaveBeenCalledWith({ id: 4 });
    expect(second).toHaveBeenCalledWith({ id: 4 });
  });

  it('does not mix different events', () => {
    const bus = new EventBus<Events>();
    const onSaved = vi.fn();
    bus.on('saved', onSaved);
    bus.emit('closed', undefined);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribing', () => {
    const bus = new EventBus<Events>();
    const listener = vi.fn();
    const unsubscribe = bus.on('saved', listener);
    unsubscribe();
    bus.emit('saved', { id: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
