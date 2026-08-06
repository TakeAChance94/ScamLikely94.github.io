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
        'Web Development',
        'UI / UX Design',
        'JavaScript & CSS',
        'Problem Solving'
      ]
    },
    'hobbies.txt': {
      type: 'file',
      content: [
        'Coding side projects',
        'Reading tech blogs',
        'Hiking & outdoors',
        'Photography'
      ]
    },
    'contact_info.txt': {
      type: 'file',
      content: [
        'Email: you@example.com',
        'GitHub: @yourusername',
        'LinkedIn: yourprofile'
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
    const cmd = raw.trim();
    if (!cmd) return;

    printHTML(`<span class="prompt">${promptText.textContent}</span> <span class="cmd">${raw}</span>`);

    const parts = cmd.split(/\s+/);
    const base = parts[0].toLowerCase();
    const arg = parts[1] || '';

    if (base === 'help') {
      print('Available commands:', 'info');
      print('  help              show this message');
      print('  ls                list directory contents');
      print('  cd <dir>          change directory');
      print('  cat <file>        show file contents');
      print('  clear             clear the screen');
      print('  whoami            about me');
      print('');
      print('Tip: use Tab for autocomplete', 'muted');
    }
    else if (base === 'ls') {
      const dir = fs[cwd];
      if (dir && dir.type === 'dir') {
        print(dir.children.join('  '), 'info');
      }
    }
    else if (base === 'cd') {
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
      if (!arg) {
        print('cat: missing file operand', 'error');
        return;
      }
      const dir = fs[cwd];
      if (!dir || dir.type !== 'dir' || !dir.children.includes(arg)) {
        print(`cat: ${arg}: No such file`, 'error');
        return;
      }
      const file = fs[arg];
      if (file && file.type === 'file') {
        file.content.forEach(line => print(line));
      }
    }
    else if (base === 'clear') {
      output.innerHTML = '';
    }
    else if (base === 'whoami') {
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
/            \\
|             \\_
|         ,--.-.)
 \\     /  o \\o\\
 /\\/\\  \\    /_/
  (_.   \`--'__)
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
      print('Hello, I am Chance Gammill. Welcome to my site.');
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
