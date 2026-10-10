<?php
declare(strict_types=1);

/**
 * Почта (спецификация 2.1, раздел 10.10): письма отправляет хостинг (PHP mail())
 * или свой ящик по SMTP — небольшой клиент без библиотек. Письма — простой текст в UTF-8.
 * В v1 одно письмо — сброс пароля; плюс тестовое письмо из «Настройки → Почта».
 */

const MAIL_KEYS = ['mail_from', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass'];

/** Настройки почты из базы; $over — несохранённые значения из формы (тестовое письмо). */
function mail_config(array $over = []): array
{
    $c = [];
    foreach (MAIL_KEYS as $k) {
        $c[$k] = trim((string) (array_key_exists($k, $over) ? $over[$k] : setting($k, '')));
    }
    if ($c['mail_from'] === '') {
        $c['mail_from'] = mail_from_default();
    }
    return $c;
}

/** noreply@{домен сайта}; без домена (локально по IP) — noreply@localhost.localdomain. */
function mail_from_default(): string
{
    $host = preg_replace('~^www\.~', '', request_host());
    return 'noreply@' . ($host !== '' && !filter_var($host, FILTER_VALIDATE_IP) && str_contains($host, '.') ? $host : 'localhost.localdomain');
}

/** Отправить письмо. null — отправлено, иначе текст ошибки (для админа). */
function send_mail(string $to, string $subject, string $body, array $over = []): ?string
{
    $c = mail_config($over);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return 'bad recipient';
    }
    if (!filter_var($c['mail_from'], FILTER_VALIDATE_EMAIL)) {
        return 'bad sender: ' . $c['mail_from'];
    }
    $from = $c['mail_from'];
    $name = '=?UTF-8?B?' . base64_encode(site_title()) . '?=';
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $domain = substr(strrchr($from, '@'), 1);
    $headers = [
        'From: ' . $name . ' <' . $from . '>',
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    $text = chunk_split(base64_encode(str_replace("\n", "\r\n", str_replace("\r\n", "\n", $body))));

    // Проверки в CI и локально: письмо пишется в файл, а не уходит.
    if ($file = getenv('ENOTIS_MAIL_FILE')) {
        file_put_contents($file, "To: $to\nSubject: $subject\n\n$body\n----\n", FILE_APPEND);
        return null;
    }
    if ($c['smtp_host'] !== '') {
        $data = implode("\r\n", array_merge(['To: <' . $to . '>', 'Subject: ' . $subj], $headers)) . "\r\n\r\n" . $text;
        return smtp_send($c, $from, $to, $data);
    }
    if (!function_exists('mail')) {
        return 'mail() is disabled';
    }
    $ok = @mail($to, $subj, $text, implode("\r\n", $headers), '-f' . $from);
    return $ok ? null : (error_get_last()['message'] ?? 'mail() failed');
}

/** SMTP: SSL (465) или STARTTLS (587), вход AUTH LOGIN, если задан логин. */
function smtp_send(array $c, string $from, string $to, string $data): ?string
{
    $host = $c['smtp_host'];
    $secure = in_array($c['smtp_secure'], ['ssl', 'tls'], true) ? $c['smtp_secure'] : 'tls';
    $port = (int) $c['smtp_port'] ?: ($secure === 'ssl' ? 465 : 587);
    $ctx = stream_context_create(['ssl' => ['peer_name' => $host, 'verify_peer' => true, 'verify_peer_name' => true]]);
    $s = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 15,
                               STREAM_CLIENT_CONNECT, $ctx);
    if (!$s) {
        return "$host:$port — " . ($errstr ?: 'no connection');
    }
    stream_set_timeout($s, 20);
    $read = function () use ($s): string {
        $out = '';
        while (($line = fgets($s, 1024)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $out;
    };
    $cmd = function (?string $line, array $ok) use ($s, $read): string {
        if ($line !== null) {
            fwrite($s, $line . "\r\n");
        }
        $r = $read();
        if (!in_array((int) substr($r, 0, 3), $ok, true)) {
            throw new RuntimeException(trim($r) ?: 'no answer');
        }
        return $r;
    };
    try {
        $cmd(null, [220]);
        $ehlo = 'EHLO ' . (preg_replace('~[^A-Za-z0-9.-]~', '', (string) gethostname()) ?: 'localhost');
        $cmd($ehlo, [250]);
        if ($secure === 'tls') {
            $cmd('STARTTLS', [220]);
            if (!@stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('STARTTLS failed');
            }
            $cmd($ehlo, [250]);
        }
        if ($c['smtp_user'] !== '') {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode($c['smtp_user']), [334]);
            $cmd(base64_encode($c['smtp_pass']), [235]);
        }
        $cmd('MAIL FROM:<' . $from . '>', [250]);
        $cmd('RCPT TO:<' . $to . '>', [250, 251]);
        $cmd('DATA', [354]);
        $cmd(preg_replace('~^\.~m', '..', $data) . "\r\n.", [250]);
        try {
            $cmd('QUIT', [221]);
        } catch (RuntimeException) {
            // письмо уже принято
        }
        return null;
    } catch (RuntimeException $ex) {
        return $ex->getMessage();
    } finally {
        fclose($s);
    }
}
