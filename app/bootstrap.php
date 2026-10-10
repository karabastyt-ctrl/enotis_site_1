<?php
declare(strict_types=1);

const ENGINE_VERSION = '0.2.0';
const APP_DIR  = __DIR__;
define('ROOT_DIR', dirname(__DIR__));
define('DATA_DIR', ROOT_DIR . '/data');

require APP_DIR . '/helpers.php';
require APP_DIR . '/db.php';
require APP_DIR . '/router.php';
