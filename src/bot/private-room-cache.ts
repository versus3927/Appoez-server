export type PrivateRoomRecord = {
  channelId: string;
  ownerId: string;
  guildId: string;
};

const rooms = new Map<string, PrivateRoomRecord>();

export function setPrivateRoom(record: PrivateRoomRecord) {
  rooms.set(record.channelId, record);
}

export function getPrivateRoom(channelId: string) {
  return rooms.get(channelId) ?? null;
}

export function deletePrivateRoom(channelId: string) {
  rooms.delete(channelId);
}
