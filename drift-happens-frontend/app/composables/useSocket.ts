import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function useSocket() {
  const config = useRuntimeConfig();

  if (import.meta.server) {
    return null;
  }

  if (!socket) {
    socket = io(config.public.socketBase, {
      transports: ['websocket'],
      withCredentials: true,
    });
  }

  return socket;
}
