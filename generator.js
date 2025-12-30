/**
 * 画像生成ページ - JavaScript
 * Gemini APIを使用してキャラクター画像を生成
 */

// ===== DOM Elements =====
const promptInput = document.getElementById('promptInput');
const generateButton = document.getElementById('generateButton');
const resultSection = document.getElementById('resultSection');
const loadingSection = document.getElementById('loadingSection');
const errorSection = document.getElementById('errorSection');
const generatedImage = document.getElementById('generatedImage');
const setAvatarButton = document.getElementById('setAvatarButton');
const regenerateButton = document.getElementById('regenerateButton');
const retryButton = document.getElementById('retryButton');
const errorMessage = document.getElementById('errorMessage');
const hintChips = document.querySelectorAll('.hint-chip');

// ギャラリー要素
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const refreshGalleryButton = document.getElementById('refreshGalleryButton');

// 動画生成要素
const generateVideoButton = document.getElementById('generateVideoButton');
const videoLoadingSection = document.getElementById('videoLoadingSection');
const videoResultSection = document.getElementById('videoResultSection');
const generatedVideo = document.getElementById('generatedVideo');
const setVideoAvatarButton = document.getElementById('setVideoAvatarButton');
const playVideoButton = document.getElementById('playVideoButton');
const voiceSelect = document.getElementById('voiceSelect');
const imageStyleSelect = document.getElementById('imageStyleSelect');

// ===== State =====
let currentImageUrl = null;
let currentImagePath = null;
let currentVideoUrl = null;
let isGenerating = false;
let isGeneratingVideo = false;

// ===== API Endpoints =====
const API_ENDPOINT = '/api/generate-image';
const GALLERY_API = '/api/gallery';
const VIDEO_API = '/api/generate-video';

// ===== Event Handlers =====

/**
 * 画像生成ボタンのクリック処理
 */
async function handleGenerate() {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    alert('キャラクターの説明を入力してください');
    promptInput.focus();
    return;
  }

  if (isGenerating) return;

  await generateImage(prompt);
}

/**
 * 画像生成APIを呼び出す
 */
async function generateImage(prompt) {
  isGenerating = true;

  // UI状態を更新
  showSection('loading');
  generateButton.disabled = true;

  try {
    // 選択されたスタイルを取得
    const selectedStyle = imageStyleSelect ? imageStyleSelect.value : 'realistic-female';

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        style: selectedStyle
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '画像生成に失敗しました');
    }

    const data = await response.json();

    // 生成された画像を表示
    currentImageUrl = data.imageUrl;
    currentImagePath = data.savedPath;
    generatedImage.src = currentImageUrl;
    showSection('result');

    // 動画セクションをリセット
    videoResultSection.style.display = 'none';
    currentVideoUrl = null;

    // ギャラリーを更新
    loadGallery();

  } catch (error) {
    console.error('Image generation error:', error);
    errorMessage.textContent = error.message;
    showSection('error');
  } finally {
    isGenerating = false;
    generateButton.disabled = false;
  }
}

/**
 * セクション表示を切り替え
 */
function showSection(section) {
  resultSection.style.display = 'none';
  loadingSection.style.display = 'none';
  errorSection.style.display = 'none';

  switch (section) {
    case 'result':
      resultSection.style.display = 'block';
      break;
    case 'loading':
      loadingSection.style.display = 'block';
      break;
    case 'error':
      errorSection.style.display = 'block';
      break;
  }
}

/**
 * 画像をアバターに設定
 */
function setAsAvatar(imageUrl = null) {
  const url = imageUrl || currentImageUrl;
  if (!url) return;

  // 以前の動画情報をクリア
  localStorage.removeItem('characterVideoUrl');

  // LocalStorageに保存
  localStorage.setItem('characterAvatarUrl', url);
  localStorage.setItem('characterAvatarType', 'image');

  // 成功メッセージ
  alert('✅ アバターを設定しました！チャットページで確認してください。');

  // チャットページに移動
  window.location.href = 'index.html';
}

/**
 * 再生成
 */
function handleRegenerate() {
  const prompt = promptInput.value.trim();
  if (prompt) {
    generateImage(prompt);
  }
}

/**
 * ヒントチップのクリック処理
 */
function handleHintClick(e) {
  const hint = e.target.dataset.hint;
  if (hint) {
    if (promptInput.value.trim()) {
      promptInput.value += '、' + hint;
    } else {
      promptInput.value = hint;
    }
    promptInput.focus();
  }
}

// ===== Video Generation Functions =====

/**
 * 動画生成ボタンのクリック処理
 */
async function handleGenerateVideo() {
  if (!currentImageUrl || isGeneratingVideo) return;

  isGeneratingVideo = true;
  generateVideoButton.disabled = true;
  videoLoadingSection.style.display = 'block';
  videoResultSection.style.display = 'none';

  try {
    const response = await fetch(VIDEO_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: currentImageUrl,
        imagePath: currentImagePath
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '動画生成に失敗しました');
    }

    const data = await response.json();

    // 生成された動画を表示
    currentVideoUrl = data.videoUrl;
    generatedVideo.src = currentVideoUrl;
    generatedVideo.load();

    videoLoadingSection.style.display = 'none';
    videoResultSection.style.display = 'block';

    console.log('✅ 動画生成完了:', currentVideoUrl);

  } catch (error) {
    console.error('Video generation error:', error);
    alert('動画生成エラー: ' + error.message);
    videoLoadingSection.style.display = 'none';
  } finally {
    isGeneratingVideo = false;
    generateVideoButton.disabled = false;
  }
}

