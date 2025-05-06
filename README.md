# LiteLLM Budget - VSCode Extension

## Description

**LiteLLM Budget** is a Visual Studio Code extension that allows you to track in real-time the consumed budget and maximum budget associated with your LiteLLM API key. This extension is particularly useful for developers using AI services that require a paid API, to efficiently manage their expenses.

## Features

- Displays **the consumed budget** and **the maximum budget** of your API key in the VSCode status bar with the format `💸 [expense]/[max budget]$`.
- Automatic data refresh at regular intervals (configurable).
- Simple configuration via VSCode settings.

## Installation

To install the extension:

1. VSCode Interface: Extensions → ⋯ (More actions) → "Install from VSIX..." / Command line: code --install-extension LiteLLM-budget-1.0.0.vsix

## Configuration

For the extension to work properly, you need to configure the following settings in your VSCode configuration file (settings.json):

```json
{
  "LiteLLM.refreshInterval": 60,
  "LiteLLM.apiUrl": "https://your-api-url"
}
```

Or open the extension settings directly.

### Available Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `LiteLLM.refreshInterval` | number | 60 | Refresh interval in seconds |
| `LiteLLM.apiUrl` | string | "https://" | LiteLLM API base URL |
