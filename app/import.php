<?php
declare(strict_types=1);

/**
 * Загрузка сайта из JSON формата 3 (спецификация 2.1, раздел 12) с файлами фото из папки.
 * Сейчас — тестовое наполнение (demo/, tests/fixtures); на этапе 5 сюда же придёт «Загрузить сайт» из ZIP.
 * Всё в одной транзакции: ошибка — в базе ничего не меняется.
 */
function import_site(array $site, string $photosDir): void
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Загрузка заменяет сайт целиком: старые фото и владельцы не нужны.
        foreach (['photos', 'section_i18n', 'domain_i18n', 'domains', 'sections'] as $t) {
            $pdo->exec("DELETE FROM $t");
        }
        site_write(strip_ids($site), ['photos_dir' => $photosDir]);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
}

/** У загружаемого сайта свои id не нужны: элементы получают новые. Ссылка на владельца сохраняется. */
function strip_ids(array $site): array
{
    $strip = function (array $blocks) use (&$strip): array {
        foreach ($blocks as &$b) {
            unset($b['id']);
            foreach ($b['methods'] ?? [] as $i => $m) {
                unset($b['methods'][$i]['id']);
            }
            foreach ($b['tabs'] ?? [] as $i => $tab) {
                $b['tabs'][$i]['blocks'] = $strip($tab['blocks'] ?? []);
                $b['tabs'][$i]['operator'] = isset($tab['operator']) && $tab['operator'] !== null ? 'f' . $tab['operator'] : null;
            }
            if (isset($b['tiles'])) {
                foreach ($b['tiles'] as &$t) {
                    unset($t['id']);
                    $t['blocks'] = $strip($t['blocks'] ?? []);
                }
                unset($t);
            }
        }
        return $blocks;
    };
    $site['blocks'] = $strip($site['blocks'] ?? []);
    foreach ($site['operators'] ?? [] as $i => $op) {
        $site['operators'][$i]['id'] = 'f' . ($op['id'] ?? $i + 1);
    }
    if (isset($site['settings']['operator']) && $site['settings']['operator'] !== null) {
        $site['settings']['operator'] = 'f' . $site['settings']['operator'];
    }
    return $site;
}
