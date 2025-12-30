/**
 * キャラクターチャットアプリ
 * 生成したキャラクターとチャットができるアプリケーション
 * OpenAI APIを使用した自然な会話機能
 */

// ===== Configuration =====
const API_ENDPOINT = '/api/chat';
const SESSION_ID = 'session_' + Date.now();

// ===== State =====
let isProcessing = false; // リクエスト処理中フラグ

// ===== DOM Elements =====
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const characterName = document.getElementById('characterName');
const characterStatus = document.getElementById('characterStatus');
const characterDescription = document.getElementById('characterDescription');
const moodIndicator = document.getElementById('moodIndicator');
const characterAvatar = document.getElementById('characterAvatar');
const avatarInput = document.getElementById('avatarInput');
const avatarImage = document.getElementById('avatarImage');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');

// ===== Character Data =====
const character = {
  name: 'AIアシスタント',
  status: 'オンライン',
  description: 'フレンドリーなAIアシスタントです。何でも話しかけてください！',
  mood: '😊 ご機嫌',
  avatar: '🤖',
  avatarImageUrl: null, // カスタムアバター画像URL
  avatarVideoUrl: null, // リップシンク動画URL
  avatarType: 'emoji', // 'emoji', 'image', 'video'
  voice: 'Aoede', // TTS音声設定
  // フォールバック用レスポンス（API接続エラー時に使用）
  fallbackResponses: [
    'なるほど、それは面白いですね！',
    'もっと詳しく教えてください！',
    'その考え、とても素敵だと思います。',
    'へぇ〜、そうなんですね！',
    '確かに、それは大切なことですよね。',
    'わかります！私もそう思います。',
    'それは興味深い視点ですね。',
    '素晴らしい！応援しています！',
    'うんうん、続きを聞かせてください。',
    'そういう考え方もありますね！'
  ]
};

// ===== Utility Functions =====

/**
 * 現在時刻を取得してフォーマット
 */
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * チャットをスクロールして最新メッセージを表示
 */
function scrollToBottom() {
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth'
  });
}

/**
 * メッセージ要素を作成
 */
