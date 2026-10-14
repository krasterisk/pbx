<?php
// Include only after the existing index.php/conf.php session validation.
// No credentials, DB connection or PHP session content is exposed to JavaScript.
if (!isset($level, $vpbx_user_uid) || !in_array((int)$level, [1, 5], true)
    || !isset($_SESSION['PHP_AUTH_USER'])) {
    echo '<div class="container"><div class="alert alert-danger" role="alert">Войдите администратором в действующий интерфейс АТС.</div></div>';
    return;
}
$voiceRobotsHostContext = [
    'module' => 'voice-robots', 'tenantUid' => (int)$vpbx_user_uid,
    'tenantName' => (string)($vpbx_user_name ?? ''), 'userName' => (string)($user ?? ''),
    'roleLevel' => (int)$level, 'locale' => 'ru',
];
?>
<section id="vpbx-voice-robots-module" class="container" aria-label="Голосовые роботы">
  <p class="text-muted" style="margin:0 0 12px">Голосовые роботы · Кабинет:
    <?php echo htmlspecialchars($voiceRobotsHostContext['tenantName'] ?: (string)$voiceRobotsHostContext['tenantUid'], ENT_QUOTES, 'UTF-8'); ?>
    · <?php echo htmlspecialchars($voiceRobotsHostContext['userName'], ENT_QUOTES, 'UTF-8'); ?>
  </p>
  <ul class="nav nav-tabs" id="vpbx-voice-robots-tabs" style="margin-bottom:12px;display:flex;flex-wrap:wrap">
    <li><a href="#/voice-robots" data-voice-route="/voice-robots">Роботы</a></li>
    <li><a href="#/voice-robots/cdr" data-voice-route="/voice-robots/cdr">Журнал звонков</a></li>
    <li><a href="#/settings/stt-engines" data-voice-route="/settings/stt-engines">Распознавание речи (STT)</a></li>
    <li><a href="#/settings/tts-engines" data-voice-route="/settings/tts-engines">Синтез речи (TTS)</a></li>
    <li><a href="#/mcp-access" data-voice-route="/mcp-access">Ключи MCP</a></li>
  </ul>
  <style>#vpbx-voice-robots-frame.vpbx-dialog-mode{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;z-index:1060!important}</style>
  <div id="vpbx-voice-robots-placeholder" hidden aria-hidden="true"></div>
  <iframe id="vpbx-voice-robots-frame" title="Голосовые роботы — содержимое модуля"
          src="about:blank"
          style="display:block;width:100%;height:760px;border:0;background:#fff" referrerpolicy="same-origin"></iframe>
  <script type="application/json" id="vpbx-voice-robots-context"><?php echo json_encode($voiceRobotsHostContext, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?></script>
  <script src="/modules/voice-robots/integration-host.js?v=<?php echo substr(hash_file('sha256', __DIR__ . '/integration-host.js'), 0, 12); ?>" defer></script>
</section>
