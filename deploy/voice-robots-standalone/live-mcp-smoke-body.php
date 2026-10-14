<?php
// Append to the common session/HTTP helpers from live-smoke.php; root-only, never publish this file.
function rpc(string $token, string $method, array $params = [], ?string $origin = null): array {
    static $next = 0;
    $headers = ['Content-Type: application/json', 'Accept: application/json, text/event-stream', 'Authorization: Bearer '.$token, 'MCP-Protocol-Version: 2025-11-25'];
    if ($origin !== null) $headers[] = 'Origin: '.$origin;
    $curl = curl_init('https://mpbx.krasterisk.ru/modules/voice-robots/mcp.php');
    curl_setopt_array($curl, [CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode(['jsonrpc'=>'2.0','id'=>++$next,'method'=>$method,'params'=>$params ?: new stdClass()]),
        CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_RESOLVE=>['mpbx.krasterisk.ru:443:127.0.0.1']]);
    $body=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
    return [$status,json_decode($body===false?'':$body,true),$body];
}
function tool(string $token, string $name, array $args = [], bool $shouldFail = false): array {
    $response=rpc($token,'tools/call',['name'=>$name,'arguments'=>$args ?: new stdClass()]);
    if ($response[0]!==200 || isset($response[1]['error']) || !isset($response[1]['result'])) throw new RuntimeException($name.': transport/RPC failure');
    $result=$response[1]['result'];
    if ((bool)($result['isError']??false)!==$shouldFail) throw new RuntimeException($name.': unexpected tool status');
    echo $name.($shouldFail?' refused':'').": PASS\n";
    return $result['structuredContent']??json_decode($result['content'][0]['text']??'{}',true)??[];
}
$configure=null;$readonly=null;$robotId=null;$createdKeys=[];
try {
    expect(rpc('','tools/list'),401,'MCP unauthenticated denied');
    $configure=expect(api('POST','voice-robots-mcp/credentials',['name'=>'__mcp_r3_smoke_configure','scope'=>'configure','days'=>1]),201,'issue scoped configure credential');$createdKeys[]=$configure['id'];
    $readonly=expect(api('POST','voice-robots-mcp/credentials',['name'=>'__mcp_r3_smoke_read','scope'=>'read','days'=>1]),201,'issue scoped read credential');$createdKeys[]=$readonly['id'];
    expect(rpc($configure['token'],'tools/list',[],'https://example.invalid'),403,'MCP browser origin denied');
    $initialized=expect(rpc($configure['token'],'initialize',['protocolVersion'=>'2025-11-25','capabilities'=>new stdClass(),'clientInfo'=>['name'=>'private smoke','version'=>'1']]),200,'MCP initialize');
    if ($initialized['result']['protocolVersion']!=='2025-11-25') throw new RuntimeException('Protocol mismatch');
    $full=expect(rpc($configure['token'],'tools/list'),200,'configure tool discovery');
    $read=expect(rpc($readonly['token'],'tools/list'),200,'read tool discovery');
    if (count($full['result']['tools'])!==31 || count($read['result']['tools'])!==18) throw new RuntimeException('Catalog count mismatch');
    tool($readonly['token'],'create_voice_robot',['data'=>['name'=>'forbidden']],true);
    tool($configure['token'],'create_voice_robot',['data'=>['name'=>'spoof'],'user_uid'=>$tenant+100000000],true);
    foreach (['voice-robots','voice-robot-scenarios','voice-robot-testing'] as $skill) { $value=tool($configure['token'],'read_skill',['name'=>$skill]);if (!$value['content']) throw new RuntimeException('Empty skill'); }
    $resources=expect(rpc($configure['token'],'resources/read',['uri'=>'krasterisk://voice-robots/agents']),200,'public AGENTS MCP resource');
    if (strpos($resources['result']['contents'][0]['text'],'Импорт JSON')===false) throw new RuntimeException('Guide content missing');
    expect(rpc($configure['token'],'prompts/get',['name'=>'setup_voice_robot','arguments'=>['request'=>'Настрой тестового робота']]),200,'setup prompt');
    $file=json_decode(file_get_contents('/var/www/html/vpbx/modules/voice-robots/examples/directory.scenario.json'),true,512,JSON_THROW_ON_ERROR);
    $unsafe=$file;$unsafe['scenario']['groups'][0]['keywords'][0]['bot_action']['webhookAuth']=['mode'=>'custom','customHeaders'=>[['key'=>'X-Integration','value'=>'dummy-test-only']]];
    $secretRefusal=expect(rpc($readonly['token'],'tools/call',['name'=>'validate_voice_robot_scenario','arguments'=>['file'=>$unsafe]]),200,'secret header transport');
    if (!($secretRefusal['result']['isError']??false) || strpos($secretRefusal['result']['content'][0]['text']??'','SECRET_ARG_FORBIDDEN:')!==0) throw new RuntimeException('Secret header guard did not reject before validation');
    echo "custom auth header guard: PASS\n";
    $validation=tool($configure['token'],'validate_voice_robot_scenario',['file'=>$file]);if (!$validation['valid']) throw new RuntimeException('Public example invalid');
    $created=tool($configure['token'],'create_voice_robot',['data'=>['name'=>'__mcp_r3_smoke_robot','active'=>false,'language'=>'ru-RU','max_conversation_steps'=>10,'silence_timeout_seconds'=>15,'max_inactivity_repeats'=>3],'scenario'=>$file]);$robotId=$created['robotId'];
    if ($created['imported']['groups']!==2 || $created['imported']['keywords']!==2 || $created['imported']['dataLists']!==1) throw new RuntimeException('Import count mismatch');
    $configuration=tool($configure['token'],'get_voice_robot_configuration',['robotId'=>$robotId]);
    if ((int)$configuration['robot']['initial_group_id']!==(int)$created['imported']['groupIds']['group:1']) throw new RuntimeException('Group remapping failed');
    $match=tool($readonly['token'],'test_voice_robot_match',['robotId'=>$robotId,'text'=>'график']);if (($match['match']['keyword_text']??'')!=='расписание') throw new RuntimeException('Synonym match failed');
    $search=tool($readonly['token'],'test_voice_robot_data_list',['uid'=>$created['imported']['listIds']['list:1'],'query'=>'Красноярск','returnField'=>'answer']);
    if (strpos($search['result']['value']??'','Красноярске')===false) throw new RuntimeException('Directory result failed');
    $export=tool($configure['token'],'export_voice_robot_scenario',['robotId'=>$robotId]);$again=tool($configure['token'],'validate_voice_robot_scenario',['file'=>$export['file']]);if (!$again['valid']) throw new RuntimeException('Export roundtrip failed');
    $readiness=tool($configure['token'],'check_voice_robot_readiness',['robotId'=>$robotId]);if ($readiness['configurationReady']) throw new RuntimeException('Unconfigured robot incorrectly ready');
    tool($configure['token'],'update_voice_robot',['uid'=>$robotId,'data'=>['description'=>'MCP live CRUD verified']]);
    tool($configure['token'],'delete_voice_robot_keyword_group',['uid'=>$created['imported']['groupIds']['group:1']],true);
    $group=tool($configure['token'],'create_voice_robot_keyword_group',['robotId'=>$robotId,'data'=>['name'=>'Smoke extra','description'=>null,'priority'=>9,'active'=>false,'is_global'=>false]]);
    $keyword=tool($configure['token'],'create_voice_robot_keyword',['groupId'=>$group['uid'],'data'=>['keywords'=>'проверка','synonyms'=>[],'negative_keywords'=>[],'bot_action'=>['response'=>['type'=>'none'],'nextState'=>['type'=>'listen']],'max_repeats'=>0,'escalation_action'=>null,'priority'=>0,'comment'=>null,'tag'=>null]]);
    tool($configure['token'],'update_voice_robot_keyword',['uid'=>$keyword['uid'],'data'=>['comment'=>'verified']]);
    tool($configure['token'],'update_voice_robot_keyword_group',['uid'=>$group['uid'],'data'=>['active'=>true]]);
    tool($configure['token'],'delete_voice_robot_keyword',['uid'=>$keyword['uid']]);
    tool($configure['token'],'delete_voice_robot_keyword_group',['uid'=>$group['uid']]);
    tool($configure['token'],'delete_voice_robot',['uid'=>$robotId]);$robotId=null;
    echo json_encode(['mcp_live'=>'pass','public_tools'=>31,'read_tools'=>18,'skills'=>3,'tenant_spoof'=>'denied','read_write'=>'denied','transactional_remapping'=>'pass','text_match'=>'pass','data_list'=>'pass','real_calls_generated'=>0])."\n";
} finally {
    if ($robotId!==null && $configure!==null) tool($configure['token'],'delete_voice_robot',['uid'=>$robotId]);
    foreach ($createdKeys as $id) expect(api('DELETE','voice-robots-mcp/credentials/'.$id),200,'revoke temporary credential');
    if ($configure!==null) expect(rpc($configure['token'],'tools/list'),401,'revoked credential denied');
}
