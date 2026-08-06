const output = document.getElementById('output');
const input = document.getElementById('cmd-input');
const promptText = document.getElementById('prompt-text');

let cwd = '~';
const dirs = {
  '~': null,
  'skills': {
    title: 'skills/',
    content: [
      'Web Development',
      'UI / UX Design',
      'JavaScript & CSS',
      'Problem Solving'
    ]
  },
  'hobbies': {
    title: 'hobbies/',
    content: [
      'Coding side projects',
      'Reading tech blogs',
      'Hiking & outdoors',
      'Photography'
    ]
  },
  'contact': {
    title: 'contact/',
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

function typeLines(lines, delay = 40) {
  return new Promise(resolve => {
    let i = 0;
    function next() {
      if (i < lines.length) {
        print(lines[i]);
        i++;
        setTimeout(next, delay);
      } else {
        resolve();
      }
    }
    next();
  });
}

async function boot() {
  input.disabled = true;
  const bootLines = [
    'Initializing session...',
    'Loading profile...',
    '',
    'Welcome to [Your Name]\'s terminal.',
    'Type "help" for available commands.',
    ''
  ];
  await typeLines(bootLines, 35);
  input.disabled = false;
  input.focus();
}

function updatePrompt() {
  promptText.textContent = `visitor@site:${cwd}$`;
}

function handleCommand(raw) {
  const cmd = raw.trim().toLowerCase();
  if (!cmd) return;

  print(`${promptText.textContent} ${raw}`, 'cmd');

  const parts = cmd.split(/\s+/);
  const base = parts[0];
  const arg = parts[1] || '';

  if (base === 'help') {
    print('Available commands:', 'info');
    print('  help          show this message');
    print('  ls            list directories');
    print('  cd <dir>      change directory (skills | hobbies | contact)');
    print('  cd ..  or  cd ~   go back');
    print('  clear         clear the screen');
    print('  whoami        about me');
  }
  else if (base === 'ls') {
    if (cwd === '~') {
      print('skills/  hobbies/  contact/', 'info');
    } else {
      print('(empty)', 'muted');
    }
  }
  else if (base === 'cd') {
    if (!arg || arg === '~' || arg === '..' || arg === '/') {
      cwd = '~';
      updatePrompt();
      print(`changed to ${cwd}`, 'muted');
    } else if (dirs[arg] && cwd === '~') {
      cwd = arg;
      updatePrompt();
      print(`changed to ${cwd}/`, 'muted');
      print('');
      print(dirs[arg].title, 'info');
      dirs[arg].content.forEach(line => print('  ' + line));
      print('');
    } else if (dirs[arg]) {
      print(`cd: already in a directory. Use "cd .." first.`, 'error');
    } else {
      print(`cd: no such directory: ${arg}`, 'error');
      print('Try: skills, hobbies, contact', 'muted');
    }
  }
  else if (base === 'clear') {
    output.innerHTML = '';
  }
  else if (base === 'whoami') {
    print('[Your Name]', 'info');
    print('Digital front door · Type "ls" to explore');
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
  }
});

// Keep focus
document.addEventListener('click', () => input.focus());

boot();
