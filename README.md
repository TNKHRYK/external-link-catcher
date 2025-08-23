# External Link Catcher

Chrome拡張機能で、Slackなどの外部アプリケーションから開かれたリンクを指定されたタブグループで整理します。

## 機能

- **タブグループ名の設定**: 外部リンクを開くタブグループ名を自由に設定可能（デフォルト: "today"）
- **自動グループ化**: 外部アプリから開かれたリンクを自動的に指定されたタブグループで開く
- **自動グループ作成**: 指定されたタブグループが存在しない場合は新規作成

## インストール方法

### 開発者モードでのインストール

1. Chrome ブラウザで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このプロジェクトフォルダを選択

## 使用方法

1. 拡張機能をインストール後、ツールバーのアイコンをクリック
2. タブグループ名を設定（デフォルト: "today"）
3. 設定を保存
4. Slackなどの外部アプリからリンクを開くと、自動的に指定されたタブグループで開かれます

## 技術仕様

- **Manifest Version**: 3
- **必要な権限**: tabs, tabGroups, storage, background
- **対応ブラウザ**: Chrome（Manifest V3対応版）

## ディレクトリ構成

```
external-link-catcher/
├── manifest.json      # 拡張機能の設定
├── background.js      # バックグラウンドスクリプト（メイン機能）
├── popup.html         # 設定画面のHTML
├── popup.js          # 設定画面のJavaScript
├── icons/            # アイコンファイル（今後追加）
└── README.md         # このファイル
```

## 開発

### 必要な権限

- `tabs`: タブの作成・移動を行うため
- `tabGroups`: タブグループの作成・管理を行うため
- `storage`: 設定の保存・読み込みを行うため
- `background`: バックグラウンドで動作するため

### 主な機能

- **外部リンク検出**: `tabs.onCreated`イベントで外部から開かれたタブを検出
- **タブグループ管理**: 指定された名前のタブグループを取得または新規作成
- **設定管理**: `chrome.storage.sync`を使用して設定を永続化

## ライセンス

MIT License

## 作者

Created for tab organization and productivity improvement.
