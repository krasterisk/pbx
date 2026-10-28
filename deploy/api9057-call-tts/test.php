<?php
// CLI-only mock tests. No real AMI, Bitrix or phone calls.
if (PHP_SAPI !== 'cli') exit(1);
define('__CALL_TTS_BITRIX_URL_LITERAL__', $argv[1]);
require __DIR__.'/helpers.php';
class CallTtsResult extends Exception { public $payload; function __construct($payload) { $this->payload=$payload; } }
function error($code, $message) { throw new CallTtsResult(array('error'=>(int)$code,'message'=>$message)); }
function answer($payload) { throw new CallTtsResult($payload); }
function asterisk_req($params, $quick) { $GLOBALS['ami_calls'][]=$params; return array(array('response'=>$GLOBALS['ami_success']?'Success':'Error','message'=>'mock only')); }
function check($condition, $message) { if (!$condition) throw new Exception($message); $GLOBALS['checks']++; }
function run_branch($request) {
    $user_uid=2; $action='call_tts';
    try { eval('if (false) {'.file_get_contents(__DIR__.'/branch.txt')."\n}"); }
    catch (CallTtsResult $result) { return $result->payload; }
    throw new Exception('Branch did not return');
}
$checks=0; $ami_calls=array(); $ami_success=true;
$valid=array('lead_id'=>'12345','tts'=>'Иван, скажите "да".','phone'=>'+7 (999) 000-00-01');
foreach (array('lead_id','tts','phone') as $field) {
    foreach (array(null,'','   ',array('bad')) as $bad) {
        $r=$valid; $r[$field]=$bad;
        check(run_branch($r)['error']===400, 'Mandatory validation '.$field);
    }
}
check(count($ami_calls)===0,'Invalid requests never originate');
$r=run_branch($valid);
check($r['status']==='ok' && $r['bitrix_call_id']==='mock-b24-call','Success response');
$params=end($ami_calls);
check($params['channel']==='SIP/beeline_expert/79990000001','Default trunk and normalized phone');
check($params['Callerid']==='+79639584261' && $params['Context']==='tts_dial','Source caller ID and context');
check($params['Timeout']==='45000' && $params['Async']==='Yes','AMI milliseconds timeout');
check(strpos($params['Variable'],'__inner_id')===false && strpos($params['Variable'],'__INNER="8888"')!==false,'Default inner');
check(strpos($params['Variable'],'__ivr_id="7"')!==false,'Default IVR7');
check(strpos($params['Variable'],'__tts="Иван, скажите \\"да\\"."')!==false,'Comma/quote TTS kept in quoted AMI value');
check(strpos($params['Variable'],"\r")===false && strpos($params['Variable'],"\n")===false,'No injected AMI headers');
$r=array_merge($valid,array('inner_id'=>'1234','ivr_id'=>'8','callerid'=>'+79991112233','channel'=>'PJSIP/{phone}@test',
    'answer_hook'=>'https://crm.example.test/answer?id=12345&x=a,b','hangup_hook'=>'https://crm.example.test/end','usercallid'=>'attempt-123'));
check(run_branch($r)['status']==='ok','Explicit overrides');
$params=end($ami_calls);
check($params['channel']==='PJSIP/79990000001@test' && $params['Callerid']==='+79991112233','Channel override');
foreach (array('__ivr_id="8"','__INNER="1234"','__ANSWER_WEBHOOK="https://crm.example.test/answer?id=12345&x=a,b"','__HANGUP_WEBHOOK="https://crm.example.test/end"','__USERCALLID="attempt-123"') as $fragment) {
    check(strpos($params['Variable'],$fragment)!==false,'Metadata override '.$fragment);
}
$p=api9057_call_tts_normalize(array_merge($valid,array('channel'=>'SIP/test_trunk')));
check($p['channel']==='SIP/test_trunk/79990000001','Prefix appends phone');
$p=api9057_call_tts_normalize(array_merge($valid,array('inner_id'=>'','ivr_id'=>'')));
check($p['inner_id']==='8888' && $p['ivr_id']==='7','Empty defaults');
$before=count($ami_calls);
foreach (array('lead_id'=>'-1','phone'=>'123abc','ivr_id'=>'7,start,1','inner_id'=>'abc','channel'=>'bad channel',
    'answer_hook'=>'file:///etc/passwd','hangup_hook'=>'ftp://example.test/file','callerid'=>"123\r\nAction: Originate",'tts'=>"hello\nAction: Originate") as $field=>$bad) {
    check(run_branch(array_merge($valid,array($field=>$bad)))['error']===400,'Reject unsafe '.$field);
}
check(count($ami_calls)===$before,'Unsafe requests never originate');
check(run_branch(array_merge($valid,array('phone'=>'79990000000')))['error']===502,'Registration failure blocks originate');
check(count($ami_calls)===$before,'No AMI after registration failure');
$ami_success=false;
check(run_branch($valid)['status']==='error','AMI failure returned');
echo json_encode(array('checks'=>$checks,'mock_ami_calls'=>count($ami_calls),'real_calls'=>0,'real_bitrix_requests'=>0))."\n";
