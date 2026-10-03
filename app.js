(() => {
  const STORAGE_KEY = 'purple_cards_game_v3';
  const WORD_HISTORY_KEY = 'purple_cards_word_history_v1';
  const TEAM_LABELS = { A: 'الفريق البنفسجي', B: 'الفريق الأبيض' };
  const ROUND_SECONDS = 30;
  const MAX_ROUNDS = 30;
  let timerId = null;
  let feedbackTimerId = null;

  const WORDS = [
    'قمر', 'نمر', 'برتقال', 'بنفسجي', 'دبي', 'سرير', 'مكتبة', 'سمك', 'خريف', 'نورس',
    'مظلة', 'طبيب', 'فشار', 'ساعة', 'فراشة', 'مصعد', 'شاطئ', 'طبلة', 'روبوت', 'ثلج',
    'سيارة', 'دراجة', 'طائرة', 'قطار', 'سفينة', 'حافلة', 'تاج', 'مفتاح', 'مرآة', 'تفاحة',
    'موز', 'بطيخ', 'عنب', 'جزر', 'خبز', 'عسل', 'قهوة', 'حليب', 'بيتزا', 'أسد',
    'فيل', 'زرافة', 'أرنب', 'سلحفاة', 'بطريق', 'دلفين', 'حصان', 'ديك', 'نحلة', 'مدرسة',
    'مستشفى', 'مطعم', 'مطار', 'حديقة', 'ملعب', 'مسجد', 'سوق', 'فندق', 'محطة', 'كرة',
    'كتاب', 'قلم', 'هاتف', 'حاسوب', 'كاميرا', 'حقيبة', 'حذاء', 'قبعة', 'نظارة', 'شمس',
    'نجمة', 'سحابة', 'مطر', 'برق', 'جبل', 'نهر', 'جزيرة', 'صحراء', 'شلال', 'مطرقة',
    'فرشاة', 'مروحة', 'بالون', 'شمعة', 'وسادة', 'نافذة', 'باب', 'درج', 'سجادة', 'ساعة رملية',
    'موزة', 'ليمون', 'فراولة', 'مانجو', 'بصل', 'بطاطس', 'معكرونة', 'كعكة', 'مربى', 'ثلّاجة',"اسد الغابه","بيت الجدة","الي مايعرف الصقر يشويه","اللي اختشوا ماتوا","اللي يعيش ياما يشوف","اللي مايعرفك ما يقدرك","عهد الاصدقاء"
    ,'جبل طويق', 'السعودية', 'طيارة', 'جوال', 'في بطن حجله طلي',
    'مسلسلات', 'خيل', 'فضاء', 'الشبل من ذاك الاسد', 'جارك قبل دارك',
    'الي فات مات', 'يد واحدة ماتصفق', 'العين بصيره واليد قصيرة',
    'العين لا تعلو على الحاجب'
    ];  


  function readState() {
    try {
      const room = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (room && Array.isArray(room.usedWords)) rememberWords(room.usedWords);
      if (room && room.phase === 'playing' && room.maxRounds !== MAX_ROUNDS) {
        room.maxRounds = MAX_ROUNDS;
        writeState(room);
      }
      if (room && room.phase === 'playing' && typeof room.cardRevealed !== 'boolean') {
        room.cardRevealed = false;
        room.deadline = null;
        writeState(room);
      }
      return room;
    }
    catch { return null; }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function readWordHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(WORD_HISTORY_KEY) || '[]');
      return new Set(Array.isArray(history) ? history : []);
    } catch {
      return new Set();
    }
  }

  function rememberWords(words) {
    const history = readWordHistory();
    const previousSize = history.size;
    words.forEach(word => history.add(word));
    if (history.size !== previousSize) {
      localStorage.setItem(WORD_HISTORY_KEY, JSON.stringify([...history]));
    }
    return history;
  }

  function getNextWord(room) {
    const usedThisGame = new Set(room.usedWords || []);
    let history = rememberWords([...usedThisGame]);
    let remaining = WORDS.filter(word => !usedThisGame.has(word) && !history.has(word));

    if (remaining.length === 0) {
      localStorage.removeItem(WORD_HISTORY_KEY);
      history = new Set();
      remaining = WORDS.filter(word => !usedThisGame.has(word));
    }
    if (remaining.length === 0) return null;

    const word = remaining[Math.floor(Math.random() * remaining.length)];
    room.usedWords.push(word);
    history.add(word);
    localStorage.setItem(WORD_HISTORY_KEY, JSON.stringify([...history]));
    return word;
  }

  function finishRound(guessedCorrectly, timedOut = false) {
    const room = readState();
    if (!room || room.phase !== 'playing' || room.feedback) return;
    clearInterval(timerId);
    if (!room.deadline || Date.now() >= room.deadline) guessedCorrectly = false;

    if (guessedCorrectly) room.scores[room.currentTeam] += 1;
    room.feedback = guessedCorrectly ? 'correct' : timedOut ? 'timeout' : 'wrong';
    room.deadline = null;
    writeState(room);
    render();
    scheduleRoundAdvance();
  }

  function scheduleRoundAdvance() {
    if (feedbackTimerId) clearTimeout(feedbackTimerId);
    feedbackTimerId = setTimeout(() => {
      feedbackTimerId = null;
      advanceRound();
    }, 1000);
  }

  function advanceRound() {
    const room = readState();
    if (!room || room.phase !== 'playing' || !room.feedback) return;

    room.round += 1;
    room.feedback = null;
    if (room.round >= room.maxRounds) {
      room.phase = 'ended';
      if (room.scores.A === room.scores.B) room.winner = 'تعادل';
      else room.winner = room.scores.A > room.scores.B ? TEAM_LABELS.A : TEAM_LABELS.B;
      writeState(room);
      render();
      return;
    }

    room.currentTeam = room.currentTeam === 'A' ? 'B' : 'A';
    room.currentWord = getNextWord(room);
    if (!room.currentWord) {
      room.phase = 'ended';
      if (room.scores.A === room.scores.B) room.winner = 'تعادل';
      else room.winner = room.scores.A > room.scores.B ? TEAM_LABELS.A : TEAM_LABELS.B;
      writeState(room);
      render();
      return;
    }
    room.cardRevealed = false;
    room.deadline = null;
    writeState(room);
    render();
  }

  function renderHome() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="panel home-panel">
        <div class="brand">بطاقات الفرق</div>
        <h1>لعبة التمثيل</h1>
        <p>قسّموا أنفسكم إلى فريقين، ومثّلوا الكلمة قبل انتهاء الوقت.</p>
        <label class="field-label" for="player-count">عدد اللاعبين</label>
        <input id="player-count" type="number" min="2" max="30" value="4" inputmode="numeric">
        <button id="start-game">ابدأ اللعب</button>
      </div>
    `;
  }

  function renderGame() {
    const app = document.getElementById('app');
    const room = readState();
    const teamPlayers = room.players.filter(player => player.team === room.currentTeam);
    const actor = teamPlayers[Math.floor(room.round / 2) % teamPlayers.length];
    const remaining = room.deadline ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)) : ROUND_SECONDS;
    const feedback = room.feedback;
    const feedbackMessage = feedback === 'correct'
      ? { icon: '✓', title: 'إجابة صحيحة!', detail: `+1 نقطة لـ${TEAM_LABELS[room.currentTeam]}` }
      : feedback === 'timeout'
        ? { icon: '⌛', title: 'انتهى الوقت', detail: 'ننتقل إلى الفريق التالي' }
        : feedback === 'wrong'
          ? { icon: '×', title: 'إجابة غير صحيحة', detail: 'ننتقل إلى الفريق التالي' }
          : null;

    app.innerHTML = `
      <div class="panel game-panel">
        <div class="score-bar">
          <div class="score-box purple"><span>${TEAM_LABELS.A}</span><strong>${room.scores.A}</strong></div>
          <div class="turn-label">الفريق الحالي: ${TEAM_LABELS[room.currentTeam]}</div>
          <div class="score-box white"><span>${TEAM_LABELS.B}</span><strong>${room.scores.B}</strong></div>
        </div>

        <div class="actor-box">
          <div class="mini-label">الممثل في هذه الجولة</div>
          <div class="actor-name">${actor ? actor.name : 'الممثل'}</div>
          <div class="team-badge ${room.currentTeam === 'A' ? 'team-a' : 'team-b'}">${TEAM_LABELS[room.currentTeam]}</div>
        </div>

        ${feedbackMessage ? `
          <div class="feedback-banner ${feedback}" role="status" aria-live="assertive">
            <span class="feedback-icon" aria-hidden="true">${feedbackMessage.icon}</span>
            <span class="feedback-copy"><strong>${feedbackMessage.title}</strong><small>${feedbackMessage.detail}</small></span>
          </div>
        ` : ''}

        ${feedback ? '' : `<div class="timer-area">
          <div class="timer-label">${room.deadline ? 'الوقت المتبقي' : room.cardRevealed ? 'احفظ الكلمة ثم أخفِ البطاقة' : 'المؤقت يبدأ بعد إخفاء البطاقة'}</div>
          <div id="timer" class="timer" role="timer" aria-live="off">${room.deadline ? remaining : '--'}</div>
        </div>`}

        ${feedback ? '' : `<div class="secret-card">
          <div class="secret-top">${room.cardRevealed ? 'احفظ الكلمة ثم أخفِ البطاقة' : 'البطاقة مخفية عن الفريق'}</div>
          <div class="secret-word">${room.cardRevealed ? room.currentWord : '••••'}</div>
        </div>`}

        ${feedback || room.deadline ? '' : `<button class="reveal-button" id="card-action">${room.cardRevealed ? 'إخفاء البطاقة وبدء الوقت' : 'اعرض البطاقة للممثل'}</button>`}
        ${feedback ? '' : `<div class="judge-label">${room.deadline ? 'هل خمنها الفريق؟' : 'أخفِ البطاقة لتبدأ الجولة'}</div>
          <div class="judge-actions">
            ${room.deadline ? `
              <button class="correct-button" data-round="${room.round}" data-correct="true">صح، أضف نقطة</button>
              <button class="wrong-button" data-round="${room.round}" data-correct="false">خطأ</button>
            ` : '<div class="round-hint">تبدأ خيارات الحكم بعد إخفاء البطاقة</div>'}
          </div>`}

        <div class="round-label">الجولة ${room.round + 1} / ${room.maxRounds}</div>
        <button class="secondary-button" id="reset">إنهاء اللعبة</button>
      </div>
    `;
    if (feedback) {
      clearInterval(timerId);
      if (!feedbackTimerId) scheduleRoundAdvance();
    } else if (room.deadline && !room.cardRevealed) {
      startTimer();
    } else {
      clearInterval(timerId);
    }
  }

  function renderEnded() {
    const app = document.getElementById('app');
    const room = readState();
    app.innerHTML = `
      <div class="panel">
        <div class="brand">انتهت اللعبة</div>
        <h2>الفائز: ${room.winner}</h2>
        <div class="score-bar">
          <div class="score-box purple"><span>${TEAM_LABELS.A}</span><strong>${room.scores.A}</strong></div>
          <div class="score-box white"><span>${TEAM_LABELS.B}</span><strong>${room.scores.B}</strong></div>
        </div>
        <button id="reset">لعب مرة أخرى</button>
      </div>
    `;
  }

  function render() {
    const room = readState();
    if (!room) return renderHome();
    if (room.phase === 'playing') return renderGame();
    return renderEnded();
  }

  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      const room = readState();
      const timer = document.getElementById('timer');
      if (!room || room.phase !== 'playing' || !timer || !room.deadline || room.cardRevealed) {
        clearInterval(timerId);
        return;
      }
      const remaining = Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000));
      timer.textContent = remaining;
      timer.classList.toggle('urgent', remaining <= 10);
      if (remaining === 0) finishRound(false, true);
    }, 200);
  }

  document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.id === 'card-action') {
      const room = readState();
      if (!room || room.phase !== 'playing' || room.deadline) return;
      if (room.cardRevealed) {
        room.cardRevealed = false;
        room.deadline = Date.now() + ROUND_SECONDS * 1000;
      } else {
        room.cardRevealed = true;
      }
      writeState(room);
      render();
    }

    if (target.id === 'start-game') {
      const input = document.getElementById('player-count');
      const count = Number(input.value);
      if (!Number.isInteger(count) || count < 2 || count > 30) {
        input.setCustomValidity('أدخل عددًا من ٢ إلى ٣٠ لاعبًا');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      const room = {
        phase: 'playing',
        players: Array.from({ length: count }, (_, index) => ({ name: `لاعب ${index + 1}`, team: index % 2 === 0 ? 'A' : 'B' })),
        scores: { A: 0, B: 0 },
        currentTeam: 'A',
        round: 0,
        maxRounds: MAX_ROUNDS,
        usedWords: []
      };
      room.currentWord = getNextWord(room);
      room.deadline = null;
      room.cardRevealed = false;
      writeState(room);
      render();
    }

    if (target.id === 'reset') {
      clearInterval(timerId);
      localStorage.removeItem(STORAGE_KEY);
      renderHome();
    }

    if (target.dataset.correct !== undefined) {
      const room = readState();
      if (Number(target.dataset.round) !== room.round) return;
      finishRound(target.dataset.correct === 'true');
    }
  });

  render();
})();
