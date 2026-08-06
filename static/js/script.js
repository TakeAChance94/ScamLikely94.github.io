<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Take A Chance</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍀</text></svg>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0c0c0c;
      color: #d4d4d4;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 15px;
      line-height: 1.5;
      height: 100vh;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    #terminal {
      width: 100%;
      max-width: 820px;
      height: 90vh;
      max-height: 620px;
      background: #111;
      border: 1px solid #333;
      border-radius: 10px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .titlebar {
      background: #1a1a1a;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #333;
      user-select: none;
    }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot.red { background: #ff5f56; }
    .dot.yellow { background: #ffbd2e; }
    .dot.green { background: #27c93f; }
    .title { flex: 1; text-align: center; color: #888; font-size: 13px; }
    #output {
      flex: 1;
      padding: 18px 20px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .line { margin-bottom: 2px; }
    .prompt { color: #7ee787; }
    .cmd { color: #e6edf3; }
    .error { color: #ff7b72; }
    .info { color: #79c0ff; }
    .muted { color: #8b949e; }
    #input-line {
      display: flex;
      padding: 12px 20px 18px;
      align-items: center;
      border-top: 1px solid #222;
    }
    #prompt-text { color: #7ee787; margin-right: 8px; white-space: nowrap; }
    #cmd-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e6edf3;
      font-family: inherit;
      font-size: inherit;
      caret-color: #7ee787;
    }
    .cursor {
      display: inline-block;
      width: 8px;
      height: 1.1em;
      background: #7ee787;
      animation: blink 1s step-end infinite;
      vertical-align: text-bottom;
      margin-left: 1px;
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
    a { color: #79c0ff; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Email modal */
    #email-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      visibility: hidden;
      transition: 0.2s;
    }
    #email-modal.open {
      opacity: 1;
      visibility: visible;
    }
    .modal-box {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      padding: 1.5rem;
      width: 90%;
      max-width: 420px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    .modal-box h3 {
      margin-bottom: 1rem;
      color: #e6edf3;
      font-size: 1.1rem;
    }
    .modal-box label {
      display: block;
      color: #8b949e;
      font-size: 0.85rem;
      margin-bottom: 0.35rem;
    }
    .modal-box input,
    .modal-box textarea {
      width: 100%;
      background: #0c0c0c;
      border: 1px solid #333;
      border-radius: 6px;
      color: #e6edf3;
      font-family: inherit;
      font-size: 0.95rem;
      padding: 0.6rem 0.75rem;
      margin-bottom: 1rem;
      outline: none;
    }
    .modal-box input:focus,
    .modal-box textarea:focus {
      border-color: #7ee787;
    }
    .modal-box textarea {
      min-height: 120px;
      resize: vertical;
    }
    .modal-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }
    .modal-actions button {
      border: none;
      border-radius: 6px;
      padding: 0.55rem 1.1rem;
      font-family: inherit;
      font-size: 0.9rem;
      cursor: pointer;
    }
    #email-send {
      background: #7ee787;
      color: #0c0c0c;
      font-weight: 600;
    }
    #email-cancel {
      background: #333;
      color: #d4d4d4;
    }
  </style>
</head>
<body>
  <div id="terminal">
    <div class="titlebar">
      <div class="dot red"></div>
      <div class="dot yellow"></div>
      <div class="dot green"></div>
      <div class="title">visitor@takeachance — zsh</div>
    </div>
    <div id="output"></div>
    <div id="input-line">
      <span id="prompt-text">visitor@takeachance:~$</span>
      <input id="cmd-input" type="text" autocomplete="off" autofocus spellcheck="false">
    </div>
  </div>

  <div id="email-modal">
    <div class="modal-box">
      <h3>Send a message</h3>
      <label for="email-subject">Subject</label>
      <input type="text" id="email-subject" placeholder="Hello...">
      <label for="email-body">Message</label>
      <textarea id="email-body" placeholder="Write your message here..."></textarea>
      <div class="modal-actions">
        <button id="email-cancel">Cancel</button>
        <button id="email-send">Send</button>
      </div>
    </div>
  </div>

  <script src="static/js/script.js"></script>
</body>
</html>
