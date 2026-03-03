const MENU_DEFAULTS = Object.freeze({
  DISCOUNT_PERCENT: 0,
  PREPARATION_TIME_MINUTES: 15,
  PAGE_SIZE: 20
});

const ACTIVE_ORDER_STATUSES = Object.freeze([
  'pending',
  'accepted',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned',
  'picked_up',
  'on_the_way'
]);

module.exports = {
  MENU_DEFAULTS,
  ACTIVE_ORDER_STATUSES
};
