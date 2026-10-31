<?php
// Принимает форму «Написать нам» и отправляет письмо на почту компании.
const RECIPIENT = 'vostokdsm@inbox.ru';

header('Content-Type: application/json; charset=utf-8');

function respond(int $code, bool $ok, string $error = ''): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'method not allowed');
}

// Скрытое поле заполняют только боты: делаем вид, что письмо ушло
if (!empty($_POST['website'])) {
    respond(200, true);
}

function field(string $name): string {
    return trim((string)($_POST[$name] ?? ''));
}

$name = str_replace(["\r", "\n"], ' ', field('name'));
$email = field('email');
$phone = str_replace(["\r", "\n"], ' ', field('phone'));
$message = field('message');

if ($name === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || empty($_POST['consent'])) {
    respond(422, false, 'invalid form');
}

$host = preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['SERVER_NAME'] ?? 'localhost');
$subject = '=?UTF-8?B?' . base64_encode('Сообщение с сайта Фускум-Торф') . '?=';
$body = "Имя: {$name}\nПочта: {$email}\nТелефон: {$phone}\n\n{$message}\n";
$headers = implode("\r\n", [
    "From: noreply@{$host}",
    "Reply-To: {$email}",
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
]);

if (!mail(RECIPIENT, $subject, chunk_split(base64_encode($body)), $headers)) {
    respond(500, false, 'mail failed');
}
respond(200, true);
