<?php
declare(strict_types=1);

/**
 * Claid.ai — основной фотосервис (раздел 10.6.1). Ничего не дорисовывает:
 * «Студийное фото» — только вырезка бутылки (прозрачный PNG, свет и цвет без генерации),
 * «Улучшить» — резкость, шум, свет, увеличение. Кадр и фон ставит движок.
 * Документация: https://docs.claid.ai (Image editing API, upload).
 */
function claid_process(string $src, string $mode, string $key): string
{
    $ops = $mode === 'studio'
        ? [
            'restorations' => ['decompress' => 'auto'],
            'adjustments'  => ['hdr' => ['intensity' => 30]],
            'background'   => ['remove' => ['category' => 'products'], 'color' => 'transparent'],
        ]
        : [
            'restorations' => ['upscale' => 'smart_enhance', 'decompress' => 'auto'],
            'adjustments'  => ['hdr' => ['intensity' => 40]],
        ];
    $data = ['operations' => $ops, 'output' => ['format' => $mode === 'studio' ? 'png' : ['type' => 'jpeg', 'quality' => 92]]];
    $body = photo_http('https://api.claid.ai/v1/image/edit/upload', ['Authorization: Bearer ' . $key], [
        'file' => new CURLFile($src),
        'data' => json_encode($data),
    ]);
    $j = json_decode($body, true);
    $url = $j['data']['output']['tmp_url'] ?? null;
    if (!is_string($url) || !str_starts_with($url, 'https://')) {
        throw new RuntimeException('Claid: нет ссылки на результат: ' . substr($body, 0, 300));
    }
    return photo_http_get($url);
}
