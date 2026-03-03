const menuService = require('../service/menu.service');
const menuValidation = require('../validation/menu.validation');

async function createMenu(req, res) {
  const restaurantId = menuValidation.validateRestaurantIdParam(req.params);
  const payload = menuValidation.validateCreatePayload(req.body, restaurantId);

  const menu = await menuService.createMenu(payload, req.auth);

  return res.success({
    statusCode: 201,
    message: 'Menu item created successfully',
    data: { menu }
  });
}

async function listRestaurantMenu(req, res) {
  const restaurantId = menuValidation.validateRestaurantIdParam(req.params);
  const filters = menuValidation.validateListQuery(req.query);

  const result = await menuService.listMenuByRestaurant(restaurantId, filters);

  return res.success({
    message: 'Menu items fetched successfully',
    data: result.items,
    meta: result.pagination
  });
}

async function listOwnerMenu(req, res) {
  const restaurantId = menuValidation.validateRestaurantIdParam(req.params);
  const filters = menuValidation.validateListQuery(req.query);

  const result = await menuService.listMenuForOwner(restaurantId, req.auth, filters);

  return res.success({
    message: 'Owner menu items fetched successfully',
    data: result.items,
    meta: result.pagination
  });
}

async function getMenuById(req, res) {
  const menuId = menuValidation.validateMenuIdParam(req.params);

  const menu = await menuService.getMenuById(menuId);

  return res.success({
    message: 'Menu item fetched successfully',
    data: { menu }
  });
}

async function updateMenu(req, res) {
  const menuId = menuValidation.validateMenuIdParam(req.params);
  const payload = menuValidation.validateUpdatePayload(req.body);

  const menu = await menuService.updateMenu(menuId, payload, req.auth);

  return res.success({
    message: 'Menu item updated successfully',
    data: { menu }
  });
}

async function deleteMenu(req, res) {
  const menuId = menuValidation.validateMenuIdParam(req.params);

  const result = await menuService.deleteMenu(menuId, req.auth);

  return res.success({
    message: 'Menu item deleted successfully',
    data: result
  });
}

module.exports = {
  createMenu,
  listRestaurantMenu,
  listOwnerMenu,
  getMenuById,
  updateMenu,
  deleteMenu
};
