# 🎭 Character Chat App

AIキャラクターとチャットできるWebアプリケーションです。  
画像生成、動画生成、音声合成を組み合わせた、没入感のあるチャット体験を提供します。

## ✨ 機能

- **AIチャット**: OpenAI GPT-4oを使用した自然な会話
- **キャラクター画像生成**: Gemini AIによる多様なスタイルの画像生成
  - リアル（女性/男性）
  - アニメ風
  - 動物キャラクター
  - ファンタジー
  - サイバーパンク
- **リップシンク動画生成**: 静止画からの動画生成
- **音声合成（TTS）**: Gemini TTSによる高品質な音声読み上げ

## 📋 必要要件

- Node.js 18以上
- OpenAI APIキー
- Gemini APIキー

## 🚀 セットアップ手順

### 1. リポジトリをクローン

```bash
git clone https://github.com/ryota-nakazawa/chat_app.git
cd chat_app
```

### 2. 依存関係をインストール

```bash
npm install
```

### 3. 環境変数を設定

`.env.example`をコピーして`.env`を作成します。

```bash
cp .env.example .env
```

`.env`ファイルを編集し、APIキーを設定します。

```env
# OpenAI API Key
# https://platform.openai.com/account/api-keys で取得
OPENAI_API_KEY=your_openai_api_key_here

# Gemini API Key (画像生成・TTS用)
# https://aistudio.google.com/apikey で取得
GEMINI_API_KEY=your_gemini_api_key_here

# サーバー設定
PORT=3000
```

### 4. アプリを起動

```bash
npm start
```

### 5. ブラウザでアクセス

```
http://localhost:3000
```

## 📱 使い方

### キャラクターを作成する

1. **「キャラクター作成」**ボタンをクリック
2. 画像スタイルを選択（リアル、アニメ風など）
3. キャラクターの説明を入力して画像を生成
4. 気に入った画像で**「動画生成」**をクリック
5. 声を選択して**「アバターに設定」**

### チャットする

1. メイン画面でメッセージを入力
2. AIが返答し、音声が自動再生されます
3. キャラクターの動画が音声に合わせて動きます

## 📁 ディレクトリ構成

```
chat_app/
├── index.html          # メインチャット画面
├── generator.html      # キャラクター生成画面
├── app.js              # フロントエンドJS
├── generator.js        # 画像生成ページJS
├── style.css           # スタイルシート
├── server.js           # バックエンドサーバー
├── package.json        # 依存関係
├── .env.example        # 環境変数テンプレート
└── .gitignore
```

## 🔧 API

このアプリは以下のAPIを使用しています：

| API | 用途 |
|-----|------|
| OpenAI GPT-4o | チャット応答 |
| Gemini Image Generation | キャラクター画像生成 |
| Gemini TTS | 音声合成 |

## 📝 ライセンス

MIT License

## 🤝 貢献

Issue、Pull Requestは歓迎します！
