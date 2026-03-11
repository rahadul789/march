export const QUERY_KEYS = Object.freeze({
  auth: Object.freeze({
    me: ['auth', 'me']
  }),
  restaurants: Object.freeze({
    list: (params = {}) => ['restaurants', 'list', params]
  })
});
