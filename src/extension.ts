import fetch from 'node-fetch';
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
    // Commande pour ouvrir les paramètres de l'extension
    const openSettingsCommand = 'litellm.openSettings';
    context.subscriptions.push(vscode.commands.registerCommand(openSettingsCommand, () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'LiteLLM');
    }));

    // Commande pour rafraîchir les informations de budget
    const refreshBudgetCommand = 'litellm.refreshBudget';
    context.subscriptions.push(vscode.commands.registerCommand(refreshBudgetCommand, () => {
        updateStatusBar();
        vscode.window.showInformationMessage('Informations de budget rafraîchies');
    }));

    // Commande pour afficher le menu contextuel du budget
    const showBudgetMenuCommand = 'litellm.showBudgetMenu';
    context.subscriptions.push(vscode.commands.registerCommand(showBudgetMenuCommand, async (spend: number, maxBudget: number) => {
        // Créer un QuickPick pour afficher un menu léger avec des options
        const items: vscode.QuickPickItem[] = [
            {
                label: "$(sync) Rafraîchir",
                description: "Mettre à jour les informations de budget"
            },
            {
                label: "$(gear) Paramètres",
                description: "Ouvrir les paramètres de l'extension"
            },
            {
                label: "$(graph) Détails",
                description: `Dépense: ${spend}$ / Budget total: ${maxBudget}$`
            }
        ];

        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: `Budget: ${spend}$ / ${maxBudget}$`,
            title: "Détails du budget"
        });

        if (selectedItem) {
            if (selectedItem.label.includes("Rafraîchir")) {
                vscode.commands.executeCommand('litellm.refreshBudget');
            } else if (selectedItem.label.includes("Paramètres")) {
                vscode.commands.executeCommand('litellm.openSettings');
            }
        }
    }));

    // Création d'un élément dans la barre d'état
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "Budget: Loading...";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

	// Fonction pour récupérer les paramètres utilisateur
	const getConfigValues = async () => {
	    const config = vscode.workspace.getConfiguration('LiteLLM');
		const secrets: vscode.SecretStorage = context.secrets;

        let apiKey = await secrets.get("apiKey");
        if (!apiKey) {
            apiKey = await vscode.window.showInputBox({ title: 'Enter your API token', password: true });
            if (apiKey !== undefined) {
                await secrets.store('apiKey',apiKey);
            }
        }
        const refreshInterval = config.get<number>('refreshInterval') || 60;
        const apiUrl = config.get<string>('apiUrl') || 'https://';
        return { apiKey, refreshInterval, apiUrl };
    };

    // Fonction pour actualiser la barre d'état
    const updateStatusBar = async () => {
        const { apiKey, apiUrl } = await getConfigValues(); // Récupérer la clé API et l'URL

        if (!apiKey ) {
            statusBarItem.text = "Budget: Clé manquante";
            statusBarItem.tooltip = "Veuillez configurer votre clé API dans les paramètres\nCliquez pour ouvrir les paramètres";
            statusBarItem.command = 'litellm.openSettings';
            return;
        }

        try {
            const response = await fetch(`${apiUrl}/key/info`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const spend = data.info.spend ?? 0;
            const max_budget = data.info.max_budget ?? 0;

            // Arrondir le `spend` au dixième
            const spendRounded = Math.round(spend * 100) / 100;

            // Mettre à jour le texte de la barre d'état
            statusBarItem.text = `💸 ${spendRounded}/${max_budget}$`;
            
            // Ajouter une infobulle riche qui s'affiche au survol
            statusBarItem.tooltip = new vscode.MarkdownString(`
## Détails du budget
- **Dépense actuelle:** ${spendRounded}$
- **Budget total:** ${max_budget}$
- **Pourcentage utilisé:** ${max_budget > 0 ? Math.round((spendRounded / max_budget) * 100) : 0}%

*Cliquez pour plus d'options*
            `);
            statusBarItem.tooltip.isTrusted = true;
            
            // Associer la commande pour afficher le menu contextuel
            statusBarItem.command = {
                title: 'Afficher le menu du budget',
                command: 'litellm.showBudgetMenu',
                arguments: [spendRounded, max_budget]
            };
        } catch (error) {
            statusBarItem.text = "Budget: Erreur";
            statusBarItem.tooltip = "Impossible de récupérer les informations de budget\nCliquez pour ouvrir les paramètres";
            statusBarItem.command = 'litellm.openSettings';
        }
    };

    // Récupérer l'intervalle de rafraîchissement initial (en secondes)
    const { refreshInterval } = await getConfigValues();
    let interval = setInterval(updateStatusBar, refreshInterval * 1000);

    // Actualiser immédiatement lors de l'activation
    updateStatusBar();

    // Écouter les changements de configuration
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('LiteLLM')) {
            // Mettre à jour l'intervalle si la configuration change
            const { refreshInterval: newInterval } = await getConfigValues();
            clearInterval(interval);
            interval = setInterval(updateStatusBar, newInterval * 1000);
            
            // Rafraîchir immédiatement avec les nouveaux paramètres
            updateStatusBar();
        }
    }));

    // Nettoyer les ressources lorsque l'extension est désactivée
    context.subscriptions.push({
        dispose: () => clearInterval(interval),
    });
}

export function deactivate() {
}