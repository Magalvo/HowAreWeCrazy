import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "../api";
import { isAdaptiveRoom } from "../labels";
import type { ActiveRoom, AdaptiveSession, RoomSnapshot } from "../types";

interface RoomStreamHandlers {
  onSnapshot: (room: RoomSnapshot) => void;
  onLost: () => void;
  onReconnecting: () => void;
}

/**
 * Keeps one live room in sync: the first snapshot over HTTP, then Server-Sent Events.
 *
 * It also owns the spin handshake. Icebreaker picks its responder on the server, so the
 * snapshot naming that responder arrives before the wheel has finished turning. While a
 * spin is running the incoming snapshot is held back and released by `resolveSnapshot`,
 * which keeps the reveal in step with the animation.
 */
export function useRoomStream(activeRoom: ActiveRoom | null, handlers: RoomStreamHandlers) {
  const [spinning, setSpinning] = useState(false);
  const spinningRef = useRef(false);
  const deferredRef = useRef<RoomSnapshot | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const beginSpin = useCallback(() => {
    spinningRef.current = true;
    setSpinning(true);
  }, []);

  const endSpin = useCallback(() => {
    spinningRef.current = false;
    deferredRef.current = null;
    setSpinning(false);
  }, []);

  const resolveSnapshot = useCallback((response: RoomSnapshot) => {
    const next = deferredRef.current || response;
    endSpin();
    return next;
  }, [endSpin]);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => {
    if (!activeRoom) {
      closeStream();
      return;
    }
    let cancelled = false;
    const query = isAdaptiveRoom(activeRoom)
      ? `?participantToken=${encodeURIComponent(activeRoom.participantToken || "")}`
      : "";
    const acceptSnapshot = (room: RoomSnapshot) => {
      if (spinningRef.current && (room.session as AdaptiveSession)?.phase === "await_response") {
        deferredRef.current = room;
        return;
      }
      handlersRef.current.onSnapshot(room);
    };

    void requestJson<RoomSnapshot>(`/api/rooms/${activeRoom.code}${query}`)
      .then((room) => {
        if (!cancelled) {
          acceptSnapshot(room);
        }
      })
      .catch(() => {
        if (!cancelled) {
          handlersRef.current.onLost();
        }
      });

    const source = new EventSource(`/api/rooms/${activeRoom.code}/events${query}`);
    sourceRef.current = source;
    source.addEventListener("room", (event) => {
      if (!cancelled) {
        acceptSnapshot(JSON.parse((event as MessageEvent).data) as RoomSnapshot);
      }
    });
    source.onerror = () => {
      if (!cancelled) {
        handlersRef.current.onReconnecting();
      }
    };

    return () => {
      cancelled = true;
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
    // Reconnect only when the room identity changes; later state arrives over the stream.
  }, [activeRoom?.code, activeRoom?.participantToken, closeStream]);

  return { spinning, beginSpin, endSpin, resolveSnapshot, closeStream };
}