function createMessageElement(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;

  // アバターの表示（ユーザーまたはキャラクター）
  // チャットメッセージには常に画像を使用（動画はメインパネルのみ）
  let avatarContent;
  if (isUser) {
    avatarContent = '👤';
  } else if (character.avatarImageUrl) {
    avatarContent = `<img src="${character.avatarImageUrl}" alt="アバター" class="message-avatar-img">`;
  } else {
    avatarContent = character.avatar;
  }

  messageDiv.innerHTML = `
        <div class="message-avatar">${avatarContent}</div>
        <div class="message-content">
            <div class="message-bubble">
                <p>${escapeHtml(content)}</p>
            </div>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;

  return messageDiv;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * タイピングインジケーターを表示/非表示
 */
function showTypingIndicator(show = true) {
  if (show) {
    typingIndicator.classList.add('active');
  } else {
    typingIndicator.classList.remove('active');
  }
}

/**
 * フォールバック応答を取得（API接続エラー時）
 */
function getFallbackResponse() {
  const randomIndex = Math.floor(Math.random() * character.fallbackResponses.length);
  return character.fallbackResponses[randomIndex];
}

/**
 * OpenAI APIを使用して応答を生成
 * @param {string} userMessage - ユーザーのメッセージ
 * @returns {Promise<string>} - AIの応答
 */
async function generateResponse(userMessage) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: userMessage,
        characterId: character.avatarImageUrl || 'default'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData.error);

      // エラーメッセージを表示
      if (errorData.error) {
        return `⚠️ ${errorData.error}`;
      }
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.response;

  } catch (error) {
    console.error('Failed to get AI response:', error);
    // フォールバック応答を返す
    return getFallbackResponse() + '\n\n(※ API接続エラーのためフォールバック応答を表示しています)';
  }
}

// ===== Event Handlers =====

/**
 * メッセージ送信処理
 */
async function handleSubmit(e) {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  // 処理中の場合は送信をブロック
  if (isProcessing) return;

  // 処理開始
  isProcessing = true;

  // ユーザーメッセージを追加
  const userMessageElement = createMessageElement(message, true);
  chatMessages.appendChild(userMessageElement);
  scrollToBottom();

  // 入力をクリア・無効化
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendButton.disabled = true;
  messageInput.disabled = true; // 入力も無効化

  // タイピングインジケーターを表示
  showTypingIndicator(true);

  try {
    // OpenAI APIで応答を生成
    const response = await generateResponse(message);

    showTypingIndicator(false);

    // キャラクターの応答を表示
    const assistantMessageElement = createMessageElement(response, false);
    chatMessages.appendChild(assistantMessageElement);
    scrollToBottom();

    // 音声を生成して再生（動画は音声と同時に再生開始）
    playTTS(response);

    // 会話要約を更新
    updateConversationSummary();
  } catch (error) {
    showTypingIndicator(false);
    console.error('Error in handleSubmit:', error);

    // エラー時もフォールバック応答を表示
    const fallbackMessage = getFallbackResponse();
    const assistantMessageElement = createMessageElement(fallbackMessage, false);
    chatMessages.appendChild(assistantMessageElement);
    scrollToBottom();
  } finally {
    // 処理完了：入力を再度有効化
    isProcessing = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

/**
 * テキストエリアの自動リサイズ
 */
function handleInputChange() {
  // テキストエリアの高さを自動調整
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

  // 送信ボタンの有効/無効を切り替え
  sendButton.disabled = !messageInput.value.trim();
}

/**
 * Enterキーで送信（Shift+Enterで改行）
 */
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (messageInput.value.trim()) {
      chatForm.dispatchEvent(new Event('submit'));
    }
  }
}

/**
 * 会話要約を更新（新しい会話後にAI要約を再生成）
 */
async function updateConversationSummary() {
  // 少し待ってから要約を更新（会話保存完了を待つ）
  setTimeout(() => {
    loadConversationSummary();
  }, 500);
}

/**
 * 会話履歴からAI要約を読み込む
 */
async function loadConversationSummary() {
  const characterId = character.avatarImageUrl || 'default';
  const descriptionEl = document.getElementById('characterDescription');

  try {
    const response = await fetch('/api/conversations/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId })
    });
    const data = await response.json();

    if (descriptionEl && data.summary) {
      descriptionEl.textContent = data.summary;
      if (data.messageCount) {
        descriptionEl.textContent += `（${data.messageCount}件の会話）`;
      }
    }
  } catch (error) {
    console.log('会話要約の読み込みをスキップ:', error.message);
  }
}

// ===== Initialize =====

/**
 * アプリケーションの初期化
 */
function init() {
  // キャラクター情報を設定
  characterName.textContent = character.name;
  characterStatus.textContent = character.status;

  // LocalStorageからアバター画像を復元
  loadAvatarFromStorage();

  // 会話履歴から要約を読み込む
  loadConversationSummary();

  // イベントリスナーを登録
  chatForm.addEventListener('submit', handleSubmit);
  messageInput.addEventListener('input', handleInputChange);
  messageInput.addEventListener('keydown', handleKeyDown);

  // アバタークリックでファイル選択を開く
  characterAvatar.addEventListener('click', () => {
    avatarInput.click();
  });

  // アバター画像が選択されたときの処理
  avatarInput.addEventListener('change', handleAvatarChange);

  // 初期状態の設定
  sendButton.disabled = true;

  // フォーカスを入力欄に
  messageInput.focus();

  console.log('🚀 キャラクターチャットアプリを初期化しました');
}

/**
 * LocalStorageからアバター画像/動画を読み込む
 */
function loadAvatarFromStorage() {
  const savedAvatarUrl = localStorage.getItem('characterAvatarUrl');
  const savedVideoUrl = localStorage.getItem('characterVideoUrl');
  const savedAvatarType = localStorage.getItem('characterAvatarType');
  const savedVoice = localStorage.getItem('characterVoice');

  // 声の設定を読み込む
  if (savedVoice) {
    character.voice = savedVoice;
    console.log('🎤 声の設定を読み込みました:', savedVoice);
  }

  if (savedVideoUrl && savedAvatarType === 'video') {
    // 動画アバターの場合
    character.avatarImageUrl = savedAvatarUrl;
    character.avatarVideoUrl = savedVideoUrl;
    character.avatarType = 'video';

    // 左側パネルに動画を設定
    setupVideoAvatar(savedVideoUrl, savedAvatarUrl);

    // 初期メッセージのアバターは画像を使用（チャット内は常に画像）
    const initialMessageAvatar = document.getElementById('initialMessageAvatar');
    if (initialMessageAvatar) {
      initialMessageAvatar.innerHTML = `<img src="${savedAvatarUrl}" alt="アバター" class="message-avatar-img">`;
    }

    console.log('📂 保存済みアバター動画を読み込みました');

  } else if (savedAvatarUrl) {
    // 画像アバターの場合
    character.avatarImageUrl = savedAvatarUrl;
    character.avatarVideoUrl = null;
    character.avatarType = 'image';

    // 既存の動画要素があれば削除
    const existingVideo = document.getElementById('avatarVideo');
    if (existingVideo) {
      existingVideo.remove();
    }

    // 左側パネルのアバター表示を更新
    avatarImage.src = savedAvatarUrl;
    avatarImage.style.display = 'block';
    avatarPlaceholder.style.display = 'none';

    // 初期メッセージのアバターも更新
    const initialMessageAvatar = document.getElementById('initialMessageAvatar');
    if (initialMessageAvatar) {
      initialMessageAvatar.innerHTML = `<img src="${savedAvatarUrl}" alt="アバター" class="message-avatar-img">`;
    }

    console.log('📂 保存済みアバター画像を読み込みました');
  }
}

/**
 * 動画アバターをセットアップ
 */
function setupVideoAvatar(videoUrl, posterUrl) {
  // 既存の画像を隠す
  avatarImage.style.display = 'none';
  avatarPlaceholder.style.display = 'none';

  // 動画要素を作成または取得
  let avatarVideo = document.getElementById('avatarVideo');
  if (!avatarVideo) {
    avatarVideo = document.createElement('video');
    avatarVideo.id = 'avatarVideo';
    avatarVideo.className = 'avatar-video';
    avatarVideo.muted = true;
    avatarVideo.loop = true;
    avatarVideo.playsInline = true;
    avatarVideo.preload = 'auto';
    characterAvatar.appendChild(avatarVideo);
  }

  avatarVideo.src = videoUrl;
  avatarVideo.poster = posterUrl;
  avatarVideo.style.display = 'block';

  // 動画を読み込んで最初のフレームを表示
  avatarVideo.load();

  // 動画が読み込まれたら最初のフレームで停止
  avatarVideo.addEventListener('loadeddata', function () {
    avatarVideo.currentTime = 0;
  }, { once: true });
}

/**
 * アバター動画を再生
 */
function playAvatarVideo() {
  if (character.avatarType !== 'video') return;

  // 左側パネルのアバター動画のみ再生
  const avatarVideo = document.getElementById('avatarVideo');
  if (avatarVideo) {
    avatarVideo.play().catch(e => console.log('Video play failed:', e));
  }
}

/**
 * アバター動画を停止
 */
function pauseAvatarVideo() {
  if (character.avatarType !== 'video') return;

  // 左側パネルのアバター動画のみ停止
  const avatarVideo = document.getElementById('avatarVideo');
  if (avatarVideo) {
    avatarVideo.pause();
    avatarVideo.currentTime = 0;
  }
}

// 現在再生中の音声
let currentAudio = null;

/**
 * テキストを音声に変換して再生
 */
async function playTTS(text) {
  try {
    // 前の音声が再生中なら停止
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    console.log('🎤 音声生成リクエスト...（声:', character.voice, '）');

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: character.voice })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('TTS エラー:', error);
      // エラー時は動画を一定時間後に停止
      fallbackVideoStop(text);
      return;
    }

    const data = await response.json();
    console.log('✅ 音声生成完了:', data.audioUrl);

    // 音声を再生
    currentAudio = new Audio(data.audioUrl);

    // 音声終了時に動画を停止
    currentAudio.addEventListener('ended', () => {
      pauseAvatarVideo();
      currentAudio = null;
    });

    // 音声エラー時のフォールバック
    currentAudio.addEventListener('error', () => {
      console.error('音声再生エラー');
      fallbackVideoStop(text);
      currentAudio = null;
    });

    // 音声準備完了時に動画と同時に再生開始
    currentAudio.addEventListener('canplaythrough', () => {
      playAvatarVideo();  // 動画再生開始
      currentAudio.play().catch(e => {
        console.error('音声再生失敗:', e);
        fallbackVideoStop(text);
      });
    }, { once: true });

  } catch (error) {
    console.error('TTS リクエストエラー:', error);
    fallbackVideoStop(text);
  }
}

/**
 * 音声が使えない時のフォールバック（テキスト長に応じて動画停止）
 */
function fallbackVideoStop(text) {
  const playDuration = Math.max(2000, text.length * 50);
  setTimeout(() => {
    pauseAvatarVideo();
  }, playDuration);
}

/**
 * アバター画像変更処理
 */
function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 画像ファイルかチェック
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルを選択してください');
    return;
  }

  // ファイルを読み込んで表示
  const reader = new FileReader();
  reader.onload = (event) => {
    const imageUrl = event.target.result;

    // キャラクターデータを更新
    character.avatarImageUrl = imageUrl;

    // アバター表示を更新
    avatarImage.src = imageUrl;
    avatarImage.style.display = 'block';
    avatarPlaceholder.style.display = 'none';

    console.log('🖼️ アバター画像を設定しました');
  };
  reader.readAsDataURL(file);
}

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', init);
