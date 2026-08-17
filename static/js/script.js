document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');
  const input = document.getElementById('cmd-input');
  const promptText = document.getElementById('prompt-text');
  if (!output || !input) return;

  let cwd = '~';

  const fs = {
    '~': {
      type: 'dir',
      children: ['skills', 'hobbies', 'contact']
    },
    'skills': {
      type: 'dir',
      children: ['skills.txt']
    },
    'hobbies': {
      type: 'dir',
      children: ['hobbies.txt']
    },
    'contact': {
      type: 'dir',
      children: ['contact_info.txt']
    },
    'skills.txt': {
      type: 'file',
      content: [
        'Web proxy administration',
        'Email gateway security',
        'Python/Bash',
        'Process automation',
        'Project Management' 
        
      ]
    },
    'hobbies.txt': {
      type: 'file',
      content: [
        'Traveling',
        'Rock climbing',
        'Hiking & outdoors',
        'Learning new things'
      ]
    },
    'contact_info.txt': {
      type: 'file',
      content: [
        'Email: Chance@takeachance.info',
        'LinkedIn: https://www.linkedin.com/in/chancegammill/'
      ]
    }
  };

  function print(text, className = '') {
    const div = document.createElement('div');
    div.className = 'line ' + className;
    div.textContent = text;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }

  function printHTML(html) {
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = html;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }

  function updatePrompt() {
    promptText.textContent = `visitor@takeachance:${cwd}$`;
  }

  function getCompletions(partial) {
    const parts = partial.trim().split(/\s+/);
    const base = parts[0] || '';
    const arg = parts[1] || '';
    const commands = ['help', 'ls', 'cd', 'cat', 'clear', 'whoami'];

    if (parts.length <= 1) {
      return commands.filter(c => c.startsWith(base));
    }
    if (base === 'cd') {
      if (cwd === '~') {
        return ['skills', 'hobbies', 'contact', '..', '~'].filter(d => d.startsWith(arg));
      }
      return ['..', '~'].filter(d => d.startsWith(arg));
    }
    if (base === 'cat') {
      const dir = fs[cwd];
      if (dir && dir.type === 'dir') {
        return dir.children.filter(f => f.startsWith(arg));
      }
    }
    return [];
  }

  function handleTab() {
    const val = input.value;
    const completions = getCompletions(val);
    if (completions.length === 1) {
      const parts = val.trim().split(/\s+/);
      if (parts.length <= 1) {
        input.value = completions[0] + ' ';
      } else {
        parts[parts.length - 1] = completions[0];
        input.value = parts.join(' ') + (completions[0].endsWith('.txt') ? '' : ' ');
      }
    } else if (completions.length > 1) {
      printHTML(`<span class="prompt">${promptText.textContent}</span> <span class="cmd">${val}</span>`);
      print(completions.join('  '), 'info');
    }
  }

  function handleCommand(raw) {
    const line = raw.trim();
    if (!line) return;

    printHTML(`<span class="prompt">${promptText.textContent}</span> <span class="cmd">${raw}</span>`);

    // Support chaining with && and ;
    const chain = line.split(/\s*(?:&&|;)\s*/).filter(Boolean);
    for (const cmd of chain) {
      runOne(cmd);
    }
  }

  function parseArgs(cmd) {
    const tokens = cmd.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const flags = new Set();
    const positionals = [];
    for (const t of tokens.slice(1)) {
      if (t === '--') continue;
      if (t.startsWith('--')) {
        flags.add(t.slice(2));
      } else if (t.startsWith('-') && t.length > 1) {
        for (const ch of t.slice(1)) flags.add(ch);
      } else {
        positionals.push(t.replace(/^"|"$/g, ''));
      }
    }
    return { flags, positionals, base: (tokens[0] || '').toLowerCase() };
  }

  function invalidOption(cmdName, flag) {
    if (flag.length === 1) {
      print(`${cmdName}: invalid option -- '${flag}'`, 'error');
    } else {
      print(`${cmdName}: unrecognized option '--${flag}'`, 'error');
    }
    print(`Try '${cmdName} --help' for more information.`, 'muted');
  }

  function checkFlags(cmdName, flags, allowed) {
    for (const f of flags) {
      if (!allowed.has(f)) {
        invalidOption(cmdName, f);
        return false;
      }
    }
    return true;
  }

  function runOne(cmd) {
    const { base, flags, positionals } = parseArgs(cmd);
    if (!base) return;
    const arg = positionals[0] || '';

    if (base === 'help' || ((base === 'ls' || base === 'cd' || base === 'cat' || base === 'clear' || base === 'whoami') && (flags.has('h') || flags.has('help')))) {
      if (base === 'ls' || (base === 'help' && arg === 'ls')) {
        print('Usage: ls [OPTION]...', 'info');
        print('List directory contents.');
        print('  -a, --all      show all entries (including . and ..)');
        print('  -l             use long listing format');
        print('  -h, --help     display this help');
        return;
      }
      if (base === 'cd' || (base === 'help' && arg === 'cd')) {
        print('Usage: cd [DIR]', 'info');
        print('Change the current directory.');
        print('  -h, --help     display this help');
        return;
      }
      if (base === 'cat' || (base === 'help' && arg === 'cat')) {
        print('Usage: cat [OPTION]... FILE', 'info');
        print('Concatenate FILE to standard output.');
        print('  -n, --number   number all output lines');
        print('  -h, --help     display this help');
        return;
      }
      if (base !== 'help') return;
      print('Available commands:', 'info');
      print('  help              show this message');
      print('  ls [-a|-l]        list directory contents');
      print('  cd <dir>          change directory');
      print('  cat [-n] <file>   show file contents');
      print('  clear             clear the screen');
      print('  whoami            about me');
      print('');
      print('Tip: use Tab for autocomplete · chain with && or ;', 'muted');
      return;
    }

    if (base === 'ls') {
      if (!checkFlags('ls', flags, new Set(['a', 'all', 'l', 'h', 'help']))) return;
      const dir = fs[cwd];
      if (!dir || dir.type !== 'dir') return;
      let entries = [...dir.children];
      if (flags.has('a') || flags.has('all')) {
        entries = ['.', '..', ...entries];
      }
      if (flags.has('l')) {
        entries.forEach(name => {
          if (name === '.' || name === '..') {
            print(`drwxr-xr-x  1 visitor visitor  4.0K  .`);
            return;
          }
          const node = fs[name];
          if (node && node.type === 'dir') {
            print(`drwxr-xr-x  1 visitor visitor  4.0K  ${name}`);
          } else {
            print(`-rw-r--r--  1 visitor visitor  1.2K  ${name}`);
          }
        });
      } else {
        print(entries.join('  '), 'info');
      }
    }
    else if (base === 'cd') {
      if (!checkFlags('cd', flags, new Set(['h', 'help']))) return;
      if (!arg || arg === '~' || arg === '..' || arg === '/') {
        cwd = '~';
        updatePrompt();
      } else if (cwd === '~' && fs[arg] && fs[arg].type === 'dir') {
        cwd = arg;
        updatePrompt();
      } else if (arg === '..' || arg === '~') {
        cwd = '~';
        updatePrompt();
      } else {
        print(`cd: no such directory: ${arg}`, 'error');
      }
    }
    else if (base === 'cat') {
      if (!checkFlags('cat', flags, new Set(['n', 'number', 'h', 'help']))) return;
      if (!arg) {
        print('cat: missing file operand', 'error');
        print("Try 'cat --help' for more information.", 'muted');
        return;
      }
      const dir = fs[cwd];
      if (!dir || dir.type !== 'dir' || !dir.children.includes(arg)) {
        print(`cat: ${arg}: No such file or directory`, 'error');
        return;
      }
      const file = fs[arg];
      if (file && file.type === 'file') {
        const number = flags.has('n') || flags.has('number');
        if (arg === 'contact_info.txt') {
          const lines = [
            'Email: <span style="color:#79c0ff">Chance@takeachance.info</span>',
            'LinkedIn: <a href="https://www.linkedin.com/in/chancegammill/" target="_blank" style="color:#79c0ff">linkedin.com/in/chancegammill</a>'
          ];
          lines.forEach((line, i) => {
            if (number) printHTML(`     ${i + 1}  ${line}`);
            else printHTML(line);
          });
        } else {
          file.content.forEach((line, i) => {
            if (number) print(`     ${i + 1}  ${line}`);
            else print(line);
          });
        }
      }
    }
    else if (base === 'clear') {
      if (!checkFlags('clear', flags, new Set(['h', 'help']))) return;
      output.innerHTML = '';
    }
    else if (base === 'whoami') {
      if (!checkFlags('whoami', flags, new Set(['h', 'help']))) return;
      print('Chance Gammill', 'info');
      print('Digital front door · Type "ls" then "cd" and "cat" to explore');
    }
    else {
      print(`command not found: ${base}`, 'error');
      print('Type "help" for available commands.', 'muted');
    }
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      handleCommand(input.value);
      input.value = '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
    }
  });

  document.addEventListener('click', () => input.focus());

  // Friendly ASCII arts
  const arts = [
`           ,-.
          .:\` \`-.
          |:|  __ b
           \`;-(
          ,'  |
         ( \\|||_
  ,-----(.-''--\`\`-------.
 /_______\`'______________\\
/                          \\`,

`    ___
   //_\\\\_
 ."\\\\    ".
/          \\
|           \\_
|         ,--.-.)
 \\       /  o \\o\\
 /\\/\\   \\    /_/
  (_.   \`--'  __)
   |     .-'  \\
   |  .-'.     )
   | (  _/--.-'
   |  \`.___.'
         (`,

`           __..--''\`\`---....___   _..._    __
 /// //_.-'    .-/";  \`        \`\`<._  \`\`.''_ \`. / // /
///_.-' _..--.'_    \\                    \`( ) ) // //
/ (_..-' // (< _     ;_..__               ; \`' / ///
 / // // //  \`-._,_)' // / \`\`--...____..-' /// / //`,

`            .'\\   /\`.
         .'.-.\`-'.-.\`.
    ..._:   .-. .-.   :_...
  .'    '-.(o ) (o ).-'    \`.
 :  _    _ _\`~(_)~\`_ _    _  :
:  /:   ' .-=_   _=-. \`   ;\\  :
:   :|-.._  '     \`  _..-|:   :
 :   \`:| |\`:-:-.-:-:'| |:'   :
  \`.   \`.| | | | | | |.'   .'
    \`.   \`-:_| | |_:-'   .'
      \`-._   \`\`\`\`    _.-'
          \`\`-------''`,

` /^ ^\\
/ 0 0 \\
V\\ Y /V
 / - \\
 |    \\
 || (__V`,

`                             ___-------___
                         _-~~             ~~-_
                      _-~                    /~-_
   /^\\__/^\\         /~  \\                   /    \\
 /|  O|| O|        /      \\_______________/        \\
| |___||__|      /       /                \\          \\
|          \\    /      /                    \\          \\
|   (_______) /______/                        \\_________ \\
|         / /         \\                      /            \\
 \\         \\^\\\\         \\                  /               \\     /
   \\         ||           \\______________/      _-_       //\\__//
     \\       ||------_-~~-_ ------------- \\ --/~   ~\\    || __/
       ~-----||====/~     |==================|       |/~~~~~
        (_(__/  ./     /                    \\_\\      \\.
               (_(___/                         \\_____)_)`
  ];

  // Boot
  input.disabled = true;
  print('Initializing session...');
  setTimeout(() => {
    print('Loading profile...');
    setTimeout(() => {
      print('');
      printHTML('Hello, I am <span style="color:#3B6EA5">Chance Gammill</span>. Welcome to my site.');
      print('Feel free to look around or type \'help\' if you need a list of available commands.');
      print('');
      const art = arts[Math.floor(Math.random() * arts.length)];
      art.split('\n').forEach(line => print(line, 'info'));
      print('');
      input.disabled = false;
      input.focus();
    }, 250);
  }, 250);
});
