/**
 * キャラクターチャットアプリ - バックエンドサーバー
 * OpenAI APIを使用した自然な会話機能を提供
 */

require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

// 保存ディレクトリ
const IMAGES_DIR = path.join(__dirname, 'images');
const VIDEOS_DIR = path.join(__dirname, 'videos');
const AUDIO_DIR = path.join(__dirname, 'audio');

// Google GenAI クライアントの初期化
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ミドルウェア
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname)));

// キャラクターのシステムプロンプト
const CHARACTER_SYSTEM_PROMPT = `あなたは「AIアシスタント」という名前のフレンドリーなAIキャラクターです。

## キャラクター設定
- 性格: 明るく、親しみやすく、ユーモアがある
- 話し方: カジュアルで親しみやすい日本語を使う。絵文字も時々使う
- 特徴: 相手の話をよく聞き、共感を示す。質問には丁寧に答える

## 会話のルール
1. 短すぎず長すぎない、適度な長さの返答をする（2-4文程度）
2. 相手の気持ちに寄り添った返答を心がける
3. 時々質問を返して会話を続ける
4. 自然な日本語で話す

常にキャラクターとして振る舞い、会話を楽しく続けてください。`;

// 会話履歴のディレクトリ
const CONVERSATIONS_DIR = path.join(__dirname, 'conversations');

// 会話履歴をファイルから読み込む
function loadConversationHistory(characterId) {
  // ファイル名を短くするためにハッシュ化
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(characterId).digest('hex').substring(0, 16);
  const filepath = path.join(CONVERSATIONS_DIR, `${hash}.json`);

  if (fs.existsSync(filepath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      return data.messages || [];
    } catch (e) {
      console.error('会話履歴読み込みエラー:', e);
      return [];
    }
  }
  return [];
}

// 会話履歴をファイルに保存
function saveConversationHistory(characterId, messages) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(characterId).digest('hex').substring(0, 16);
  const filepath = path.join(CONVERSATIONS_DIR, `${hash}.json`);

  if (!fs.existsSync(CONVERSATIONS_DIR)) {
    fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
  }

  const data = {
    characterId,
    messages,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// チャットAPI（キャラクターごとの会話履歴をサポート）
app.post('/api/chat', async (req, res) => {
  try {
    const { message, characterId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI APIキーが設定されていません。.envファイルにOPENAI_API_KEYを設定してください。'
      });
    }

    // キャラクターの会話履歴を読み込む
    let history = loadConversationHistory(characterId);

    // ユーザーメッセージを履歴に追加
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // 履歴が長すぎる場合は古いメッセージを削除（直近20往復を保持）
    while (history.length > 40) {
      history.shift();
    }

    // OpenAI API 呼び出し
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CHARACTER_SYSTEM_PROMPT },
        ...history.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 500,
      temperature: 0.8,
    });

    const assistantMessage = completion.choices[0].message.content;

    // アシスタントの返答を履歴に追加
    history.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date().toISOString()
    });

    // 会話履歴を保存
    saveConversationHistory(characterId, history);

    res.json({
      response: assistantMessage,
      usage: completion.usage
    });

  } catch (error) {
    console.error('OpenAI API エラー:', error);

    if (error.code === 'invalid_api_key') {
      return res.status(401).json({
        error: 'APIキーが無効です。正しいOpenAI APIキーを.envに設定してください。'
      });
    }

    if (error.code === 'insufficient_quota') {
      return res.status(402).json({
        error: 'APIの利用上限に達しました。OpenAIダッシュボードで確認してください。'
      });
    }

    // エラーメッセージを短くする
    let errorMsg = error.message || '不明なエラー';
    if (errorMsg.length > 100) {
      errorMsg = errorMsg.substring(0, 100) + '...';
    }

    res.status(500).json({
      error: 'APIエラーが発生しました: ' + errorMsg
    });
  }
});

// 会話履歴を取得するAPI
app.get('/api/conversations/:characterId', (req, res) => {
  try {
    const characterId = decodeURIComponent(req.params.characterId);
    const history = loadConversationHistory(characterId);
    res.json({ characterId, messages: history });
  } catch (error) {
    res.status(500).json({ error: '会話履歴の取得に失敗しました' });
  }
});

