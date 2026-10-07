<?php
declare(strict_types=1);

const APP_DIR  = __DIR__;
define('ROOT_DIR', dirname(__DIR__));
define('DATA_DIR', ROOT_DIR . '/data');

require APP_DIR . '/helpers.php';
require APP_DIR . '/router.php';
