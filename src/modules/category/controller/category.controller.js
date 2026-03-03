const categoryService = require('../service/category.service');
const categoryValidation = require('../validation/category.validation');

async function createCategory(req, res) {
  const restaurantId = categoryValidation.validateRestaurantIdParam(req.params);
  const payload = categoryValidation.validateCreatePayload(req.body, restaurantId);

  const category = await categoryService.createCategory(payload, req.auth);

  return res.success({
    statusCode: 201,
    message: 'Category created successfully',
    data: { category }
  });
}

async function listCategories(req, res) {
  const restaurantId = categoryValidation.validateRestaurantIdParam(req.params);

  const categories = await categoryService.listCategoriesForRestaurant(restaurantId);

  return res.success({
    message: 'Categories fetched successfully',
    data: categories
  });
}

async function listOwnerCategories(req, res) {
  const restaurantId = categoryValidation.validateRestaurantIdParam(req.params);
  const options = categoryValidation.validateOwnerListQuery(req.query);

  const categories = await categoryService.listCategoriesForOwner(restaurantId, req.auth, options);

  return res.success({
    message: 'Owner categories fetched successfully',
    data: categories
  });
}

async function updateCategory(req, res) {
  const categoryId = categoryValidation.validateCategoryIdParam(req.params);
  const payload = categoryValidation.validateUpdatePayload(req.body);

  const category = await categoryService.updateCategory(categoryId, payload, req.auth);

  return res.success({
    message: 'Category updated successfully',
    data: { category }
  });
}

async function deleteCategory(req, res) {
  const categoryId = categoryValidation.validateCategoryIdParam(req.params);

  const result = await categoryService.deleteCategory(categoryId, req.auth);

  return res.success({
    message: 'Category deleted successfully',
    data: result
  });
}

module.exports = {
  createCategory,
  listCategories,
  listOwnerCategories,
  updateCategory,
  deleteCategory
};