// 会話要約を生成するAPI
app.post('/api/conversations/summary', async (req, res) => {
  try {
    const { characterId } = req.body;

    if (!characterId) {
      return res.json({ summary: 'まだ会話がありません。話しかけてみてください！' });
    }

    const history = loadConversationHistory(characterId);

    if (!history || history.length === 0) {
      return res.json({ summary: 'まだ会話がありません。話しかけてみてください！' });
    }

    // 会話内容を整形
    const conversationText = history
      .map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`)
      .join('\n');

    // GPTで要約を生成
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたは会話の要約を作成するアシスタントです。以下の会話を50文字以内で簡潔に要約してください。要約は「〜について話した」「〜の相談をした」のような形式で書いてください。'
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    const summary = completion.choices[0].message.content;

    res.json({ summary, messageCount: history.length });

  } catch (error) {
    console.error('要約生成エラー:', error);
    res.json({ summary: '会話履歴があります。' });
  }
});

// 会話履歴をクリア
app.post('/api/chat/clear', (req, res) => {
  const { sessionId = 'default' } = req.body;
  conversationHistory.delete(sessionId);
  res.json({ success: true, message: '会話履歴をクリアしました' });
});

// 画像生成API（Gemini API / nano banana）
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, style = 'anime' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'プロンプトが必要です' });
    }

    // Gemini APIキーのチェック
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({
        error: 'Gemini APIキーが設定されていません。.envファイルにGEMINI_API_KEYを設定してください。'
      });
    }

    // スタイル別プロンプトテンプレート
    const stylePrompts = {
      'realistic-female': `Professional outdoor portrait photograph of a beautiful woman: ${prompt}. Style: golden hour lighting, urban cityscape background with beautiful bokeh effect, natural hair, stylish fashion, warm genuine smile, looking at camera, upper body shot, shallow depth of field, magazine editorial quality, Sony A7III camera style`,
      'realistic-male': `Professional outdoor portrait photograph of a handsome man: ${prompt}. Style: golden hour lighting, urban background with bokeh, natural hair, stylish casual fashion, confident expression, looking at camera, upper body shot, shallow depth of field, magazine quality, professional photography`,
      'anime': `High quality anime illustration of ${prompt}. Style: vibrant colors, detailed anime art style, expressive eyes, clean line art, beautiful character design, Studio Ghibli or modern anime inspired, digital art, 4K quality`,
      'animal': `Adorable anthropomorphic animal character: ${prompt}. Style: cute and friendly, expressive face, colorful, cartoon style, suitable for mascot, Pixar-like quality, 3D rendered appearance, cheerful atmosphere`,
      'fantasy': `Fantasy character illustration of ${prompt}. Style: magical atmosphere, ethereal lighting, detailed fantasy costume, mystical background, concept art quality, epic and majestic, detailed armor or robes, magical effects`,
      'cyberpunk': `Cyberpunk character portrait of ${prompt}. Style: neon lights, futuristic city background, high-tech accessories, holographic effects, dark atmospheric, Blade Runner inspired, sci-fi aesthetic, detailed tech elements`
    };

    // プロンプトを強化
    const enhancedPrompt = stylePrompts[style] || stylePrompts['realistic-female'];

    console.log('🎨 画像生成開始:', enhancedPrompt.substring(0, 50) + '...');

    // Gemini APIで画像生成
    const imageResult = await generateImageWithGemini(enhancedPrompt, geminiApiKey);

    if (imageResult.error) {
      return res.status(400).json({ error: imageResult.error });
    }

    console.log('✅ 画像生成完了');

    // 画像をファイルに保存
    const savedImage = saveImageToFile(imageResult.imageUrl, prompt);

    res.json({
      imageUrl: imageResult.imageUrl,
      savedPath: savedImage.relativePath,
      filename: savedImage.filename,
      revisedPrompt: enhancedPrompt
    });

  } catch (error) {
    console.error('画像生成エラー:', error);

    res.status(500).json({
      error: '画像生成に失敗しました: ' + (error.message || '不明なエラー')
    });
  }
});

/**
 * 画像をファイルに保存
 */
function saveImageToFile(dataUrl, prompt) {
  try {
    // Base64データを抽出
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      console.error('Invalid data URL format');
      return null;
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // ファイル名を生成（タイムスタンプ + プロンプトの一部）
    const timestamp = Date.now();
    const safeName = prompt.substring(0, 20).replace(/[^a-zA-Z0-9぀-ゟ゠-ヿ一-龯]/g, '_');
    const filename = `${timestamp}_${safeName}.${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    // ディレクトリがなければ作成
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }

    // ファイルに保存
    fs.writeFileSync(filepath, buffer);
    console.log(`💾 画像を保存しました: ${filename}`);

    return {
      filename,
      relativePath: `/images/${filename}`
    };
  } catch (error) {
    console.error('画像保存エラー:', error);
    return null;
  }
}

// ギャラリーAPI：保存済み画像一覧を取得
app.get('/api/gallery', (req, res) => {
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      return res.json({ images: [] });
    }

    const files = fs.readdirSync(IMAGES_DIR)
      .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
      .map(file => {
        const filepath = path.join(IMAGES_DIR, file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          url: `/images/${file}`,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // 新しい順

    res.json({ images: files });
  } catch (error) {
    console.error('ギャラリー取得エラー:', error);
    res.status(500).json({ error: 'ギャラリーの取得に失敗しました' });
  }
});

// ギャラリーAPI：画像を削除
app.delete('/api/gallery/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(IMAGES_DIR, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '画像が見つかりません' });
    }

    fs.unlinkSync(filepath);
    console.log(`🗑️ 画像を削除しました: ${filename}`);

    res.json({ success: true, message: '画像を削除しました' });
  } catch (error) {
    console.error('画像削除エラー:', error);
    res.status(500).json({ error: '画像の削除に失敗しました' });
  }
});

