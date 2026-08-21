document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');
  const input = document.getElementById('cmd-input');
  const promptText = document.getElementById('prompt-text');
  if (!output || !input) return;

  let cwd = '~';

  const fs = {
    '~': {
      type: 'dir',
      children: ['skills', 'hobbies', 'contact', 'certificates', 'career', 'education']
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
    'certificates': {
      type: 'dir',
      children: ['certificates.txt']
    },
    'career': {
      type: 'dir',
      children: ['career.txt']
    },
    'education': {
      type: 'dir',
      children: ['education.txt']
    },
    'skills.txt': {
      type: 'file',
      content: [
        'Email security administration',
        'Web proxy administration',
        'Security incident investigation & response',
        'Enterprise web & email infrastructure',
        'Security playbooks & standardized procedures',
        'Workflow automation (Python / Bash)',
        'Cross-functional security standards',
        'Technical troubleshooting (software & hardware)',
        'Customer identity & access management (CIAM)',
        'Coaching, mentoring & performance feedback'
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
        'LinkedIn: https://www.linkedin.com/in/chancegammill/',
        'Location: San Antonio, TX'
      ]
    },
    'certificates.txt': {
      type: 'file',
      content: [
        'GIAC Defensible Security Architecture (GDSA) — Sep 2025',
        '  Analyst ID: 248488',
        '',
        'CompTIA Security+ — Mar 2022',
        '  ID: FFBYGEMH8CF4QECY',
        '',
        'CompTIA Network+ — Aug 2022',
        '  ID: YN5SHPB5L2RE1695',
        '',
        'CompTIA A+ — Jan 2022',
        '  ID: B9GRSPKP7K11QT3C'
      ]
    },



    'career.txt': {
      type: 'file',
      content: [
        'CAREER HISTORY',
        '══════════════════════════════════════════════════════════',
        '',
        'USAA · San Antonio, TX',
        '──────────────────────────────────────────────────────────',
        '  Information Security Engineer I        2026 – Present',
        '  Information Security Engineer II       2024 – 2026',
        '',
        '  • Email security & Web proxy administration',
        '  • Security incident investigation and operational recovery',
        '  • Playbooks, automation (Python/Bash), and security standards',
        '',
        '',
        '──────────────────────────────────────────────────────────',
        'Charter Communications · San Antonio, TX',
        '──────────────────────────────────────────────────────────',
        '  Technical Support Specialist Rep 3      Dec 2016 – Jun 2023',
        '',
        '  • Troubleshooting complex Spectrum hardware/software issues',
        '  • Home network security guidance and CIAM support',
        '',
        '',
        '──────────────────────────────────────────────────────────',
        'Arris Group · San Antonio, TX',
        '──────────────────────────────────────────────────────────',
        '  Performance Coach                       Jan 2016 – Nov 2016',
        '',
        '  • Agent coaching, escalations, KPI-based feedback models'
      ]
    },
    'education.txt': {
      type: 'file',
      content: [
        'Texas A&M University – San Antonio',
        'B.B.A. Computer Information Systems',
        'Concentration: Information Assurance & Security',
        'Fall 2023 · GPA 3.9'
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
        return ['skills', 'hobbies', 'contact', 'certificates', 'career', 'education', '..', '~'].filter(d => d.startsWith(arg));
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
      if (t === '--') {
        // rest are positionals — handled by continuing without flag parse
        continue;
      }
      if (t.startsWith('--')) {
        const name = t.slice(2).split('=')[0];
        if (name) flags.add(name);
      } else if (t.startsWith('-') && t.length > 1 && !/^-\d+$/.test(t)) {
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

  // Real GNU/bash short + common long options
  const FLAG_SETS = {
    // GNU ls (coreutils)
    ls: new Set([
      'a','A','b','B','c','C','d','D','f','F','g','G','h','H','i','I','k','l','L','m','n','N',
      'o','p','q','Q','r','R','s','S','t','T','u','U','v','w','x','X','Z','1',
      'all','almost-all','escape','ignore-backups','directory','dired','classify','no-group',
      'human-readable','dereference-command-line','inode','kibibytes','dereference','literal',
      'hide-control-chars','quote-name','reverse','recursive','size','tabsize','context',
      'help','version'
    ]),
    // bash cd builtin
    cd: new Set(['L','P','e','@','h','help']),
    // GNU cat
    cat: new Set([
      'A','b','e','E','n','s','t','T','u','v',
      'show-all','number-nonblank','show-ends','number','squeeze-blank',
      'show-tabs','show-nonprinting','help','version'
    ]),
    clear: new Set(['h','help','version','x']),
    whoami: new Set(['h','help','version']),
    help: new Set(['h','help'])
  };

  function runOne(cmd) {
    const { base, flags, positionals } = parseArgs(cmd);
    if (!base) return;
    const arg = positionals[0] || '';

    if (!['help', 'ls', 'cd', 'cat', 'clear', 'whoami'].includes(base)) {
      print(`command not found: ${base}`, 'error');
      print('Type "help" for available commands.', 'muted');
      return;
    }

    // Validate flags first (bash/GNU behavior)
    if (!checkFlags(base, flags, FLAG_SETS[base])) return;

    // ONLY --help shows help (GNU). Short -h is never help (ls: human-readable).
    const wantHelp = flags.has('help');
    const wantVersion = flags.has('version');

    if (wantVersion && base !== 'help') {
      print(`${base} (takeachance coreutils) 1.0.0`);
      return;
    }

    if (base === 'help' || wantHelp) {
      if (base === 'ls' || (base === 'help' && arg === 'ls')) {
        print('Usage: ls [OPTION]... [FILE]...', 'info');
        print('List directory contents.');
        print('  -a, --all             do not ignore entries starting with .');
        print('  -A, --almost-all      do not list implied . and ..');
        print('  -l                    use a long listing format');
        print('  -1                    list one file per line');
        print('  -h, --human-readable  with -l, print sizes like 1K 234M');
        print('  -r, --reverse         reverse order while sorting');
        print('  -R, --recursive       list subdirectories recursively');
        print('  -d, --directory       list directories themselves, not contents');
        print('  -F, --classify        append indicator (*/=@|) to entries');
        print('  -p                    append / indicator to directories');
        print('      --help            display this help');
        return;
      }
      if (base === 'cd' || (base === 'help' && arg === 'cd')) {
        print('Usage: cd [-L|-P] [dir]', 'info');
        print('Change the shell working directory.');
        print('  -L  force symbolic links to follow (default)');
        print('  -P  use physical directory structure');
        print('      --help  display this help');
        return;
      }
      if (base === 'cat' || (base === 'help' && arg === 'cat')) {
        print('Usage: cat [OPTION]... [FILE]...', 'info');
        print('Concatenate FILE(s) to standard output.');
        print('  -n, --number             number all output lines');
        print('  -b, --number-nonblank    number nonempty output lines');
        print('  -s, --squeeze-blank      suppress repeated empty lines');
        print('  -E, --show-ends          display $ at end of each line');
        print('  -A, --show-all           equivalent to -vET');
        print('      --help               display this help');
        return;
      }
      if (base === 'clear' || base === 'whoami') {
        print(`Usage: ${base}`, 'info');
        return;
      }
      print('Available commands:', 'info');
      print('  help              show this message');
      print('  ls [OPTION]...    list directory contents');
      print('  cd [DIR]          change directory');
      print('  cat [OPTION] FILE show file contents');
      print('  clear             clear the screen');
      print('  whoami            about me');
      print('');
      print('Tip: use Tab for autocomplete · chain with && or ;', 'muted');
      return;
    }

    if (base === 'ls') {
      const showAll = flags.has('a') || flags.has('all');
      const almostAll = flags.has('A') || flags.has('almost-all');
      const longFmt = flags.has('l') || flags.has('o') || flags.has('g') || flags.has('n');
      const onePerLine = flags.has('1');
      const comma = flags.has('m');
      const reverse = flags.has('r') || flags.has('reverse');
      const recursive = flags.has('R') || flags.has('recursive');
      const classify = flags.has('F') || flags.has('classify') || flags.has('p');
      const human = flags.has('h') || flags.has('human-readable');
      const listDirOnly = flags.has('d') || flags.has('directory');

      function isDir(name) {
        return name === '.' || name === '..' || (fs[name] && fs[name].type === 'dir');
      }

      function formatName(name) {
        if (!classify) return name;
        return isDir(name) ? name + '/' : name;
      }

      function listEntries(dirKey, entries, label) {
        if (label) {
          print('');
          print(label + ':', 'info');
        }
        let names = entries.slice();
        if (reverse) names.reverse();

        if (longFmt) {
          names.forEach(name => {
            const display = formatName(name);
            if (isDir(name)) {
              print(`drwxr-xr-x  1 visitor visitor  4.0K  ${display}`);
            } else {
              const size = human ? '1.2K' : '1280';
              print(`-rw-r--r--  1 visitor visitor  ${String(size).padStart(4)}  ${display}`);
            }
          });
        } else if (onePerLine) {
          names.forEach(name => print(formatName(name), 'info'));
        } else if (comma) {
          print(names.map(formatName).join(', '), 'info');
        } else {
          print(names.map(formatName).join('  '), 'info');
        }
      }

      function entriesFor(dirKey) {
        const dir = fs[dirKey];
        if (!dir || dir.type !== 'dir') return [];
        let entries = dir.children.slice();
        if (showAll) entries = ['.', '..', ...entries];
        // almost-all: exclude . and .. only (default already does)
        return entries;
      }

      // -d: list directory inode itself, not contents
      if (listDirOnly) {
        const name = cwd === '~' ? '.' : cwd;
        if (longFmt) print(`drwxr-xr-x  1 visitor visitor  4.0K  ${formatName(name)}`);
        else print(formatName(name), 'info');
        return;
      }

      // Target: positional path or cwd
      const target = arg || cwd;
      let startKey = cwd;
      if (arg) {
        if (arg === '.' || arg === './') startKey = cwd;
        else if (arg === '..' || arg === '~' || arg === '/') startKey = '~';
        else if (cwd === '~' && fs[arg] && fs[arg].type === 'dir') startKey = arg;
        else if (cwd === '~' && fs[arg] && fs[arg].type === 'file') {
          // ls on a file
          if (longFmt) {
            const size = human ? '1.2K' : '1280';
            print(`-rw-r--r--  1 visitor visitor  ${String(size).padStart(4)}  ${formatName(arg)}`);
          } else print(formatName(arg), 'info');
          return;
        } else {
          print(`ls: cannot access '${arg}': No such file or directory`, 'error');
          return;
        }
      }

      // -R recursive (distinct from -r reverse)
      if (recursive) {
        const queue = [startKey];
        let first = true;
        while (queue.length) {
          const key = queue.shift();
          const label = first && key === startKey && startKey === cwd
            ? null
            : (key === '~' ? '.' : key);
          first = false;
          const entries = entriesFor(key);
          listEntries(key, entries, label);
          // enqueue subdirectories (not . or ..)
          for (const name of entriesFor(key)) {
            if (name === '.' || name === '..') continue;
            if (fs[name] && fs[name].type === 'dir') {
              // only top-level dirs exist in this FS and live under ~
              if (key === '~') queue.push(name);
            }
          }
        }
        return;
      }

      // non-recursive
      listEntries(startKey, entriesFor(startKey), null);
    }

    else if (base === 'cd') {
      // -L / -P accepted (no-op in this simple FS)
      if (!arg || arg === '~' || arg === '..' || arg === '/') {
        cwd = '~';
        updatePrompt();
      } else if (cwd === '~' && fs[arg] && fs[arg].type === 'dir') {
        cwd = arg;
        updatePrompt();
      } else if ((arg === '..' || arg === '~')) {
        cwd = '~';
        updatePrompt();
      } else {
        print(`bash: cd: ${arg}: No such file or directory`, 'error');
      }
    }
    else if (base === 'cat') {
      if (!arg) {
        print('cat: missing file operand', 'error');
        print("Try 'cat --help' for more information.", 'muted');
        return;
      }
      // support multiple files
      const files = positionals.length ? positionals : [arg];
      for (const f of files) {
        const dir = fs[cwd];
        if (!dir || dir.type !== 'dir' || !dir.children.includes(f)) {
          print(`cat: ${f}: No such file or directory`, 'error');
          continue;
        }
        const file = fs[f];
        if (!file || file.type !== 'file') continue;

        let lines;
        if (f === 'contact_info.txt') {
          lines = [
            { html: true, text: 'Email: <span style="color:#79c0ff">Chance@takeachance.info</span>' },
            { html: true, text: 'LinkedIn: <a href="https://www.linkedin.com/in/chancegammill/" target="_blank" style="color:#79c0ff">linkedin.com/in/chancegammill</a>' }
          ];
        } else {
          lines = file.content.map(t => ({ html: false, text: t }));
        }

        // -s squeeze blank
        if (flags.has('s') || flags.has('squeeze-blank')) {
          const squeezed = [];
          let lastBlank = false;
          for (const line of lines) {
            const blank = line.text === '';
            if (blank && lastBlank) continue;
            squeezed.push(line);
            lastBlank = blank;
          }
          lines = squeezed;
        }

        const numberAll = flags.has('n') || flags.has('number');
        const numberNonblank = flags.has('b') || flags.has('number-nonblank');
        const showEnds = flags.has('E') || flags.has('show-ends') || flags.has('A') || flags.has('show-all') || flags.has('e');
        let n = 0;
        lines.forEach(line => {
          let text = line.text;
          if (showEnds) text = text + '$';
          if (numberAll || (numberNonblank && line.text !== '')) {
            n += 1;
            const prefix = String(n).padStart(6, ' ') + '  ';
            if (line.html) printHTML(prefix + text);
            else print(prefix + text);
          } else {
            if (line.html) printHTML(text);
            else print(text);
          }
        });
      }
    }
    else if (base === 'clear') {
      output.innerHTML = '';
    }
    else if (base === 'whoami') {
      print('Chance Gammill', 'info');
      print('Information Security Engineer · Type help if you need assistance');
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

  // Dynamic ASCII via figlet.js (CDN)
  const FIGLET_FONTS = [
    'Standard', 'Big', 'Slant', 'Doom', 'Small', 'Banner',
    'Block', 'Bubble', 'Digital', 'Ivrit', 'Lean', 'Mini',
    'Script', 'Shadow', 'Speed', 'Term'
  ];

  function showWelcome(artLines) {
    print('');
    printHTML('Hello, I am <span style="color:#3B6EA5">Chance Gammill</span>. Welcome to my site.');
    print('Feel free to look around or type \'help\' if you need a list of available commands.');
    print('');
    artLines.forEach(line => print(line, 'info'));
    print('');
    input.disabled = false;
    input.focus();
  }

  function bootWithFiglet() {
    const fonts = FIGLET_FONTS;
    const font = fonts[Math.floor(Math.random() * fonts.length)];
    const phrases = ['Chance', 'Take A Chance', 'Gammill', 'hello'];
    const text = phrases[Math.floor(Math.random() * phrases.length)];

    const fallback = [
      '  (figlet unavailable — using fallback)',
      '   > takeachance.info'
    ];

    if (typeof figlet === 'undefined') {
      showWelcome(fallback);
      return;
    }

    // Load font from CDN, then render
    figlet.defaults({ fontPath: 'https://cdn.jsdelivr.net/npm/figlet@1.7.0/fonts' });
    figlet.text(text, { font: font }, (err, data) => {
      if (err || !data) {
        showWelcome(fallback);
        return;
      }
      const lines = data.split('\n').filter((l, i, arr) => l.trim() || (i > 0 && i < arr.length - 1));
      showWelcome(lines.length ? lines : fallback);
    });
  }

  // Boot
  // Boot
  input.disabled = true;
  print('Initializing session...');
  setTimeout(() => {
    print('Loading profile...');
    setTimeout(() => {
      bootWithFiglet();
    }, 250);
  }, 250);
});
