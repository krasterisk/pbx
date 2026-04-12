const AsteriskManager = require('asterisk-manager');

const ami = new AsteriskManager(5038, 'ipbx.krasterisk.ru', 'krasterisk', 'gfhjkm', true);

ami.on('connect', () => {
  console.log('✅ AMI Connected\n');

  // 1. Check sorcery config for registrations
  ami.action({ action: 'Command', command: 'sorcery memory cache show' }, (err, res) => {
    console.log('--- Sorcery Cache ---');
    console.log(res?.output || res?.content || 'no output');
    console.log('');
  });

  // 2. Try to show outbound registrations
  ami.action({ action: 'PJSIPShowRegistrationsOutbound' }, (err, res) => {
    console.log('--- PJSIPShowRegistrationsOutbound ---');
    if (err) console.log('ERROR:', err);
    else {
      console.log('Response:', res?.response, '| Message:', res?.message);
      if (res?.events) {
        res.events.forEach(e => {
          if (e.event !== 'OutboundRegistrationDetailComplete') {
            console.log(`  ${e.objectname}: status=${e.status}`);
          }
        });
      }
    }
    console.log('');
  });

  // 3. Try moduleReload
  ami.action({ action: 'ModuleLoad', module: 'res_pjsip_outbound_registration.so', loadtype: 'reload' }, (err, res) => {
    console.log('--- ModuleLoad reload res_pjsip_outbound_registration.so ---');
    if (err) console.log('ERROR:', err);
    else console.log('Response:', res?.response, '| Message:', res?.message);
    console.log('');
  });

  // 4. Try PJSIPRegister
  setTimeout(() => {
    ami.action({ action: 'PJSIPRegister', registration: 't_test_trunk_0' }, (err, res) => {
      console.log('--- PJSIPRegister t_test_trunk_0 ---');
      if (err) console.log('ERROR:', err);
      else console.log('Response:', res?.response, '| Message:', res?.message);
      console.log('');

      // 5. Check registrations again after register
      setTimeout(() => {
        ami.action({ action: 'PJSIPShowRegistrationsOutbound' }, (err, res) => {
          console.log('--- PJSIPShowRegistrationsOutbound (after register) ---');
          if (err) console.log('ERROR:', err);
          else {
            console.log('Response:', res?.response);
            if (res?.events) {
              res.events.forEach(e => {
                if (e.event !== 'OutboundRegistrationDetailComplete') {
                  console.log(`  ${e.objectname}: status=${e.status}, serveruri=${e.serveruri}`);
                }
              });
            }
            if (!res?.events || res.events.length <= 1) {
              console.log('  (no registrations found)');
            }
          }

          // 6. Check if res_pjsip_outbound_registration is loaded
          ami.action({ action: 'Command', command: 'module show like outbound_registration' }, (err, res) => {
            console.log('\n--- Module Status ---');
            console.log(res?.output || res?.content || 'no output');

            // 7. Check sorcery.conf for registration type
            ami.action({ action: 'Command', command: 'pjsip show registrations' }, (err, res) => {
              console.log('\n--- pjsip show registrations ---');
              console.log(res?.output || res?.content || 'no output');

              ami.disconnect();
              process.exit(0);
            });
          });
        });
      }, 2000);
    });
  }, 1000);
});

ami.on('error', (err) => {
  console.error('AMI Error:', err.message);
});

ami.keepConnected();
