# LiteLLM Budget - Extension VSCode

## Description

**LiteLLM Budget** est une extension pour Visual Studio Code qui vous permet de suivre en temps réel le budget consommé et le budget maximum associé à votre clé API LiteLLM. Cette extension est particulièrement utile pour les développeurs utilisant des services d'IA nécessitant une API payante, afin de gérer efficacement leurs dépenses.

## Fonctionnalités

- Affiche **le budget consommé** et **le budget maximum** de votre clé API dans la barre d'état de VSCode avec le format `💸 [dépense]/[budget max]$`.
- Rafraîchissement automatique des données à intervalle régulier (configurable).
- Configuration simple via les paramètres de VSCode.

## Installation

Pour installer l'extension :

1. Interface VSCode : Extensions → ⋯ (Plus d'actions) → "Installer à partir d'un VSIX..." / Ligne de commande : code --install-extension LiteLLM-budget-1.0.0.vsix

## Configuration

Pour que l'extension fonctionne correctement, vous devez configurer les paramètres suivants dans votre fichier de configuration VSCode (settings.json) :

```json
{
  "LiteLLM.refreshInterval": 60,
  "LiteLLM.apiUrl": "https://votre-url-api"
}
```

### Paramètres disponibles

| Paramètre | Type | Par défaut | Description |
|-----------|------|------------|-------------|
| `LiteLLM.refreshInterval` | number | 60 | Intervalle de rafraîchissement en secondes |
| `LiteLLM.apiUrl` | string | "https://" | URL de base de l'API LiteLLM |
