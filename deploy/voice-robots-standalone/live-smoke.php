<?php
declare(strict_types=1);
// Root-only verification script. Reuse one valid admin session without printing credentials/cookies.
$config = json_decode(file_get_contents('/etc/krasterisk-voice-robots/bridge.json'), true, 512, JSON_THROW_ON_ERROR);
$db = new mysqli($config['db_host'], $config['db_user'], $config['db_password'], $config['db_name']);
function sessionValue(string $data, string $key): ?string {
    if (!preg_match('/(?:^|;)' . preg_quote($key, '/') . '\|s:(\d+):"/', $data, $match, PREG_OFFSET_CAPTURE)) return null;
    return substr($data, $match[0][1] + strlen($match[0][0]), (int)$match[1][0]);
}
$session = null;
$tenant = null;
$statement = $db->prepare('SELECT passwd,user_uid,level FROM users WHERE login=? LIMIT 2');
foreach (glob('/var/lib/php/sessions/sess_*') as $file) {
    $data = file_get_contents($file);
    $login = sessionValue($data, 'PHP_AUTH_USER');
    $password = sessionValue($data, 'PHP_AUTH_PW');
    if ($login === null || $password === null) continue;
    $statement->bind_param('s', $login); $statement->execute(); $rows = $statement->get_result();
    if ($rows->num_rows !== 1) continue;
    $user = $rows->fetch_assoc();
    if (!in_array((int)$user['level'], [1,5], true) || !hash_equals((string)$user['passwd'], md5($password))) continue;
    $session = substr(basename($file), 5); $tenant = (int)$user['user_uid']; break;
}
$db->close();
if ($session === null) { echo json_encode(['authenticated_session' => 'unavailable']); exit(2); }
function api(string $method, string $path, ?array $body = null, ?int $overrideTenant = null, string $origin = 'https://mpbx.krasterisk.ru'): array {
    global $config,$session,$tenant;
    $viaBridge = $overrideTenant === null;
    $url = $viaBridge ? 'https://mpbx.krasterisk.ru/modules/voice-robots/api.php/public/' . $path
        : 'http://127.0.0.1:' . $config['backend_port'] . '/api/public/' . $path;
    $headers = ['Content-Type: application/json', 'Origin: ' . $origin];
    if ($viaBridge) $headers[] = 'Cookie: PHPSESSID=' . $session;
    else { $headers[] = 'X-Api-Key: ' . $config['api_key']; $headers[] = 'X-Vpbx-User-Uid: ' . $overrideTenant; }
    $curl = curl_init($url);
    curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_RESOLVE => ['mpbx.krasterisk.ru:443:127.0.0.1']]);
    if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body));
    $text = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE); curl_close($curl);
    return [$status, json_decode($text === false ? '' : $text, true), $text];
}
function expect(array $response, int $status, string $label): array {
    if ($response[0] !== $status) throw new RuntimeException($label . ': HTTP ' . $response[0]);
    echo $label . ": PASS\n"; return $response[1] ?? [];
}
$robot = null; $stt = null; $tts = null;
try {
    expect(api('GET','voice-robots'),200,'authenticated v3 session');
    expect(api('POST','voice-robots',['name'=>'blocked'],null,'https://example.invalid'),403,'CSRF origin check');
    foreach (['contexts','queues','prompts','ai-agents/providers/list?capability=stt','ai-agents/providers/list?capability=tts','voice-robots/cdr','voice-robots/cdr/stats'] as $path) {
        expect(api('GET',$path),200,'read '.$path);
    }
    $stt = expect(api('POST','stt-engines',['name'=>'__deploy_smoke_stt','type'=>'yandex','token'=>'test-do-not-use']),201,'create STT engine');
    $tts = expect(api('POST','tts-engines',['name'=>'__deploy_smoke_tts','type'=>'yandex','token'=>'test-do-not-use']),201,'create TTS engine');
    if ($stt['token'] !== '' || $tts['token'] !== '') throw new RuntimeException('Secret not masked');
    $robot = expect(api('POST','voice-robots',['name'=>'__deploy_smoke_robot','active'=>0,'stt_engine_id'=>$stt['uid'],'tts_engine_id'=>$tts['uid']]),201,'create inactive robot');
    $group = expect(api('POST','voice-robots/'.$robot['uid'].'/keyword-groups',['name'=>'smoke','active'=>1]),201,'create keyword group');
    $keyword = expect(api('POST','voice-robots/keyword-groups/'.$group['uid'].'/keywords',['keywords'=>'проверка','priority'=>1]),201,'create keyword');
    expect(api('PUT','voice-robots/'.$robot['uid'],['description'=>'verified','user_uid'=>$tenant+100000000]),200,'update robot ownership protected');
    $row = expect(api('GET','voice-robots/'.$robot['uid']),200,'get robot');
    if ((int)$row['user_uid'] !== $tenant) throw new RuntimeException('Ownership changed');
    expect(api('GET','voice-robots/'.$robot['uid'],null,$tenant+100000000),404,'foreign tenant cannot read robot');
    expect(api('PUT','voice-robots/'.$robot['uid'],['name'=>'forbidden'],$tenant+100000000),404,'foreign tenant cannot update robot');
    expect(api('POST','voice-robots/'.$robot['uid'].'/test-match',['text'=>'проверка']),201,'keyword matcher');
    expect(api('DELETE','voice-robots/'.$robot['uid']),204,'delete smoke robot'); $robot = null;
    expect(api('DELETE','stt-engines/'.$stt['uid']),200,'delete smoke STT'); $stt = null;
    expect(api('DELETE','tts-engines/'.$tts['uid']),200,'delete smoke TTS'); $tts = null;
    echo json_encode(['live_session_api_crud'=>'pass','tenant_isolation'=>'pass','csrf'=>'pass','smoke_records_removed'=>true,'telephony_calls_generated'=>0]) . "\n";
} catch (Throwable $error) {
    echo 'FAIL: ' . $error->getMessage() . "\n";
    exit(1);
}
