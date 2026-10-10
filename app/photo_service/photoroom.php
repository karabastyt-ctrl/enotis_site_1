<?php
declare(strict_types=1);

/**
 * Photoroom — запасной фотосервис (раздел 10.6.1). Image Editing API v2, ответ — сама картинка.
 * «Студийное фото» — вырезка в прозрачный PNG; «Улучшить» — свет и увеличение без смены фона.
 * Документация: https://docs.photoroom.com (Image Editing API).
 */
function photoroom_process(string $src, string $mode, string $key): string
{
    $fields = ['imageFile' => new CURLFile($src), 'outputSize' => 'originalImage'];
    if ($mode === 'studio') {
        $fields += ['removeBackground' => 'true', 'background.color' => 'transparent', 'export.format' => 'png'];
    } else {
        $fields += ['removeBackground' => 'false', 'lighting.mode' => 'ai.auto', 'upscale.mode' => 'ai.fast', 'export.format' => 'jpeg'];
    }
    return photo_http('https://image-api.photoroom.com/v2/edit', ['x-api-key: ' . $key], $fields);
}
