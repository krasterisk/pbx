<?php
// CLI-only safe fixture; never publish. No real conf/session/database is loaded.
if (PHP_SAPI !== 'cli') exit(1);
$level = 1; $vpbx_user_uid = 42; $vpbx_user_name = 'Тестовый кабинет';
$user = ($argv[2] ?? '') === 'clean' ? 'Тестовый администратор' : 'Администратор </script><script>window.fixtureInjection=true</script>';
$_SESSION = ['PHP_AUTH_USER' => 'fixture-only'];
echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
echo '<style>body{margin:0;font:14px Arial;background:#fff}.container{max-width:1140px;margin:auto;padding:0 15px;box-sizing:border-box}.navbar{background:#f8f8f8;padding:18px;border-bottom:1px solid #ddd;margin-bottom:20px}.navbar a{margin-right:20px}.nav{list-style:none;padding:0}.nav li a{display:block;padding:12px;color:#337ab7;text-decoration:none}.nav-tabs{border-bottom:1px solid #ddd}.nav-tabs .active a{border:1px solid #ddd;border-bottom-color:white;color:#555}.text-muted{color:#777}@media(max-width:640px){.container{width:100%}}</style></head><body><nav class="navbar"><div class="container"><a href="/?module=peers">Абоненты</a><a href="/?module=trunks">Транки</a><a href="/?module=voice-robots">Роботы</a><span>Система</span></div></nav>';
include $argv[1];
echo '<footer class="container">© 2026 Крастериск, ООО</footer></body></html>';
