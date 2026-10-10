<?php
declare(strict_types=1);

// Справочник способов оплаты (спецификация 2.1, раздел 7.2). Новый сервис — строка здесь
// и подпись pay.provider.{код} в app/lang/*.php.
return [
    'qr'            => ['kind' => 'qr',         'format' => 'all'],
    'sbp'           => ['kind' => 'link',       'format' => 'RU'],
    'sberpay'       => ['kind' => 'link',       'format' => 'RU'],
    'tpay'          => ['kind' => 'link',       'format' => 'RU'],
    'yookassa'      => ['kind' => 'link',       'format' => 'RU'],
    'robokassa'     => ['kind' => 'link',       'format' => 'RU'],
    'cloudpayments' => ['kind' => 'link',       'format' => 'RU'],
    'flitt'         => ['kind' => 'link',       'format' => 'GE'],
    'bog'           => ['kind' => 'link',       'format' => 'GE'],
    'tbc'           => ['kind' => 'link',       'format' => 'GE'],
    'quickpay'      => ['kind' => 'link',       'format' => 'GE'],
    'keepz'         => ['kind' => 'link',       'format' => 'GE'],
    'custom'        => ['kind' => 'link',       'format' => 'all'],
    'requisites'    => ['kind' => 'requisites', 'format' => 'all'],
];
