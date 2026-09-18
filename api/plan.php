<?php
// LPP Sports – KI-Plan für klassisches Webhosting (PHP)
// Datei hochladen nach:  /api/plan.php
// Der Schlüssel steht in der Datei daneben: ki-config.php (siehe ANLEITUNG-KI.md)

declare(strict_types=1);

$config = @include __DIR__ . '/ki-config.php';
if (!is_array($config)) {
    fehler('Konfiguration fehlt (ki-config.php)', 500);
}

$anbieter = strtolower($config['anbieter'] ?? 'openai');
$schluessel = $config['schluessel'] ?? '';
$modell = $config['modell'] ?? ($anbieter === 'anthropic' ? 'claude-sonnet-5' : 'gpt-5.6-terra');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fehler('Nur POST erlaubt', 405);
if ($schluessel === '') fehler('API-Schlüssel fehlt', 500);

$eingabe = json_decode(file_get_contents('php://input') ?: '', true);
$prompt = is_array($eingabe) ? ($eingabe['prompt'] ?? '') : '';
if (!is_string($prompt) || strlen($prompt) < 50 || strlen($prompt) > 8000) {
    fehler('Ungültige Anfrage', 400);
}

// TODO vor dem Livegang: hier prüfen, ob der Kunde bezahlt hat.

if ($anbieter === 'anthropic') {
    $url = 'https://api.anthropic.com/v1/messages';
    $header = ['content-type: application/json', 'x-api-key: ' . $schluessel, 'anthropic-version: 2023-06-01'];
    $body = ['model' => $modell, 'stream' => true, 'max_tokens' => 4000,
             'messages' => [['role' => 'user', 'content' => $prompt]]];
} else {
    $url = 'https://api.openai.com/v1/chat/completions';
    $header = ['content-type: application/json', 'authorization: Bearer ' . $schluessel];
    $body = ['model' => $modell, 'stream' => true,
             'messages' => [['role' => 'user', 'content' => $prompt]]];
}

// Ausgabe sofort durchreichen, nichts zwischenspeichern
while (ob_get_level() > 0) ob_end_clean();
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
header('X-Accel-Buffering: no');

$rest = '';
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $header,
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 180,
    CURLOPT_WRITEFUNCTION => function ($ch, $daten) use (&$rest, $anbieter) {
        $rest .= $daten;
        $zeilen = explode("\n", $rest);
        $rest = array_pop($zeilen);
        foreach ($zeilen as $zeile) {
            $z = trim($zeile);
            if (strpos($z, 'data:') !== 0) continue;
            $nutzlast = trim(substr($z, 5));
            if ($nutzlast === '' || $nutzlast === '[DONE]') continue;
            $json = json_decode($nutzlast, true);
            if (!is_array($json)) continue;
            $stueck = $anbieter === 'anthropic'
                ? (($json['type'] ?? '') === 'content_block_delta' ? ($json['delta']['text'] ?? '') : '')
                : ($json['choices'][0]['delta']['content'] ?? '');
            if ($stueck !== '') { echo $stueck; flush(); }
        }
        return strlen($daten);
    },
]);
$ok = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($ok === false || $status >= 400) {
    error_log('KI-Fehler Status ' . $status);
    // Der Header ist schon raus, deshalb nur ein Hinweis im Text
    echo "\n\n_Die KI-Anfrage ist fehlgeschlagen. Bitte später erneut versuchen._";
}

function fehler(string $text, int $status): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $text], JSON_UNESCAPED_UNICODE);
    exit;
}
