<?php
declare(strict_types=1);
// Public MCP transport: dedicated tenant-scoped bearer only; never relay the PBX session or internal API key.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function mcp_fail(int $status, string $message): never {
    http_response_code($status); echo json_encode(['message' => $message]); exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); mcp_fail(405, 'POST required'); }
if (!empty($_SERVER['HTTP_ORIGIN']) && !hash_equals('https://' . ($_SERVER['HTTP_HOST'] ?? ''), $_SERVER['HTTP_ORIGIN'])) mcp_fail(403, 'Origin denied');
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) mcp_fail(415, 'JSON required');
$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
// Apache mod_php does not always populate HTTP_AUTHORIZATION; request headers remain available.
if ($authorization === '' && function_exists('getallheaders')) foreach (getallheaders() as $key => $value) if (strcasecmp($key, 'Authorization') === 0) $authorization = $value;
if (!preg_match('/^Bearer krvr_[A-Za-z0-9_-]{43}$/D', $authorization)) { header('WWW-Authenticate: Bearer'); mcp_fail(401, 'MCP bearer credential required'); }
$body = file_get_contents('php://input');
if (strlen($body) > 4 * 1024 * 1024) mcp_fail(413, 'Request too large');
$config = json_decode((string)file_get_contents(getenv('VOICE_ROBOTS_BRIDGE_CONFIG') ?: '/etc/krasterisk-voice-robots/bridge.json'), true, 512, JSON_THROW_ON_ERROR);
$headers = ['Content-Type: application/json', 'Accept: application/json, text/event-stream', 'Authorization: ' . $authorization];
$version = $_SERVER['HTTP_MCP_PROTOCOL_VERSION'] ?? '';
if ($version !== '') { if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $version)) mcp_fail(400, 'Invalid protocol version'); $headers[] = 'MCP-Protocol-Version: ' . $version; }
$curl = curl_init('http://127.0.0.1:' . (int)$config['backend_port'] . '/api/voice-robots-mcp');
curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 30]);
$response = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE); curl_close($curl);
if ($response === false || $status === 0) mcp_fail(502, 'Voice robots MCP unavailable');
http_response_code($status); if ($status !== 202) echo $response;
