import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomStream } from "./useRoomStream";
import type { ActiveRoom, RoomSnapshot } from "../types";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  static get last() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), handler]);
  }

  close() {
    this.closed = true;
  }

  emit(room: unknown) {
    (this.listeners.get("room") || []).forEach((handler) => handler({ data: JSON.stringify(room) }));
  }

  fail() {
    this.onerror?.();
  }
}

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: "PLAY5",
    mode: "icebreaker",
    participants: [],
    session: { phase: "choose_level" },
    ...overrides
  } as RoomSnapshot;
}

const adaptiveRoom: ActiveRoom = {
  code: "PLAY5",
  mode: "icebreaker",
  participantId: "p1",
  role: "host",
  participantToken: "token-1"
};

function handlers() {
  return { onSnapshot: vi.fn(), onLost: vi.fn(), onReconnecting: vi.fn() };
}

function respondWith(body: unknown, ok = true) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  respondWith(snapshot());
});

describe("useRoomStream", () => {
  it("hands over the first snapshot and opens a stream carrying the participant token", async () => {
    const spies = handlers();
    renderHook(() => useRoomStream(adaptiveRoom, spies));

    await waitFor(() => expect(spies.onSnapshot).toHaveBeenCalledWith(snapshot()));
    expect(FakeEventSource.last.url).toBe("/api/rooms/PLAY5/events?participantToken=token-1");
  });

  it("leaves the token off a conversation room, which has no participant access", async () => {
    const spies = handlers();
    renderHook(() => useRoomStream({ ...adaptiveRoom, mode: "conversation" }, spies));

    await waitFor(() => expect(FakeEventSource.last).toBeDefined());
    expect(FakeEventSource.last.url).toBe("/api/rooms/PLAY5/events");
  });

  it("forwards later snapshots arriving on the stream", async () => {
    const spies = handlers();
    renderHook(() => useRoomStream(adaptiveRoom, spies));
    await waitFor(() => expect(spies.onSnapshot).toHaveBeenCalled());

    act(() => FakeEventSource.last.emit(snapshot({ code: "NEXT1" })));

    expect(spies.onSnapshot).toHaveBeenLastCalledWith(snapshot({ code: "NEXT1" }));
  });

  it("reports a room that is no longer there", async () => {
    respondWith({ error: "Room not found" }, false);
    const spies = handlers();
    renderHook(() => useRoomStream(adaptiveRoom, spies));

    await waitFor(() => expect(spies.onLost).toHaveBeenCalled());
    expect(spies.onSnapshot).not.toHaveBeenCalled();
  });

  it("reports a dropped stream without tearing the room down", async () => {
    const spies = handlers();
    renderHook(() => useRoomStream(adaptiveRoom, spies));
    await waitFor(() => expect(FakeEventSource.last).toBeDefined());

    act(() => FakeEventSource.last.fail());

    expect(spies.onReconnecting).toHaveBeenCalled();
    expect(spies.onLost).not.toHaveBeenCalled();
  });

  it("closes the stream once the room is left", async () => {
    const spies = handlers();
    const { rerender } = renderHook(
      ({ room }: { room: ActiveRoom | null }) => useRoomStream(room, spies),
      { initialProps: { room: adaptiveRoom as ActiveRoom | null } }
    );
    await waitFor(() => expect(FakeEventSource.last).toBeDefined());
    const source = FakeEventSource.last;

    rerender({ room: null });

    expect(source.closed).toBe(true);
  });

  it("calls the handlers given on the latest render, not the ones the stream opened with", async () => {
    const first = handlers();
    const second = handlers();
    const { rerender } = renderHook(
      ({ spies }: { spies: ReturnType<typeof handlers> }) => useRoomStream(adaptiveRoom, spies),
      { initialProps: { spies: first } }
    );
    await waitFor(() => expect(first.onSnapshot).toHaveBeenCalled());

    rerender({ spies: second });
    act(() => FakeEventSource.last.emit(snapshot({ code: "AFTER" })));

    expect(second.onSnapshot).toHaveBeenCalledWith(snapshot({ code: "AFTER" }));
    expect(first.onSnapshot).toHaveBeenCalledTimes(1);
  });

  describe("while a spin is running", () => {
    it("holds back the snapshot that names the responder until the spin resolves", async () => {
      const spies = handlers();
      const { result } = renderHook(() => useRoomStream(adaptiveRoom, spies));
      await waitFor(() => expect(spies.onSnapshot).toHaveBeenCalled());
      const responder = snapshot({ session: { phase: "await_response" } as RoomSnapshot["session"] });

      act(() => result.current.beginSpin());
      act(() => FakeEventSource.last.emit(responder));

      expect(spies.onSnapshot).toHaveBeenCalledTimes(1);
      expect(result.current.spinning).toBe(true);

      let released: RoomSnapshot | undefined;
      act(() => { released = result.current.resolveSnapshot(snapshot({ code: "FROMPOST" })); });

      expect(released).toEqual(responder);
      expect(result.current.spinning).toBe(false);
    });

    it("passes other phases straight through", async () => {
      const spies = handlers();
      const { result } = renderHook(() => useRoomStream(adaptiveRoom, spies));
      await waitFor(() => expect(spies.onSnapshot).toHaveBeenCalled());

      act(() => result.current.beginSpin());
      act(() => FakeEventSource.last.emit(snapshot({ code: "LOBBY" })));

      expect(spies.onSnapshot).toHaveBeenLastCalledWith(snapshot({ code: "LOBBY" }));
    });

    it("uses the action's own response when nothing was held back", async () => {
      const spies = handlers();
      const { result } = renderHook(() => useRoomStream(adaptiveRoom, spies));
      await waitFor(() => expect(spies.onSnapshot).toHaveBeenCalled());
      const posted = snapshot({ code: "FROMPOST" });

      let released: RoomSnapshot | undefined;
      act(() => { released = result.current.resolveSnapshot(posted); });

      expect(released).toEqual(posted);
    });

    it("drops anything held back when the action fails", async () => {
      const spies = handlers();
      const { result } = renderHook(() => useRoomStream(adaptiveRoom, spies));
      await waitFor(() => expect(spies.onSnapshot).toHaveBeenCalled());

      act(() => result.current.beginSpin());
      act(() => FakeEventSource.last.emit(snapshot({ session: { phase: "await_response" } as RoomSnapshot["session"] })));
      act(() => result.current.endSpin());

      let released: RoomSnapshot | undefined;
      act(() => { released = result.current.resolveSnapshot(snapshot({ code: "FROMPOST" })); });

      expect(released).toEqual(snapshot({ code: "FROMPOST" }));
      expect(result.current.spinning).toBe(false);
    });
  });
});