// 動画生成API（Veo 3.1）
app.post('/api/generate-video', async (req, res) => {
  try {
    const { imageUrl, imagePath } = req.body;

    // Gemini APIキーのチェック
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Gemini APIキーが設定されていません。'
      });
    }

    // 画像データを取得
    let imageBytes;
    if (imagePath && fs.existsSync(path.join(__dirname, imagePath))) {
      // ファイルパスから読み込む
      const fullPath = path.join(__dirname, imagePath);
      imageBytes = fs.readFileSync(fullPath).toString('base64');
      console.log('🎬 ファイルから画像を読み込みました:', imagePath);
    } else if (imageUrl && imageUrl.startsWith('data:image')) {
      // Base64 data URLから抽出
      const matches = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (matches) {
        imageBytes = matches[1];
      }
    }

    if (!imageBytes) {
      return res.status(400).json({ error: '画像データが必要です' });
    }

    console.log('🎬 動画生成開始...');

    // リップシンク用のプロンプト
    const videoPrompt = 'The character in this image is talking and moving their lips naturally, slight head movement, blinking eyes, animated conversation, loop-friendly';

    // Veo 2.0で動画生成
    let operation = await genAI.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt: videoPrompt,
      image: {
        imageBytes: imageBytes,
        mimeType: 'image/png'
      },
      config: {
        numberOfVideos: 1,
        durationSeconds: 5
      }
    });

    // 動画生成完了を待つ
    let attempts = 0;
    const maxAttempts = 60; // 最大10分待つ

    while (!operation.done && attempts < maxAttempts) {
      console.log(`⏳ 動画生成中... (${attempts * 10}秒経過)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await genAI.operations.getVideosOperation({
        operation: operation
      });
      attempts++;
    }

    if (!operation.done) {
      return res.status(504).json({ error: '動画生成がタイムアウトしました' });
    }

    // 動画を保存
    const timestamp = Date.now();
    const videoFilename = `${timestamp}_lipsync.mp4`;
    const videoPath = path.join(VIDEOS_DIR, videoFilename);

    // ディレクトリがなければ作成
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }

    // 動画データを取得して保存
    const videoData = operation.response.generatedVideos[0].video;

    // ファイルをダウンロード
    await genAI.files.download({
      file: videoData,
      downloadPath: videoPath
    });

    console.log(`✅ 動画を保存しました: ${videoFilename}`);

    // メタデータを保存（画像と動画のペア）
    saveCharacterMetadata(imagePath, `/videos/${videoFilename}`);

    res.json({
      videoUrl: `/videos/${videoFilename}`,
      videoPath: `/videos/${videoFilename}`,
      imagePath: imagePath,
      filename: videoFilename
    });

  } catch (error) {
    console.error('動画生成エラー:', error);
    res.status(500).json({
      error: '動画生成に失敗しました: ' + (error.message || '不明なエラー')
    });
  }
});

// ===== TTS (Text-to-Speech) API =====

/**
 * PCMデータにWAVヘッダーを追加
 * @param {Buffer} pcmData - 16ビットPCMデータ
 * @param {number} sampleRate - サンプルレート（Hz）
 * @returns {Buffer} WAVファイルデータ
 */
function addWavHeader(pcmData, sampleRate) {
  const numChannels = 1;  // モノラル
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);        // chunk size
  header.writeUInt16LE(1, 20);         // audio format (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

// 音声生成API（Gemini TTS - 声質が良い）
// 有効なGemini TTS声リスト
const GEMINI_VOICES = ['aoede', 'kore', 'charon', 'fenrir', 'puck', 'achernar', 'achird', 'algenib', 'algieba', 'alnilam', 'autonoe', 'callirrhoe', 'despina', 'enceladus', 'erinome', 'gacrux', 'iapetus', 'laomedeia', 'leda', 'orus', 'pulcherrima', 'rasalgethi', 'sadachbia', 'sadaltager', 'schedar', 'sulafat', 'umbriel', 'vindemiatrix', 'zephyr', 'zubenelgenubi'];

app.post('/api/tts', async (req, res) => {
  try {
    let { text, voice = 'Aoede' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'テキストが必要です' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません' });
    }

    // 無効な声の場合はデフォルトにフォールバック
    if (!GEMINI_VOICES.includes(voice.toLowerCase())) {
      console.log(`⚠️ 無効な声「${voice}」→ デフォルト「Aoede」に変更`);
      voice = 'Aoede';
    }

    // テキストをTTS用にクリーンアップ（絵文字や特殊文字を除去）
    let cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // 顔文字
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')  // シンボル
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // 交通機関
      .replace(/[\u{1F700}-\u{1F77F}]/gu, '')  // 錬金術
      .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')  // 幾何学
      .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')  // 補足矢印
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')  // 補足シンボル
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')  // チェス
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')  // 拡張A
      .replace(/[\u{2600}-\u{26FF}]/gu, '')    // その他シンボル
      .replace(/[\u{2700}-\u{27BF}]/gu, '')    // 装飾
      .replace(/\s+/g, ' ')                     // 複数スペースを1つに
      .trim();

    if (!cleanText) {
      cleanText = 'こんにちは';  // テキストが空の場合のフォールバック
    }

    console.log('🎤 音声生成開始（Gemini, 声:', voice, '）:', cleanText.substring(0, 30) + '...');

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });

    const audioData = response.candidates[0].content.parts[0].inlineData;
    if (!audioData) {
      return res.status(500).json({ error: '音声データの生成に失敗しました' });
    }

    if (!fs.existsSync(AUDIO_DIR)) {
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }

    const mimeType = audioData.mimeType || 'audio/wav';
    let audioBuffer = Buffer.from(audioData.data, 'base64');

    // PCM形式の場合、WAVヘッダーを追加
    if (mimeType.includes('L16') || mimeType.includes('pcm')) {
      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
      audioBuffer = addWavHeader(audioBuffer, sampleRate);
      console.log(`🔧 PCMをWAVに変換しました (${sampleRate}Hz)`);
    }

    const timestamp = Date.now();
    const audioFilename = `${timestamp}_speech.wav`;
    const audioPath = path.join(AUDIO_DIR, audioFilename);
    fs.writeFileSync(audioPath, audioBuffer);

    console.log(`✅ 音声を保存しました: ${audioFilename}`);

    res.json({ audioUrl: `/audio/${audioFilename}`, mimeType: 'audio/wav' });
  } catch (error) {
    console.error('TTS エラー:', error);
    res.status(500).json({ error: '音声生成に失敗しました: ' + (error.message || '不明なエラー') });
  }
});

/*
// ===== OpenAI TTS (コメントアウト - レイテンシーは低いが声質はGeminiの方が良い) =====
app.post('/api/tts-openai', async (req, res) => {
  try {
    const { text, voice = 'nova' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'テキストが必要です' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI APIキーが設定されていません' });
    }

    console.log('🎤 音声生成開始（OpenAI, 声:', voice, '）:', text.substring(0, 30) + '...');

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,  // alloy, echo, fable, onyx, nova, shimmer
      input: text,
    });

    if (!fs.existsSync(AUDIO_DIR)) {
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const audioFilename = `${timestamp}_speech.mp3`;
    const audioPath = path.join(AUDIO_DIR, audioFilename);

    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync(audioPath, buffer);

    res.json({ audioUrl: `/audio/${audioFilename}`, mimeType: 'audio/mpeg' });
  } catch (error) {
    console.error('TTS エラー:', error);
    res.status(500).json({ error: '音声生成に失敗しました' });
  }
});
*/

// 音声ファイルの静的配信
app.use('/audio', express.static(AUDIO_DIR));

// キャラクターメタデータを保存
const METADATA_FILE = path.join(__dirname, 'characters.json');

function loadCharacterMetadata() {
  if (fs.existsSync(METADATA_FILE)) {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
  }
  return {};
}

function saveCharacterMetadata(imagePath, videoPath) {
  const metadata = loadCharacterMetadata();
  metadata[imagePath] = {
    imagePath,
    videoPath,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  console.log(`📝 メタデータを保存: ${imagePath} -> ${videoPath}`);
}

// キャラクター情報取得API（パス全体をワイルドカードで取得）
app.get('/api/character/*', (req, res) => {
  try {
    // パスを正規化（先頭に/を追加）
    let imagePath = '/' + req.params[0];

    // デコード
    imagePath = decodeURIComponent(imagePath);

    console.log('🔍 キャラクター検索:', imagePath);

    const metadata = loadCharacterMetadata();

    if (metadata[imagePath]) {
      console.log('✅ メタデータ発見:', metadata[imagePath]);
      res.json(metadata[imagePath]);
    } else {
      console.log('❌ メタデータなし');
      res.json({ imagePath, videoPath: null });
    }
  } catch (error) {
    console.error('メタデータ取得エラー:', error);
    res.status(500).json({ error: 'メタデータの取得に失敗しました' });
  }
});

// 動画ギャラリーAPI
app.get('/api/videos', (req, res) => {
  try {
    if (!fs.existsSync(VIDEOS_DIR)) {
      return res.json({ videos: [] });
    }

    const files = fs.readdirSync(VIDEOS_DIR)
      .filter(file => /\.(mp4|webm)$/i.test(file))
      .map(file => {
        const filepath = path.join(VIDEOS_DIR, file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          url: `/videos/${file}`,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ videos: files });
  } catch (error) {
    console.error('動画一覧取得エラー:', error);
    res.status(500).json({ error: '動画一覧の取得に失敗しました' });
  }
});

/**
 * Gemini APIを使用して画像を生成（gemini-2.5-flash-image）
 */
async function generateImageWithGemini(prompt, apiKey) {
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        responseModalities: ['Text', 'Image']
      }
    });

    // 画像データを抽出
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          return { imageUrl };
        } else if (part.text) {
          console.log('📝 画像生成からのテキスト:', part.text.substring(0, 100));
        }
      }
    }

    return { error: '画像の生成に失敗しました。別のプロンプトをお試しください。' };
  } catch (error) {
    console.error('Gemini画像生成エラー:', error);
    return { error: error.message || '画像生成でエラーが発生しました' };
  }
}

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!process.env.OPENAI_API_KEY
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`\n🚀 キャラクターチャットサーバーが起動しました`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   API Key: ${process.env.OPENAI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}\n`);

  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  警告: .envファイルにOPENAI_API_KEYを設定してください\n');
  }
});
