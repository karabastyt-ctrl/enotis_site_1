<?php
declare(strict_types=1);

/**
 * Для поисковиков (спецификация 2.1, раздел 9.2): canonical с учётом адресов, JSON-LD, sitemap.xml, robots.txt.
 */

/** Адрес внутри ленты с префиксом таба: '/' у таба — '/gruziya', а не '/gruziya/'. */
function join_path(string $prefix, string $local): string
{
    return $prefix === '' ? $local : ($local === '/' ? $prefix : $prefix . $local);
}

/**
 * Полный адрес страницы ленты (раздел 4.5): у таба со своим адресом — на адресе таба без префикса,
 * иначе на общем адресе (текущем, если он общий). $local — адрес внутри ленты, $section — таб или null.
 */
function canonical_url(string $local, ?int $section, ?string $lang = null): string
{
    $own = null;
    $common = null;
    foreach (domains() as $d) {
        if ($section !== null && $own === null && $d['section_id'] === $section) {
            $own = $d['host'];
        }
        if ($common === null && $d['section_id'] === null) {
            $common = $d['host'];
        }
    }
    if ($own !== null) {
        return abs_url(url($local, $lang), $own);
    }
    $cur = current_domain();
    $host = ($cur === null || $cur['section_id'] === null) ? null : $common;
    $tab = $section !== null ? (sections()[$section] ?? null) : null;
    return abs_url(url(join_path($tab ? '/' . $tab['slug'] : '', $local), $lang), $host);
}

/** Разметка JSON-LD страницы: главная — WebSite, уровень 2 — BreadcrumbList, поп-ап — место или статья. */
function page_jsonld(array $page): ?array
{
    $kind = $page['jsonld'] ?? null;
    if ($kind === 'website') {
        return ['@context' => 'https://schema.org', '@type' => 'WebSite', 'name' => site_title(),
                'url' => canonical_url('/', $page['section'] ?? null), 'inLanguage' => current_lang()];
    }
    if ($kind === 'breadcrumbs') {
        $t = $page['tile'];
        $items = [[site_title(), canonical_url('/', null)]];
        if (!empty($page['tab'])) {
            $items[] = [$page['tab']['title'], canonical_url('/', $page['tab']['id'])];
        }
        $items[] = [$t['title'], canonical_url('/' . $t['slug'], $t['section_id'])];
        $list = [];
        foreach ($items as $i => [$name, $url]) {
            $list[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => $url];
        }
        return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $list];
    }
    if ($kind === 'popup') {
        $t = $page['popup'];
        $url = canonical_url($page['local'], $page['section']);
        $img = $t['photo'] ? abs_url('/uploads/' . photo_paths($t['photo'])['l']) : null;
        $desc = $t['body'] ? mb_substr(preg_replace('/\s+/u', ' ', $t['body']), 0, 300) : null;
        if (has_coords($t)) {
            return array_filter(['@context' => 'https://schema.org', '@type' => 'TouristAttraction', 'name' => $t['title'],
                'description' => $desc, 'url' => $url, 'image' => $img,
                'geo' => ['@type' => 'GeoCoordinates', 'latitude' => (float) $t['lat'], 'longitude' => (float) $t['lng']]]);
        }
        return array_filter(['@context' => 'https://schema.org', '@type' => 'Article', 'headline' => $t['title'],
            'description' => $desc, 'url' => $url, 'image' => $img, 'inLanguage' => current_lang()]);
    }
    return null;
}

/** Картинка для соцсетей: фото страницы или поп-апа (1600), иначе «Картинка для соцсетей» из настроек. */
function og_image(?array $photo): ?string
{
    if ($photo) {
        return abs_url('/uploads/' . photo_paths($photo)['l']);
    }
    $og = setting('og_image_path');
    return $og ? abs_url('/uploads/' . $og) : null;
}

function robots_txt(): void
{
    header('Content-Type: text/plain; charset=utf-8');
    echo "User-agent: *\nDisallow: /admin\n\nSitemap: ", abs_url('/sitemap.xml'), "\n";
}

/**
 * sitemap.xml текущего адреса (разделы 4.5, 9.2): главная, табы, видимые страницы и поп-апы, документы —
 * на всех включённых языках, где есть перевод. На адресе таба — только его страницы.
 */
function sitemap_xml(): void
{
    $urls = [];
    $last = db()->query('SELECT MAX(updated_at) FROM elements')->fetchColumn() ?: date('Y-m-d');
    $lastmod = substr((string) $last, 0, 10);
    $saved = current_lang();
    foreach (site_languages() as $l) {
        current_lang($l['code']);
        $add = function (string $local, ?int $section) use (&$urls, $l, $lastmod) {
            $urls[] = [canonical_url($local, $section, $l['code']), $lastmod];
        };
        $feed = function (array $blocks, ?int $section) use ($add) {
            foreach (tiles_in($blocks) as $t) {
                $opens = tile_opens($t);
                if ($opens) {
                    $add('/' . $t['slug'], $section);
                }
                if ($opens === 'page') {
                    foreach (tiles_in(visible_children($t)) as $t2) {
                        if (tile_opens($t2) === 'popup') {
                            $add('/' . $t['slug'] . '/' . $t2['slug'], $section);
                        }
                    }
                }
            }
        };
        if ($single = single_tab()) {
            if (tab_visible($single)) {
                $add('/', $single['id']);
                $feed(root_blocks($single['id']), $single['id']);
            }
        } else {
            $add('/', null);
            $feed(root_blocks(0), null);
            $own = array_filter(array_column(domains(), 'section_id'), fn($s) => $s !== null);
            foreach (visible_tabs() as $tab) {
                if (!in_array($tab['id'], $own, true)) {
                    $add('/', $tab['id']);
                    $feed(root_blocks($tab['id']), $tab['id']);
                }
            }
        }
        foreach (array_keys(visible_docs()) as $k) {
            $add('/doc/' . $k, null);
        }
    }
    current_lang($saved);
    header('Content-Type: application/xml; charset=utf-8');
    echo '<?xml version="1.0" encoding="UTF-8"?>', "\n", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', "\n";
    foreach (array_unique(array_column($urls, 0)) as $i => $u) {
        echo '  <url><loc>', e($u), '</loc><lastmod>', $urls[$i][1], "</lastmod></url>\n";
    }
    echo "</urlset>\n";
}
