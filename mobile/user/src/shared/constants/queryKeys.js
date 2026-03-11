function normalizeListParams(params = {}) {
  return {
    page: Number(params.page) > 0 ? Number(params.page) : 1,
    limit: Number(params.limit) > 0 ? Number(params.limit) : 10,
    q: params.q ? String(params.q).trim() : ''
  };
}

function normalizeMenuParams(params = {}) {
  const list = normalizeListParams(params);
  return {
    ...list,
    categoryId: params.categoryId ? String(params.categoryId) : null
  };
}

export const QUERY_KEYS = Object.freeze({
  auth: Object.freeze({
    me: ['auth', 'me']
  }),
  order: Object.freeze({
    detail: (orderId) => ['order', 'detail', String(orderId || '')]
  }),
  cart: Object.freeze({
    byRestaurant: (restaurantId) => [
      'cart',
      'restaurant',
      String(restaurantId || '')
    ]
  }),
  restaurant: Object.freeze({
    list: (params = {}) => ['restaurant', 'list', normalizeListParams(params)],
    detail: (restaurantId) => ['restaurant', 'detail', String(restaurantId || '')],
    categories: (restaurantId) => ['restaurant', 'categories', String(restaurantId || '')],
    menu: (restaurantId, params = {}) => [
      'restaurant',
      'menu',
      String(restaurantId || ''),
      normalizeMenuParams(params)
    ]
  })
});
