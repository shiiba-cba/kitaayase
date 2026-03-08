# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際の指針を提供します。

## プロジェクト概要

**北綾瀬時刻表（Kitaayase Timetable）** - 東京メトロ千代田線北綾瀬駅に特化したスマートフォン向け Web 時刻表アプリ。GitHub Pages で完全サーバーレス構成でデプロイされています。

公開サイト：https://shiiba-cba.github.io/kitaayase/

## コマンド

```bash
npm install       # 依存関係のインストール
npm run dev       # Vite 開発サーバーの起動
npm run lint      # ESLint の実行
npm test          # Vitest テストの実行（ウォッチモード）
npm test -- --run # テストを 1 回実行
npm run build     # テスト + リント + TypeScript + Vite ビルド
npm run preview   # 本番ビルドのプレビュー
```

単一テストの実行：`npm test -- <テストファイルパターン>`

## アーキテクチャ

### データフロー

```
src/tools/ (Node.js スクリプト)
  ├── fetchRawTrainTimetable.js  → 東京メトロ ODPT API から取得
  ├── generateTimetable.js       → 生データを時刻表 JSON に変換
  ├── generateTrainMaster.js     → 列車マスターデータを生成
  └── yahoo-platform-*.js        → Yahoo から番線情報を収集

public/data/
  ├── latest.json                → 現在のダイヤ改正日
  ├── raw/                       → API レスポンス（前回/今回）
  └── {diagramDate}/             → ダイヤ改正日別の時刻表データ
      ├── timetable/{weekday|holiday}/{direction}/{station}.json
      ├── train/{weekday|holiday}/{trainNumber}.json
      └── yahoo-platform-*/      → 番線データ
```

### フロントエンド構成

```
src/
  ├── components/    # React コンポーネント（TrainCard、TrainDetailDialog など）
  ├── hooks/         # カスタムフック（useTimetableData、useOperationInfo など）
  ├── utils/         # 純粋関数（time、transferLogic、autoDirection）
  ├── data/          # 静的データ（stations、trainTypes）
  ├── types/         # TypeScript 型（TrainRow、TrainDetail、OperationInfo）
  └── constants/     # 定数（storageKeys、uiText）
```

### 主要パターン

- **4:00 基準の 1 日** - 時刻計算に営業日分（toServiceDayMinutes）を使用
- **2 方向システム**：`for_yoyogiuehara`（A 線・代々木上原方面）と `for_kitaayase`（B 線・北綾瀬方面）
- **駅選択**：ユーザーは `selectStations`（全駅のサブセット）から選択
- **平日/休日判定**：`useCalendar` フックが API で判定
- **自動方向切り替え**：時間ベースの自動方向切り替え（しきい値時間変更可能）

### 状態管理

- **localStorage**：方向、駅、自動方向設定、ダイヤ改正日キャッシュ
- **JSON キャッシュ**：取得済み時刻表データ用のメモリ内 LRU キャッシュ（160 エントリ）
- **AbortController**：古いフェッチリクエストのキャンセルに使用

### 外部 API

- **東京メトロ ODPT API**：生時刻表データ（`fetchRawTrainTimetable.js`経由）
- **運行情報**：Cloudflare Workers プロキシ（`kitaayase-worker.workers.dev`）- API キーを安全に管理、ETag キャッシュ対応

### GitHub Actions

- **deploy.yml**：main へプッシュ → ビルド（テスト + リント + 型チェック）→ Pages へデプロイ
- **update-timetable.yml**：毎日 4:30 JST - ダイヤ改正を検知、時刻表データを再生成、Yahoo 番線データを収集

### テスト

Vitest + React Testing Library。以下のテストが存在します：
- `useCalendar`、`useTimetableData`、`useUiActions` フック
- `autoDirection`、`time`、`transferLogic` ユーティリティ
- `AutoDirectionSettingsDialog` コンポーネント
