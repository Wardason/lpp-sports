<?php
// Kurzer Selbsttest für den Hoster: /api/test.php im Browser aufrufen.
// Nach erfolgreichem Test diese Datei bitte wieder löschen.
header('Content-Type: text/plain; charset=utf-8');

echo "PHP-Version: " . PHP_VERSION . (version_compare(PHP_VERSION, '8.0', '>=') ? "  OK\n" : "  ZU ALT\n");
echo "cURL vorhanden: " . (function_exists('curl_init') ? "ja  OK\n" : "nein  PROBLEM\n");
echo "Maximale Laufzeit: " . ini_get('max_execution_time') . " Sekunden"
   . ((int)ini_get('max_execution_time') === 0 || (int)ini_get('max_execution_time') >= 120 ? "  OK\n" : "  ZU KURZ\n");

// Erreicht der Server die KI-Anbieter? (manche Tarife blocken ausgehende Verbindungen)
foreach (['api.openai.com', 'api.anthropic.com'] as $host) {
    $ch = curl_init("https://$host/");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_NOBODY => true]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $fehler = curl_error($ch);
    curl_close($ch);
    echo "Verbindung zu $host: " . ($code > 0 ? "erreichbar (HTTP $code)  OK" : "blockiert – $fehler  PROBLEM") . "\n";
}

$config = @include __DIR__ . '/ki-config.php';
echo "ki-config.php: " . (is_array($config) ? "gefunden, Anbieter: " . ($config['anbieter'] ?? '?') . ", Schlüssel hinterlegt: " . (!empty($config['schluessel']) && $config['schluessel'] !== 'HIER-DEIN-SCHLUESSEL' ? "ja" : "NEIN") : "fehlt noch") . "\n";
echo "\nStehen überall OK und ein Schlüssel ist hinterlegt, funktioniert der KI-Plan.\n";
