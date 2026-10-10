<?php
declare(strict_types=1);

const ENGINE_VERSION = '0.7.0';
const APP_DIR  = __DIR__;
define('ROOT_DIR', dirname(__DIR__));
// ENOTIS_DATA — другая папка данных (проверки в CI, вторая копия сайта на одной машине).
define('DATA_DIR', getenv('ENOTIS_DATA') ?: ROOT_DIR . '/data');

require APP_DIR . '/helpers.php';
require APP_DIR . '/db.php';
require APP_DIR . '/images.php';
require APP_DIR . '/photo_service.php';
require APP_DIR . '/backup.php';
require APP_DIR . '/brand.php';
require APP_DIR . '/mail.php';
require APP_DIR . '/content.php';
require APP_DIR . '/social.php';
require APP_DIR . '/seo.php';
require APP_DIR . '/site_json.php';
require APP_DIR . '/import.php';
require APP_DIR . '/transfer.php';
require APP_DIR . '/demo.php';
require APP_DIR . '/admin.php';
require APP_DIR . '/router.php';
