const USER_ROOM_PREFIX = 'user';
const ORDER_ROOM_PREFIX = 'order';

function getUserRoom(userId) {
  return `${USER_ROOM_PREFIX}:${String(userId)}`;
}

function getOrderRoom(orderId) {
  return `${ORDER_ROOM_PREFIX}:${String(orderId)}`;
}

module.exports = {
  USER_ROOM_PREFIX,
  ORDER_ROOM_PREFIX,
  getUserRoom,
  getOrderRoom
};
