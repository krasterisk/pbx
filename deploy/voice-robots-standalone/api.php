<?php
declare(strict_types=1);
// Module-local gateway. Never include v3 conf.php: it runs login side effects.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function fail(int $status, string $message): never {
    http_response_code($status);
    echo json_encode(['message' => $message]);
    exit;
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) fail(405, 'Method not allowed');
if ($method !== 'GET') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $expected = 'https://' . ($_SERVER['HTTP_HOST'] ?? '');
    if (!hash_equals($expected, $origin)) fail(403, 'Same-origin request required');
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) fail(415, 'JSON required');
}
$path = $_SERVER['PATH_INFO'] ?? '';
if (!preg_match('~^/public/(voice-robots(?:/[A-Za-z0-9_-]+)*|voice-robots-mcp/credentials(?:/[A-Za-z0-9_-]+)?|(?:stt|tts)-engines(?:/[A-Za-z0-9_-]+)*|ai-agents/providers/list|contexts|queues|prompts)$~D', $path)) fail(404, 'Unknown module endpoint');
session_start();
$login = $_SESSION['PHP_AUTH_USER'] ?? null;
$password = $_SESSION['PHP_AUTH_PW'] ?? null;
session_write_close();
if (!is_string($login) || !is_string($password) || $login === '') fail(401, 'Sign in to the existing PBX interface');
$configPath = getenv('VOICE_ROBOTS_BRIDGE_CONFIG') ?: '/etc/krasterisk-voice-robots/bridge.json';
$config = json_decode((string)file_get_contents($configPath), true, 512, JSON_THROW_ON_ERROR);
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
try {
    $db = new mysqli($config['db_host'], $config['db_user'], $config['db_password'], $config['db_name']);
    $db->set_charset('utf8mb4');
    $statement = $db->prepare('SELECT passwd,user_uid,level FROM users WHERE login=? LIMIT 2');
    $statement->bind_param('s', $login);
    $statement->execute();
    $result = $statement->get_result();
    if ($result->num_rows !== 1) fail(401, 'Invalid session');
    $user = $result->fetch_assoc();
    if (!hash_equals((string)$user['passwd'], md5($password))) fail(401, 'Invalid session');
    if (!in_array((int)$user['level'], [1, 5], true)) fail(403, 'Administrator access required');
    $tenant = (string)$user['user_uid'];
    if (!preg_match('/^(0|[1-9][0-9]*)$/D', $tenant)) fail(403, 'Invalid tenant');
    $db->close();
} catch (Throwable $error) {
    error_log('Voice robots session validation unavailable');
    fail(503, 'Session validation unavailable');
}
$body = file_get_contents('php://input');
if (strlen($body) > 4 * 1024 * 1024) fail(413, 'Request too large');
$query = $_SERVER['QUERY_STRING'] ?? '';
$url = 'http://127.0.0.1:' . (int)$config['backend_port'] . '/api' . $path;
if ($query !== '') $url .= '?' . $query;
$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json',
        'X-Api-Key: ' . $config['api_key'], 'X-Vpbx-User-Uid: ' . $tenant],
]);
if ($method !== 'GET') curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
$response = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);
if ($response === false || $status === 0) fail(502, 'Voice robots backend unavailable');
http_response_code($status);
echo $response;
