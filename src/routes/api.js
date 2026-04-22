const express = require('express');
const { getProducts } = require('../controllers/apiController');

const router = express.Router();
router.get('/products', getProducts);

module.exports = router;