/**
 * 動画をアバターに設定
 */
function setVideoAsAvatar() {
  if (!currentVideoUrl) return;

  // 選択された声を取得
  const selectedVoice = voiceSelect ? voiceSelect.value : 'Aoede';

  // 画像URL、動画URL、声の設定を保存
  localStorage.setItem('characterAvatarUrl', currentImageUrl);
  localStorage.setItem('characterVideoUrl', currentVideoUrl);
  localStorage.setItem('characterAvatarType', 'video');
  localStorage.setItem('characterVoice', selectedVoice);

  alert('✅ アバター動画と声を設定しました！チャットページで確認してください。');
  window.location.href = 'index.html';
}

/**
 * 動画再生テスト
 */
function toggleVideoPlayback() {
  if (generatedVideo.paused) {
    generatedVideo.play();
    playVideoButton.innerHTML = '<span class="button-icon">⏸️</span> 停止';
  } else {
    generatedVideo.pause();
    playVideoButton.innerHTML = '<span class="button-icon">▶️</span> 再生テスト';
  }
}

// ===== Gallery Functions =====

/**
 * ギャラリーを読み込む
 */
async function loadGallery() {
  try {
    const response = await fetch(GALLERY_API);
    const data = await response.json();

    if (data.images && data.images.length > 0) {
      renderGallery(data.images);
      galleryEmpty.style.display = 'none';
    } else {
      galleryGrid.innerHTML = '';
      galleryGrid.appendChild(galleryEmpty);
      galleryEmpty.style.display = 'block';
    }
  } catch (error) {
    console.error('Gallery load error:', error);
  }
}

/**
 * ギャラリーを描画
 */
function renderGallery(images) {
  galleryGrid.innerHTML = '';

  images.forEach(image => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="${image.url}" alt="保存済み画像" loading="lazy">
      <div class="gallery-item-overlay">
        <div class="gallery-item-actions">
          <button class="gallery-item-btn select" data-url="${image.url}">選択</button>
          <button class="gallery-item-btn delete" data-filename="${image.filename}">削除</button>
        </div>
      </div>
    `;

    // 選択ボタン - メタデータを取得して画像と動画をセット
    item.querySelector('.select').addEventListener('click', async (e) => {
      e.stopPropagation();
      await selectCharacterFromGallery(image.url);
    });

    // 削除ボタン
    item.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteImage(image.filename);
    });

    // 画像クリックでも選択
    item.querySelector('img').addEventListener('click', async () => {
      await selectCharacterFromGallery(image.url);
    });

    galleryGrid.appendChild(item);
  });
}

/**
 * ギャラリーからキャラクターを選択（画像と動画を紐付けて設定）
 */
async function selectCharacterFromGallery(imageUrl) {
  try {
    // 画像パスからメタデータを取得（先頭の/を削除してそのまま渡す）
    const imagePath = imageUrl.replace(/^\//, '');
    const response = await fetch(`/api/character/${imagePath}`);
    const metadata = await response.json();

    if (metadata.videoPath) {
      // 動画が紐付いている場合
      localStorage.setItem('characterAvatarUrl', imageUrl);
      localStorage.setItem('characterVideoUrl', metadata.videoPath);
      localStorage.setItem('characterAvatarType', 'video');
      console.log('✅ 動画付きキャラクターを選択:', imageUrl, metadata.videoPath);
    } else {
      // 動画がない場合は画像のみ
      localStorage.setItem('characterAvatarUrl', imageUrl);
      localStorage.removeItem('characterVideoUrl');
      localStorage.setItem('characterAvatarType', 'image');
      console.log('✅ 画像キャラクターを選択:', imageUrl);
    }

    alert('✅ キャラクターを設定しました！チャットページで確認してください。');
    window.location.href = 'index.html';

  } catch (error) {
    console.error('キャラクター選択エラー:', error);
    // フォールバック：画像のみ設定
    setAsAvatar(imageUrl);
  }
}

/**
 * 画像を削除
 */
async function deleteImage(filename) {
  if (!confirm('この画像を削除しますか？')) return;

  try {
    const response = await fetch(`${GALLERY_API}/${filename}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      loadGallery();
    } else {
      alert('削除に失敗しました');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('削除に失敗しました');
  }
}

// ===== Initialize =====
function init() {
  // イベントリスナーを登録
  generateButton.addEventListener('click', handleGenerate);
  setAvatarButton.addEventListener('click', () => setAsAvatar());
  regenerateButton.addEventListener('click', handleRegenerate);
  retryButton.addEventListener('click', handleRegenerate);
  refreshGalleryButton.addEventListener('click', loadGallery);

  // 動画生成イベント
  generateVideoButton.addEventListener('click', handleGenerateVideo);
  setVideoAvatarButton.addEventListener('click', setVideoAsAvatar);
  playVideoButton.addEventListener('click', toggleVideoPlayback);

  // ヒントチップのイベント
  hintChips.forEach(chip => {
    chip.addEventListener('click', handleHintClick);
  });

  // Enterキーで生成
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  });

  // ギャラリーを読み込む
  loadGallery();

  console.log('🎨 画像生成ページを初期化しました');
}

document.addEventListener('DOMContentLoaded', init);

