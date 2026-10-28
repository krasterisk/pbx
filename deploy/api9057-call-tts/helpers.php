<?php
// Included as functions in the existing API. No network activity on declaration.
function api9057_call_tts_value(array $request, string $key, string $default = ''): string {
    if (!isset($request[$key])) return $default;
    if (!is_string($request[$key]) && !is_int($request[$key])) throw new InvalidArgumentException($key.' must be a string');
    $value = trim((string)$request[$key]);
    if (preg_match('/[\x00-\x1F\x7F]/', (string)$request[$key])) throw new InvalidArgumentException($key.' must not contain control characters');
    return $value === '' ? $default : $value;
}

function api9057_call_tts_normalize(array $request): array {
    $call = array();
    foreach (array('lead_id', 'tts', 'phone') as $key) {
        $call[$key] = api9057_call_tts_value($request, $key);
        if ($call[$key] === '') throw new InvalidArgumentException($key.' must be set');
    }
    if (!ctype_digit($call['lead_id']) || (int)$call['lead_id'] < 1) throw new InvalidArgumentException('lead_id must be a positive number');
    $call['phone'] = preg_replace('/[\s().-]+/', '', $call['phone']);
    $call['phone'] = preg_replace('/^\+/', '', $call['phone']);
    if (!preg_match('/^[0-9]{3,20}$/D', $call['phone'])) throw new InvalidArgumentException('phone must contain 3 to 20 digits');
    $call['inner_id'] = api9057_call_tts_value($request, 'inner_id', '8888');
    $call['ivr_id'] = api9057_call_tts_value($request, 'ivr_id', '7');
    foreach (array('inner_id', 'ivr_id') as $key) {
        if (!ctype_digit($call[$key]) || (int)$call[$key] < 1) throw new InvalidArgumentException($key.' must be a positive number');
    }
    $call['callerid'] = api9057_call_tts_value($request, 'callerid', '+79639584261');
    $channel = api9057_call_tts_value($request, 'channel', 'SIP/beeline_expert/{phone}');
    $channel = str_replace('{phone}', $call['phone'], $channel);
    // A trunk prefix is convenient too; full channels and Local extensions remain exact.
    if (preg_match('~^(?:SIP|PJSIP|IAX2)/[^/@{}]+$~iD', $channel)) $channel .= '/'.$call['phone'];
    if (!preg_match('~^[A-Za-z][A-Za-z0-9_]*/[^\s{}]+$~D', $channel)) throw new InvalidArgumentException('channel must be a valid Asterisk channel');
    $call['channel'] = $channel;
    foreach (array('answer_hook', 'hangup_hook') as $key) {
        $call[$key] = api9057_call_tts_value($request, $key);
        if ($call[$key] !== '' && (!filter_var($call[$key], FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($call[$key], PHP_URL_SCHEME)), array('http','https'), true))) {
            throw new InvalidArgumentException($key.' must be an HTTP(S) URL');
        }
    }
    $call['usercallid'] = api9057_call_tts_value($request, 'usercallid');
    return $call;
}

function api9057_call_tts_params(array $call, int $userUid, string $bitrixCallId): array {
    $values = array('__tts'=>$call['tts'], '__lead_id'=>$call['lead_id'], '__ivr_id'=>$call['ivr_id'],
        '__WH_BEFORE'=>$bitrixCallId, '__USER_UID'=>(string)$userUid, '__PHONE'=>$call['phone'], '__INNER'=>$call['inner_id'],
        '__ANSWER_WEBHOOK'=>$call['answer_hook'], '__HANGUP_WEBHOOK'=>$call['hangup_hook'], '__USERCALLID'=>$call['usercallid']);
    $variables = array();
    foreach ($values as $name=>$value) {
        // AMI parses a comma-separated list, honoring double quotes and backslash escaping.
        $variables[] = $name.'="'.addcslashes($value, "\\\"").'"';
    }
    return array('action'=>'Originate', 'channel'=>$call['channel'], 'Exten'=>'start', 'Callerid'=>$call['callerid'],
        'Context'=>'tts_dial', 'Priority'=>'1', 'Timeout'=>'45000', 'Variable'=>implode(',', $variables), 'Async'=>'Yes');
}

function api9057_call_tts_register(string $innerId, string $phone): string {
    // Filled on the server from the existing API2 configuration; never exported in the patch.
    $baseUrl = __CALL_TTS_BITRIX_URL_LITERAL__;
    $curl = curl_init($baseUrl.'telephony.externalcall.register.json');
    curl_setopt_array($curl, array(CURLOPT_POST=>true, CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>5,
        CURLOPT_TIMEOUT=>10, CURLOPT_POSTFIELDS=>http_build_query(array('USER_PHONE_INNER'=>$innerId,
            'PHONE_NUMBER'=>$phone, 'TYPE'=>1, 'CRM_CREATE'=>false, 'SHOW'=>false))));
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    $data = is_string($body) ? json_decode($body, true) : null;
    $callId = is_array($data) ? ($data['result']['CALL_ID'] ?? null) : null;
    if ($status < 200 || $status >= 300 || !is_string($callId) || $callId === '' || preg_match('/[\x00-\x1F\x7F]/', $callId)) {
        throw new RuntimeException('Bitrix registration failed');
    }
    return $callId;
}
