<?php
declare(strict_types=1);

// Единая точка входа: все адреса сайта приходят сюда (см. .htaccess).
require dirname(__DIR__) . '/app/bootstrap.php';

route($_SERVER['REQUEST_URI'] ?? '/');
